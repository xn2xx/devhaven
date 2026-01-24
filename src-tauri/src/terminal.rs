use std::io::{Read, Write};
use std::process::Command;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter};

const TMUX_OUTPUT_EVENT: &str = "tmux-output";
const TMUX_STATE_EVENT: &str = "tmux-state";
const TMUX_BIN: &str = "tmux";
const TMUX_PANE_BORDER_STYLE: &str = "fg=#586e75,bg=default";
const TMUX_PANE_ACTIVE_BORDER_STYLE: &str = "fg=#268bd2,bg=default";
const TMUX_SESSION_PREFIX: &str = "devhaven_";

#[derive(Clone, serde::Serialize)]
pub struct TerminalSessionInfo {
    pub id: String,
    pub project_id: String,
    pub project_path: String,
    pub created_at: i64,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TmuxWindowInfo {
    pub id: String,
    pub index: i32,
    pub name: String,
    pub is_active: bool,
    pub width: u16,
    pub height: u16,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TmuxPaneInfo {
    pub id: String,
    pub left: u16,
    pub top: u16,
    pub width: u16,
    pub height: u16,
    pub is_active: bool,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TmuxSupportStatus {
    pub supported: bool,
    pub reason: Option<String>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TmuxOutputPayload {
    pane_id: String,
    data: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TmuxStatePayload {
    kind: String,
    session_name: Option<String>,
    window_id: Option<String>,
}

pub struct TerminalManager {
    control: Option<TmuxControlClient>,
    active_session: Option<String>,
}

#[allow(dead_code)]
struct TmuxControlClient {
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Box<dyn portable_pty::Child + Send>>,
    alive: Arc<AtomicBool>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            control: None,
            active_session: None,
        }
    }

    pub fn is_supported(&self) -> bool {
        cfg!(target_os = "macos") && is_tmux_available()
    }

    pub fn create_session(
        &mut self,
        app: AppHandle,
        project_id: &str,
        project_path: &str,
    ) -> Result<TerminalSessionInfo, String> {
        ensure_supported()?;
        let session_name = session_name_for_project(project_id);
        if !tmux_session_exists(&session_name)? {
            run_tmux_status(&[
                "new-session".to_string(),
                "-d".to_string(),
                "-s".to_string(),
                session_name.clone(),
                "-c".to_string(),
                project_path.to_string(),
            ])?;
        }

        self.ensure_control_client(app)?;
        self.switch_session_internal(&session_name)?;
        apply_tmux_pane_style(&session_name)?;

        Ok(TerminalSessionInfo {
            id: session_name,
            project_id: project_id.to_string(),
            project_path: project_path.to_string(),
            created_at: chrono::Utc::now().timestamp_millis(),
        })
    }

    pub fn switch_session(&mut self, app: AppHandle, session_id: &str) -> Result<(), String> {
        ensure_supported()?;
        self.ensure_control_client(app)?;
        self.switch_session_internal(session_id)?;
        apply_tmux_pane_style(session_id)
    }

    pub fn close_session(&mut self, session_id: &str) -> Result<(), String> {
        if self.active_session.as_deref() == Some(session_id) {
            self.active_session = None;
        }
        Ok(())
    }

    pub fn list_windows(&self, session_id: &str) -> Result<Vec<TmuxWindowInfo>, String> {
        ensure_supported()?;
        let output = run_tmux_command(&[
            "list-windows".to_string(),
            "-t".to_string(),
            session_id.to_string(),
            "-F".to_string(),
            "#{window_id}\t#{window_index}\t#{window_name}\t#{window_active}\t#{window_width}\t#{window_height}"
                .to_string(),
        ])?;

        let mut windows = Vec::new();
        for line in output.lines() {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() < 6 {
                continue;
            }
            let index = parts[1].parse::<i32>().unwrap_or(0);
            let is_active = parse_tmux_flag(parts[3]);
            let width = parts[4].parse::<u16>().unwrap_or(0);
            let height = parts[5].parse::<u16>().unwrap_or(0);
            windows.push(TmuxWindowInfo {
                id: parts[0].to_string(),
                index,
                name: parts[2].to_string(),
                is_active,
                width,
                height,
            });
        }

        Ok(windows)
    }

    pub fn list_panes(&self, window_id: &str) -> Result<Vec<TmuxPaneInfo>, String> {
        ensure_supported()?;
        let output = run_tmux_command(&[
            "list-panes".to_string(),
            "-t".to_string(),
            window_id.to_string(),
            "-F".to_string(),
            "#{pane_id}\t#{pane_left}\t#{pane_top}\t#{pane_width}\t#{pane_height}\t#{pane_active}"
                .to_string(),
        ])?;

        let mut panes = Vec::new();
        for line in output.lines() {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() < 6 {
                continue;
            }
            panes.push(TmuxPaneInfo {
                id: parts[0].to_string(),
                left: parts[1].parse::<u16>().unwrap_or(0),
                top: parts[2].parse::<u16>().unwrap_or(0),
                width: parts[3].parse::<u16>().unwrap_or(0),
                height: parts[4].parse::<u16>().unwrap_or(0),
                is_active: parse_tmux_flag(parts[5]),
            });
        }

        Ok(panes)
    }

    pub fn send_input(&self, pane_id: &str, data: &str) -> Result<(), String> {
        ensure_supported()?;
        if data.is_empty() {
            return Ok(());
        }
        let mut args = Vec::with_capacity(4 + data.len());
        args.push("send-keys".to_string());
        args.push("-H".to_string());
        args.push("-t".to_string());
        args.push(pane_id.to_string());
        for byte in data.as_bytes() {
            args.push(format!("{:02x}", byte));
        }
        run_tmux_status(&args)
    }

    pub fn split_pane(&self, pane_id: &str, direction: &str) -> Result<(), String> {
        ensure_supported()?;
        let flag = match direction {
            "vertical" => "-v",
            _ => "-h",
        };
        run_tmux_status(&[
            "split-window".to_string(),
            flag.to_string(),
            "-t".to_string(),
            pane_id.to_string(),
            "-c".to_string(),
            "#{pane_current_path}".to_string(),
        ])
    }

    pub fn select_pane(&self, pane_id: &str) -> Result<(), String> {
        ensure_supported()?;
        run_tmux_status(&[
            "select-pane".to_string(),
            "-t".to_string(),
            pane_id.to_string(),
        ])
    }

    pub fn select_pane_direction(&self, pane_id: &str, direction: &str) -> Result<(), String> {
        ensure_supported()?;
        let flag = match direction {
            "left" => "-L",
            "right" => "-R",
            "up" => "-U",
            "down" => "-D",
            _ => return Err("未知的 pane 方向".to_string()),
        };
        run_tmux_status(&[
            "select-pane".to_string(),
            flag.to_string(),
            "-t".to_string(),
            pane_id.to_string(),
        ])
    }

    pub fn resize_pane(&self, pane_id: &str, direction: &str, count: u16) -> Result<(), String> {
        ensure_supported()?;
        if count == 0 {
            return Ok(());
        }
        let flag = match direction {
            "left" => "-L",
            "right" => "-R",
            "up" => "-U",
            "down" => "-D",
            _ => return Err("未知的 pane 方向".to_string()),
        };
        run_tmux_status(&[
            "resize-pane".to_string(),
            flag.to_string(),
            "-t".to_string(),
            pane_id.to_string(),
            count.to_string(),
        ])
    }

    pub fn kill_pane(&self, pane_id: &str) -> Result<(), String> {
        ensure_supported()?;
        run_tmux_status(&[
            "kill-pane".to_string(),
            "-t".to_string(),
            pane_id.to_string(),
        ])
    }

    pub fn new_window(&self, session_id: &str, project_path: &str) -> Result<(), String> {
        ensure_supported()?;
        run_tmux_status(&[
            "new-window".to_string(),
            "-t".to_string(),
            session_id.to_string(),
            "-c".to_string(),
            project_path.to_string(),
        ])
    }

    pub fn select_window(&self, window_id: &str) -> Result<(), String> {
        ensure_supported()?;
        run_tmux_status(&[
            "select-window".to_string(),
            "-t".to_string(),
            window_id.to_string(),
        ])
    }

    pub fn select_window_index(&self, session_id: &str, window_index: i32) -> Result<(), String> {
        ensure_supported()?;
        let target = format!("{}:{}", session_id, window_index);
        run_tmux_status(&[
            "select-window".to_string(),
            "-t".to_string(),
            target,
        ])
    }

    pub fn next_window(&self) -> Result<(), String> {
        ensure_supported()?;
        run_tmux_status(&["select-window".to_string(), "-n".to_string()])
    }

    pub fn previous_window(&self) -> Result<(), String> {
        ensure_supported()?;
        run_tmux_status(&["select-window".to_string(), "-p".to_string()])
    }

    pub fn resize_client(&mut self, app: AppHandle, cols: u16, rows: u16) -> Result<(), String> {
        ensure_supported()?;
        self.ensure_control_client(app)?;
        let command = format!("refresh-client -C {}x{}", cols, rows);
        self.send_control_command(&command)
    }

    pub fn capture_pane(&self, pane_id: &str) -> Result<String, String> {
        ensure_supported()?;
        run_tmux_command(&[
            "capture-pane".to_string(),
            "-pJ".to_string(),
            "-t".to_string(),
            pane_id.to_string(),
        ])
    }

    fn ensure_control_client(&mut self, app: AppHandle) -> Result<(), String> {
        if let Some(control) = self.control.as_ref() {
            if control.alive.load(Ordering::SeqCst) {
                return Ok(());
            }
        }
        self.control = Some(spawn_tmux_control_client(app)?);
        Ok(())
    }

    fn switch_session_internal(&mut self, session_id: &str) -> Result<(), String> {
        self.send_control_command(&format!("switch-client -t {}", session_id))?;
        self.active_session = Some(session_id.to_string());
        Ok(())
    }

    fn send_control_command(&self, command: &str) -> Result<(), String> {
        let control = self
            .control
            .as_ref()
            .ok_or_else(|| "控制客户端未启动".to_string())?;
        let mut writer = control
            .writer
            .lock()
            .map_err(|_| "控制客户端锁异常".to_string())?;
        writer
            .write_all(command.as_bytes())
            .map_err(|err| format!("控制命令写入失败: {err}"))?;
        writer
            .write_all(b"\n")
            .map_err(|err| format!("控制命令写入失败: {err}"))?;
        writer
            .flush()
            .map_err(|err| format!("控制命令写入失败: {err}"))?;
        Ok(())
    }
}

pub fn tmux_support_status() -> TmuxSupportStatus {
    if !cfg!(target_os = "macos") {
        return TmuxSupportStatus {
            supported: false,
            reason: Some("tmux 工作空间仅支持 macOS".to_string()),
        };
    }
    if !is_tmux_available() {
        return TmuxSupportStatus {
            supported: false,
            reason: Some("未检测到 tmux，请先安装 tmux".to_string()),
        };
    }
    TmuxSupportStatus {
        supported: true,
        reason: None,
    }
}

fn ensure_supported() -> Result<(), String> {
    if !cfg!(target_os = "macos") {
        return Err("tmux 工作空间仅支持 macOS".to_string());
    }
    if !is_tmux_available() {
        return Err("未检测到 tmux，请先安装 tmux".to_string());
    }
    Ok(())
}

fn is_tmux_available() -> bool {
    Command::new(TMUX_BIN)
        .arg("-V")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn tmux_session_exists(session_id: &str) -> Result<bool, String> {
    let output = Command::new(TMUX_BIN)
        .args(["has-session", "-t", session_id])
        .output()
        .map_err(|err| format!("tmux 命令执行失败: {err}"))?;
    Ok(output.status.success())
}

fn run_tmux_command(args: &[String]) -> Result<String, String> {
    let output = Command::new(TMUX_BIN)
        .args(args)
        .output()
        .map_err(|err| format!("tmux 命令执行失败: {err}"))?;
    if !output.status.success() {
        return Err(format!(
            "tmux 命令执行失败: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn run_tmux_status(args: &[String]) -> Result<(), String> {
    let output = Command::new(TMUX_BIN)
        .args(args)
        .output()
        .map_err(|err| format!("tmux 命令执行失败: {err}"))?;
    if !output.status.success() {
        return Err(format!(
            "tmux 命令执行失败: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

fn apply_tmux_pane_style(session_id: &str) -> Result<(), String> {
    run_tmux_status(&[
        "set-option".to_string(),
        "-t".to_string(),
        session_id.to_string(),
        "pane-border-style".to_string(),
        TMUX_PANE_BORDER_STYLE.to_string(),
    ])?;
    run_tmux_status(&[
        "set-option".to_string(),
        "-t".to_string(),
        session_id.to_string(),
        "pane-active-border-style".to_string(),
        TMUX_PANE_ACTIVE_BORDER_STYLE.to_string(),
    ])
}

fn parse_tmux_flag(value: &str) -> bool {
    matches!(value, "1" | "true" | "yes")
}

fn session_name_for_project(project_id: &str) -> String {
    let sanitized: String = project_id
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' { ch } else { '_' })
        .collect();
    format!("{TMUX_SESSION_PREFIX}{sanitized}")
}

fn spawn_tmux_control_client(app: AppHandle) -> Result<TmuxControlClient, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| format!("创建 tmux 控制终端失败: {err}"))?;

    let mut command = CommandBuilder::new(TMUX_BIN);
    command.arg("-CC");
    command.env("TERM", "xterm-256color");

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|err| format!("启动 tmux 控制模式失败: {err}"))?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|err| format!("读取 tmux 输出失败: {err}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|err| format!("获取 tmux 写入器失败: {err}"))?;

    let alive = Arc::new(AtomicBool::new(true));
    spawn_tmux_reader(app, reader, Arc::clone(&alive));

    Ok(TmuxControlClient {
        master: Mutex::new(pair.master),
        writer: Mutex::new(writer),
        child: Mutex::new(child),
        alive,
    })
}

fn spawn_tmux_reader(app: AppHandle, mut reader: Box<dyn Read + Send>, alive: Arc<AtomicBool>) {
    thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        let mut pending = String::new();
        let mut pending_bytes: Vec<u8> = Vec::new();
        while alive.load(Ordering::SeqCst) {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    pending_bytes.extend_from_slice(&buffer[..size]);
                    let chunk = drain_utf8_bytes(&mut pending_bytes);
                    if !chunk.is_empty() {
                        pending.push_str(&chunk);
                    }
                    while let Some(pos) = pending.find('\n') {
                        let line = pending[..pos].trim_end_matches('\r').to_string();
                        pending = pending[pos + 1..].to_string();
                        handle_tmux_line(&app, &line, &alive);
                    }
                }
                Err(_) => break,
            }
        }
        alive.store(false, Ordering::SeqCst);
    });
}

fn drain_utf8_bytes(buffer: &mut Vec<u8>) -> String {
    let mut output = String::new();
    loop {
        match std::str::from_utf8(buffer) {
            Ok(valid) => {
                output.push_str(valid);
                buffer.clear();
                break;
            }
            Err(err) => {
                let valid_up_to = err.valid_up_to();
                if valid_up_to > 0 {
                    let valid = std::str::from_utf8(&buffer[..valid_up_to]).unwrap_or("");
                    output.push_str(valid);
                    buffer.drain(..valid_up_to);
                }
                match err.error_len() {
                    None => break,
                    Some(len) => {
                        buffer.drain(..len);
                        output.push(std::char::REPLACEMENT_CHARACTER);
                    }
                }
            }
        }
    }
    output
}

fn handle_tmux_line(app: &AppHandle, line: &str, alive: &Arc<AtomicBool>) {
    if line.starts_with("%output ") {
        let rest = &line[8..];
        let mut parts = rest.splitn(2, ' ');
        let pane_id = parts.next().unwrap_or("").trim();
        let raw = parts.next().unwrap_or("");
        if !pane_id.is_empty() {
            let data = decode_tmux_output(raw);
            let _ = app.emit(
                TMUX_OUTPUT_EVENT,
                TmuxOutputPayload {
                    pane_id: pane_id.to_string(),
                    data,
                },
            );
        }
        return;
    }

    if line.starts_with("%layout-change ") {
        let window_id = line.split_whitespace().nth(1).map(|value| value.to_string());
        emit_tmux_state(app, "layout-change", None, window_id);
        return;
    }

    if line.starts_with("%window-pane-changed ") {
        let window_id = line.split_whitespace().nth(1).map(|value| value.to_string());
        emit_tmux_state(app, "window-pane-changed", None, window_id);
        return;
    }

    if line.starts_with("%window-add ")
        || line.starts_with("%window-close ")
        || line.starts_with("%window-renamed ")
        || line.starts_with("%unlinked-window-add ")
        || line.starts_with("%unlinked-window-close ")
        || line.starts_with("%unlinked-window-renamed ")
        || line.starts_with("%sessions-changed")
    {
        emit_tmux_state(app, "windows-changed", None, None);
        return;
    }

    if line.starts_with("%session-changed ") || line.starts_with("%client-session-changed ") {
        let session_name = if line.starts_with("%client-session-changed ") {
            line.split_whitespace().nth(3).map(|value| value.to_string())
        } else {
            line.split_whitespace().nth(2).map(|value| value.to_string())
        };
        emit_tmux_state(app, "session-changed", session_name, None);
        return;
    }

    if line.starts_with("%exit") {
        alive.store(false, Ordering::SeqCst);
        emit_tmux_state(app, "client-exit", None, None);
    }
}

fn emit_tmux_state(app: &AppHandle, kind: &str, session_name: Option<String>, window_id: Option<String>) {
    let _ = app.emit(
        TMUX_STATE_EVENT,
        TmuxStatePayload {
            kind: kind.to_string(),
            session_name,
            window_id,
        },
    );
}

fn decode_tmux_output(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'\\' && i + 3 < bytes.len() {
            let b1 = bytes[i + 1];
            let b2 = bytes[i + 2];
            let b3 = bytes[i + 3];
            if is_octal_digit(b1) && is_octal_digit(b2) && is_octal_digit(b3) {
                let value = (b1 - b'0') * 64 + (b2 - b'0') * 8 + (b3 - b'0');
                out.push(value);
                i += 4;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    // 使用 drain_utf8_bytes 来正确处理 UTF-8 边界
    // 虽然 tmux 控制模式通常保证完整的 UTF-8 序列，但在快速输入时
    // 八进制解码后可能产生不完整的字节序列，需要正确处理
    drain_utf8_bytes(&mut out)
}

fn is_octal_digit(value: u8) -> bool {
    value >= b'0' && value <= b'7'
}
