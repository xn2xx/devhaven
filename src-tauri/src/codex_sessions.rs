use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc::{self, Receiver},
    Mutex, OnceLock,
};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use chrono::{Datelike, Local, Utc};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};
use sysinfo::System;

use crate::models::CodexSessionSummary;

const CODEX_SESSIONS_DIR: &str = ".codex/sessions";
const MAX_TAIL_LINES: usize = 2000;
const MAX_TAIL_BYTES: u64 = 256 * 1024;
const MAX_TAIL_BYTES_CAP: u64 = 8 * 1024 * 1024;
const MAX_JSON_LINE_BYTES: usize = 2 * 1024 * 1024;
const ACTIVE_WINDOW_MS: i64 = 10_000;
const RECENT_FILE_WINDOW_MS: i64 = 5 * 60_000;
const WATCH_DEBOUNCE_MS: u64 = 350;
const CODEX_SESSIONS_EVENT: &str = "codex-sessions-update";
const CANDIDATE_DAYS: usize = 2;
const FALLBACK_STALE_RUNNING_MS: i64 = 2 * 60 * 60_000;

type SessionCache = HashMap<PathBuf, CachedSession>;

static CODEX_SESSION_CACHE: OnceLock<Mutex<SessionCache>> = OnceLock::new();
static CODEX_SESSION_WATCH_STARTED: AtomicBool = AtomicBool::new(false);

#[derive(Clone)]
struct CachedSession {
    summary: CodexSessionSummary,
    modified: i64,
    size: u64,
}

pub fn list_sessions(app: &AppHandle) -> Result<Vec<CodexSessionSummary>, String> {
    let base_dir = app
        .path()
        .home_dir()
        .map_err(|err| format!("无法获取用户目录: {err}"))?
        .join(CODEX_SESSIONS_DIR);

    if !base_dir.exists() {
        return Ok(Vec::new());
    }

    let files = collect_rollout_files(&base_dir)?;
    let mut seen = HashSet::new();
    let cache = CODEX_SESSION_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let mut cache = cache
        .lock()
        .map_err(|_| "Codex 会话缓存锁异常".to_string())?;

    let mut sessions = Vec::new();
    let now_ms = Utc::now().timestamp_millis();
    let recent_threshold = now_ms - RECENT_FILE_WINDOW_MS;
    for path in files {
        seen.insert(path.clone());
        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(err) => {
                log::warn!("读取 Codex 会话文件失败: path={} err={}", path.display(), err);
                continue;
            }
        };
        let modified = metadata
            .modified()
            .ok()
            .and_then(system_time_to_millis)
            .unwrap_or(0);
        let size = metadata.len();
        let is_cached = cache.contains_key(&path);
        let is_old = modified > 0 && modified < recent_threshold;
        if is_old && is_cached {
            continue;
        }
        let should_refresh = match cache.get(&path) {
            Some(cached) => cached.modified != modified || cached.size != size,
            None => true,
        };
        if should_refresh {
            match parse_session_file(&path) {
                Ok(summary) => {
                    cache.insert(
                        path.clone(),
                        CachedSession {
                            summary,
                            modified,
                            size,
                        },
                    );
                }
                Err(err) => {
                    log::warn!("解析 Codex 会话失败: path={} err={}", path.display(), err);
                }
            }
        }
    }

    cache.retain(|path, _| seen.contains(path));
    let mut any_codex_process: Option<bool> = None;
    for (path, cached) in cache.iter_mut() {
        if !cached.summary.is_running {
            continue;
        }
        let is_live = match codex_rollout_file_open_by_codex(path) {
            Some(live) => live,
            None => {
                let any = *any_codex_process.get_or_insert_with(any_codex_process_running);
                if !any {
                    false
                } else if cached.summary.last_activity_at > 0
                    && now_ms.saturating_sub(cached.summary.last_activity_at) > FALLBACK_STALE_RUNNING_MS
                {
                    false
                } else {
                    true
                }
            }
        };
        if is_live {
            sessions.push(cached.summary.clone());
        } else {
            // 文件不再被 Codex 进程占用，认为该 turn 已结束（包括进程被杀的情况）。
            cached.summary.is_running = false;
        }
    }

    sessions.sort_by(|left, right| right.last_activity_at.cmp(&left.last_activity_at));
    Ok(sessions)
}

pub fn ensure_session_watcher(app: &AppHandle) -> Result<(), String> {
    let base_dir = app
        .path()
        .home_dir()
        .map_err(|err| format!("无法获取用户目录: {err}"))?
        .join(CODEX_SESSIONS_DIR);

    if !base_dir.exists() {
        return Ok(());
    }

    if CODEX_SESSION_WATCH_STARTED
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(());
    }

    let app_handle = app.clone();
    thread::spawn(move || {
        let (tx, rx) = mpsc::channel();
        let mut watcher = match RecommendedWatcher::new(tx, notify::Config::default()) {
            Ok(watcher) => watcher,
            Err(error) => {
                log::warn!("启动 Codex 会话监听失败: {}", error);
                return;
            }
        };

        if let Err(error) = watcher.watch(&base_dir, RecursiveMode::Recursive) {
            log::warn!("监听 Codex 会话目录失败: {}", error);
            return;
        }

        event_loop(rx, app_handle);
    });

    Ok(())
}

fn event_loop(rx: Receiver<Result<notify::Event, notify::Error>>, app: AppHandle) {
    let mut pending = false;
    let mut last_emit = std::time::Instant::now()
        .checked_sub(Duration::from_millis(WATCH_DEBOUNCE_MS))
        .unwrap_or_else(std::time::Instant::now);

    loop {
        match rx.recv_timeout(Duration::from_millis(WATCH_DEBOUNCE_MS)) {
            Ok(Ok(event)) => {
                if should_refresh_for_event(&event) {
                    pending = true;
                    if last_emit.elapsed() >= Duration::from_millis(WATCH_DEBOUNCE_MS) {
                        pending = false;
                        last_emit = std::time::Instant::now();
                        emit_sessions(&app);
                    }
                }
            }
            Ok(Err(error)) => {
                log::warn!("Codex 会话监听错误: {}", error);
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if pending {
                    pending = false;
                    last_emit = std::time::Instant::now();
                    emit_sessions(&app);
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
}

fn should_refresh_for_event(event: &notify::Event) -> bool {
    let matches_kind = matches!(
        event.kind,
        EventKind::Create(_)
            | EventKind::Modify(_)
            | EventKind::Remove(_)
    );
    if !matches_kind {
        return false;
    }
    event.paths.iter().any(|path| is_rollout_file(path))
}

fn emit_sessions(app: &AppHandle) {
    match list_sessions(app) {
        Ok(sessions) => {
            if let Err(error) = app.emit(CODEX_SESSIONS_EVENT, sessions) {
                log::warn!("推送 Codex 会话更新失败: {}", error);
            }
        }
        Err(error) => {
            log::warn!("刷新 Codex 会话失败: {}", error);
        }
    }
}

fn collect_rollout_files(base_dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    let candidate_dirs = collect_candidate_dirs(base_dir);
    if candidate_dirs.is_empty() {
        collect_rollout_files_recursive(base_dir, &mut files)?;
    } else {
        for dir in candidate_dirs {
            collect_rollout_files_shallow(&dir, &mut files)?;
        }
    }
    Ok(files)
}

fn collect_candidate_dirs(base_dir: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    let mut date = Local::now().date_naive();
    for _ in 0..CANDIDATE_DAYS {
        let dir = build_date_dir(base_dir, date);
        if dir.exists() && dir.is_dir() {
            dirs.push(dir);
        }
        date = date.pred_opt().unwrap_or(date);
    }
    dirs
}

fn build_date_dir(base_dir: &Path, date: chrono::NaiveDate) -> PathBuf {
    base_dir
        .join(format!("{:04}", date.year()))
        .join(format!("{:02}", date.month()))
        .join(format!("{:02}", date.day()))
}

fn collect_rollout_files_shallow(dir: &Path, output: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|err| format!("读取目录失败: {err}"))?;
    for entry in entries {
        let entry = entry.map_err(|err| format!("读取目录项失败: {err}"))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        if is_rollout_file(&path) {
            output.push(path);
        }
    }
    Ok(())
}

fn collect_rollout_files_recursive(dir: &Path, output: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|err| format!("读取目录失败: {err}"))?;
    for entry in entries {
        let entry = entry.map_err(|err| format!("读取目录项失败: {err}"))?;
        let path = entry.path();
        if path.is_dir() {
            collect_rollout_files_recursive(&path, output)?;
            continue;
        }
        if !path.is_file() {
            continue;
        }
        if is_rollout_file(&path) {
            output.push(path);
        }
    }
    Ok(())
}

fn is_rollout_file(path: &Path) -> bool {
    let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };
    file_name.starts_with("rollout-") && file_name.ends_with(".jsonl")
}

fn parse_session_file(path: &Path) -> Result<CodexSessionSummary, String> {
    let meta = read_session_meta(path)?;
    let tail_lines = read_tail_lines_resilient(path, MAX_TAIL_LINES, MAX_TAIL_BYTES, MAX_TAIL_BYTES_CAP)?;

    let mut last_activity_at = meta.started_at;
    let mut last_user_ts: i64 = 0;
    let mut last_agent_ts: i64 = 0;
    let mut last_abort_ts: i64 = 0;

    for line in tail_lines {
        if line.trim().is_empty() {
            continue;
        }
        if line.len() > MAX_JSON_LINE_BYTES {
            continue;
        }
        let value: Value = match serde_json::from_str(&line) {
            Ok(parsed) => parsed,
            Err(_) => continue,
        };
        let timestamp = value
            .get("timestamp")
            .and_then(parse_timestamp)
            .unwrap_or(0);
        if timestamp > last_activity_at {
            last_activity_at = timestamp;
        }

        let typ = value.get("type").and_then(|item| item.as_str());
        let payload = value.get("payload");
        match typ {
            Some("event_msg") => {
                let event_type = payload
                    .and_then(|item| item.get("type"))
                    .and_then(|item| item.as_str());
                match event_type {
                    Some("user_message") => {
                        if timestamp > last_user_ts {
                            last_user_ts = timestamp;
                        }
                    }
                    Some("agent_message") => {
                        if timestamp > last_agent_ts {
                            last_agent_ts = timestamp;
                        }
                    }
                    Some("turn_aborted") => {
                        if timestamp > last_abort_ts {
                            last_abort_ts = timestamp;
                        }
                    }
                    _ => {}
                }
            }
            Some("response_item") => {
                // 兜底：部分情况下 event_msg 可能被裁剪/解析失败，使用 response_item 估算 turn 状态。
                let item_type = payload
                    .and_then(|item| item.get("type"))
                    .and_then(|item| item.as_str());
                if item_type != Some("message") {
                    continue;
                }
                let role = payload
                    .and_then(|item| item.get("role"))
                    .and_then(|item| item.as_str());
                match role {
                    Some("user") => {
                        if timestamp > last_user_ts {
                            last_user_ts = timestamp;
                        }
                    }
                    Some("assistant") => {
                        if timestamp > last_agent_ts {
                            last_agent_ts = timestamp;
                        }
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    }

    if last_activity_at <= 0 {
        if let Some(modified) = file_modified_millis(path) {
            last_activity_at = modified;
        }
    }

    let now_ms = Utc::now().timestamp_millis();
    // “运行中”的更稳判断：最近一次 user turn 是否还没被 assistant turn 响应/中止。
    // 这样能避免长时间无输出（例如执行长命令）被误判为完成。
    let pending_turn = last_user_ts > 0
        && last_user_ts > last_agent_ts
        && last_user_ts > last_abort_ts;
    let is_running = if last_user_ts > 0 {
        pending_turn
    } else {
        // 没找到 user/assistant 消息时保留短窗口兜底（例如刚创建会话但还没写入消息）。
        last_activity_at > 0 && now_ms.saturating_sub(last_activity_at) <= ACTIVE_WINDOW_MS
    };

    Ok(CodexSessionSummary {
        id: meta.id,
        cwd: meta.cwd,
        cli_version: meta.cli_version,
        started_at: meta.started_at,
        last_activity_at,
        is_running,
    })
}

struct SessionMeta {
    id: String,
    cwd: String,
    cli_version: Option<String>,
    started_at: i64,
}

fn read_session_meta(path: &Path) -> Result<SessionMeta, String> {
    let file = File::open(path).map_err(|err| format!("读取会话文件失败: {err}"))?;
    let mut reader = BufReader::new(file);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .map_err(|err| format!("读取会话首行失败: {err}"))?;
    if line.trim().is_empty() {
        return Err("会话文件为空".to_string());
    }
    let value: Value = serde_json::from_str(&line).map_err(|err| format!("解析会话首行失败: {err}"))?;
    if value.get("type").and_then(|item| item.as_str()) != Some("session_meta") {
        return Err("会话首行不是 session_meta".to_string());
    }
    let payload = value
        .get("payload")
        .ok_or_else(|| "session_meta 缺少 payload".to_string())?;
    let id = payload
        .get("id")
        .and_then(|item| item.as_str())
        .filter(|text| !text.is_empty())
        .map(|text| text.to_string())
        .or_else(|| fallback_session_id(path))
        .ok_or_else(|| "session_meta 缺少 id".to_string())?;
    let cwd = payload
        .get("cwd")
        .and_then(|item| item.as_str())
        .unwrap_or("")
        .to_string();
    let cli_version = payload
        .get("cli_version")
        .and_then(|item| item.as_str())
        .map(|text| text.to_string());
    let started_at = payload
        .get("timestamp")
        .and_then(parse_timestamp)
        .or_else(|| value.get("timestamp").and_then(parse_timestamp))
        .or_else(|| file_modified_millis(path))
        .unwrap_or(0);

    Ok(SessionMeta {
        id,
        cwd,
        cli_version,
        started_at,
    })
}

fn read_tail_lines(path: &Path, max_lines: usize, max_bytes: u64) -> Result<Vec<String>, String> {
    let mut file = File::open(path).map_err(|err| format!("读取会话文件失败: {err}"))?;
    let size = file
        .metadata()
        .map_err(|err| format!("读取文件元信息失败: {err}"))?
        .len();
    let start = if size > max_bytes { size - max_bytes } else { 0 };
    // 读取 start 前一个字节，用来判断是否处在行中间，避免误删完整首行。
    let read_start = if start > 0 { start.saturating_sub(1) } else { 0 };
    file.seek(SeekFrom::Start(read_start))
        .map_err(|err| format!("定位会话文件失败: {err}"))?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|err| format!("读取会话文件失败: {err}"))?;
    let text = String::from_utf8_lossy(&buffer);
    let mut lines: Vec<&str> = text.split('\n').collect();
    if read_start > 0 && !lines.is_empty() {
        // 无论 read_start 的字节是否为 '\n'，这里移除 split 的第一段都正确：
        // - 若 read_start 命中 '\n'，第一段为空字符串；
        // - 若 read_start 命中上一行末尾，则第一段是残缺行。
        lines.remove(0);
    }
    let mut trimmed: Vec<String> = lines
        .into_iter()
        .filter(|line| !line.trim().is_empty())
        .map(|line| line.to_string())
        .collect();
    if trimmed.len() > max_lines {
        trimmed = trimmed.split_off(trimmed.len() - max_lines);
    }
    Ok(trimmed)
}

fn read_tail_lines_resilient(
    path: &Path,
    max_lines: usize,
    initial_bytes: u64,
    max_bytes_cap: u64,
) -> Result<Vec<String>, String> {
    let size = fs::metadata(path)
        .map_err(|err| format!("读取文件元信息失败: {err}"))?
        .len();
    if size == 0 {
        return Ok(Vec::new());
    }
    let mut bytes = initial_bytes.min(size).max(1024);
    loop {
        let lines = read_tail_lines(path, max_lines, bytes)?;
        if !lines.is_empty() || bytes >= size || bytes >= max_bytes_cap {
            return Ok(lines);
        }
        bytes = bytes
            .saturating_mul(2)
            .min(size)
            .min(max_bytes_cap);
    }
}

fn parse_timestamp(value: &Value) -> Option<i64> {
    value
        .as_str()
        .and_then(|text| chrono::DateTime::parse_from_rfc3339(text).ok())
        .map(|dt| dt.timestamp_millis())
}

fn fallback_session_id(path: &Path) -> Option<String> {
    path.file_stem()
        .and_then(|value| value.to_str())
        .map(|text| text.to_string())
}

fn file_modified_millis(path: &Path) -> Option<i64> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    system_time_to_millis(modified)
}

fn system_time_to_millis(time: SystemTime) -> Option<i64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as i64)
}

fn codex_rollout_file_open_by_codex(path: &Path) -> Option<bool> {
    if !(cfg!(target_os = "macos") || cfg!(target_os = "linux")) {
        return None;
    }

    // 通过 lsof 判断该 rollout 文件是否仍被 codex 进程打开。
    //
    // 注意：lsof 在不同平台/版本下 exit code 的语义并不稳定，且 selection 规则容易踩到 “OR” 逻辑坑：
    // - 直接用 `-c codex <file>` 可能会匹配 “命令名为 codex 的进程” *或* “打开了该文件的进程”，导致误判。
    // 因此这里不依赖 exit code，而是用 `-F pc` 输出机器可解析格式，并检查是否存在 command=codex 的条目。
    //
    // 这样也能避免 DevHaven 自己短暂读取 session 文件时被误判：只要 command 不是 codex，就不会返回 true。
    let args = ["-n", "-P", "-F", "pc", "--"];
    let output = run_lsof_output_with_fallback(&args, path)?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim().is_empty() {
        // 有些环境下 lsof 失败也可能给空 stdout；此时看一下 stderr，避免把“不可用”误判成“未运行”。
        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.trim().is_empty() {
            let stderr_lower = stderr.to_ascii_lowercase();
            if stderr_lower.contains("no such file")
                || stderr_lower.contains("no such file or directory")
                || stderr_lower.contains("status error")
            {
                return Some(false);
            }
            return None;
        }
        return Some(false);
    }

    Some(lsof_stdout_indicates_codex_open(&stdout))
}

fn lsof_stdout_indicates_codex_open(stdout: &str) -> bool {
    stdout.lines().any(|line| {
        let Some(command) = line.strip_prefix('c') else {
            return false;
        };
        let name = command.trim().to_ascii_lowercase();
        name == "codex" || name == "codex.exe"
    })
}

fn run_lsof_output_with_fallback(args: &[&str], path: &Path) -> Option<std::process::Output> {
    match Command::new("lsof").args(args).arg(path).output() {
        Ok(output) => Some(output),
        Err(error) => {
            if error.kind() != std::io::ErrorKind::NotFound {
                log::debug!("运行 lsof 失败: {}", error);
                return None;
            }

            // Tauri 打包后 PATH 可能不包含 sbin，尝试常见绝对路径。
            for candidate in ["/usr/sbin/lsof", "/usr/bin/lsof"] {
                match Command::new(candidate).args(args).arg(path).output() {
                    Ok(output) => return Some(output),
                    Err(_) => continue,
                }
            }
            None
        }
    }
}

fn any_codex_process_running() -> bool {
    let mut system = System::new();
    system.refresh_processes();
    system.processes().values().any(|process| {
        let name = process.name().to_ascii_lowercase();
        name == "codex" || name == "codex.exe"
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn lsof_stdout_indicates_codex_open_detects_codex_entries() {
        let sample = "p30581\nccodex\nf28\np123\ncdevhaven\nf42\n";
        assert!(lsof_stdout_indicates_codex_open(sample));
        assert!(!lsof_stdout_indicates_codex_open("p1\ncdevhaven\nf10\n"));
        assert!(!lsof_stdout_indicates_codex_open(""));
    }

    #[test]
    fn parse_session_file_extracts_metadata_and_activity() {
        let dir = std::env::temp_dir().join(format!("devhaven-codex-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("create temp dir");
        let path = dir.join("rollout-test.jsonl");
        let content = [
            r#"{"timestamp":"2026-01-28T05:07:13.570Z","type":"session_meta","payload":{"id":"abc","timestamp":"2026-01-28T05:07:13.545Z","cwd":"/tmp/project","cli_version":"0.92.0"}}"#,
            r#"{"timestamp":"2026-01-28T05:08:13.000Z","type":"event_msg","payload":{"type":"user_message","message":"hi"}}"#,
            r#"{"timestamp":"2026-01-28T05:08:20.000Z","type":"event_msg","payload":{"type":"agent_message","message":"hello"}}"#,
        ]
        .join("\n");
        fs::write(&path, content).expect("write temp file");

        let summary = parse_session_file(&path).expect("parse session");
        assert_eq!(summary.id, "abc");
        assert_eq!(summary.cwd, "/tmp/project");
        assert!(summary.last_activity_at >= summary.started_at);
    }

    #[test]
    fn parse_session_file_marks_pending_turn_as_running() {
        let dir = std::env::temp_dir().join(format!("devhaven-codex-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("create temp dir");
        let path = dir.join("rollout-test.jsonl");
        let content = [
            r#"{"timestamp":"2026-01-28T05:07:13.570Z","type":"session_meta","payload":{"id":"abc","timestamp":"2026-01-28T05:07:13.545Z","cwd":"/tmp/project","cli_version":"0.92.0"}}"#,
            r#"{"timestamp":"2026-01-28T05:08:13.000Z","type":"event_msg","payload":{"type":"user_message","message":"hi"}}"#,
        ]
        .join("\n");
        fs::write(&path, content).expect("write temp file");

        let summary = parse_session_file(&path).expect("parse session");
        assert!(summary.is_running, "pending user turn should be running");
    }

    #[test]
    fn parse_session_file_marks_aborted_turn_as_not_running() {
        let dir = std::env::temp_dir().join(format!("devhaven-codex-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("create temp dir");
        let path = dir.join("rollout-test.jsonl");
        let content = [
            r#"{"timestamp":"2026-01-28T05:07:13.570Z","type":"session_meta","payload":{"id":"abc","timestamp":"2026-01-28T05:07:13.545Z","cwd":"/tmp/project","cli_version":"0.92.0"}}"#,
            r#"{"timestamp":"2026-01-28T05:08:13.000Z","type":"event_msg","payload":{"type":"user_message","message":"hi"}}"#,
            r#"{"timestamp":"2026-01-28T05:08:20.000Z","type":"event_msg","payload":{"type":"turn_aborted"}}"#,
        ]
        .join("\n");
        fs::write(&path, content).expect("write temp file");

        let summary = parse_session_file(&path).expect("parse session");
        assert!(!summary.is_running, "aborted user turn should not be running");
    }
}
