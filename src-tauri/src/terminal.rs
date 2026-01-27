use std::collections::HashMap;
use std::ffi::OsString;
use std::io::{Read, Write};
use std::path::Path;
use std::process::Command;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc::{self, Receiver, Sender},
    Arc, Mutex,
};
use std::thread;
use std::time::Duration;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter};

// 获取用户的 HOME 目录
fn get_user_home() -> Option<String> {
    // 优先使用环境变量
    if let Ok(home) = std::env::var("HOME") {
        if !home.is_empty() {
            return Some(home);
        }
    }

    // 使用 macOS 系统调用获取
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CStr;

        extern "C" {
            fn getpwuid(uid: u32) -> *const libc::passwd;
            fn getuid() -> u32;
        }

        unsafe {
            let uid = getuid();
            let pw = getpwuid(uid);
            if !pw.is_null() {
                let home_dir = (*pw).pw_dir;
                if !home_dir.is_null() {
                    if let Ok(home_str) = CStr::from_ptr(home_dir).to_str() {
                        return Some(home_str.to_string());
                    }
                }
            }
        }
    }

    None
}

// 获取用户的默认 shell
fn get_user_shell() -> String {
    // 优先使用环境变量
    if let Ok(shell) = std::env::var("SHELL") {
        if !shell.is_empty() && Path::new(&shell).exists() {
            return shell;
        }
    }

    // 使用 macOS 系统调用获取
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CStr;

        extern "C" {
            fn getpwuid(uid: u32) -> *const libc::passwd;
            fn getuid() -> u32;
        }

        unsafe {
            let uid = getuid();
            let pw = getpwuid(uid);
            if !pw.is_null() {
                let shell_path = (*pw).pw_shell;
                if !shell_path.is_null() {
                    if let Ok(shell_str) = CStr::from_ptr(shell_path).to_str() {
                        let shell = shell_str.to_string();
                        if Path::new(&shell).exists() {
                            return shell;
                        }
                    }
                }
            }
        }
    }

    // 回退到常见的 shell
    if Path::new("/bin/zsh").exists() {
        "/bin/zsh".to_string()
    } else if Path::new("/bin/bash").exists() {
        "/bin/bash".to_string()
    } else {
        "/bin/sh".to_string()
    }
}

struct TmuxEnv {
    path: String,
    shell: String,
    home: Option<String>,
    lang: String,
    lc_all: String,
    term: String,
}

impl TmuxEnv {
    fn apply_to_command(&self, cmd: &mut Command) {
        cmd.env("PATH", &self.path);
        cmd.env("SHELL", &self.shell);
        cmd.env("LANG", &self.lang);
        cmd.env("LC_ALL", &self.lc_all);
        cmd.env("TERM", &self.term);
        if let Some(home) = &self.home {
            cmd.env("HOME", home);
        }
    }

    fn apply_to_builder(&self, cmd: &mut CommandBuilder) {
        cmd.env("PATH", &self.path);
        cmd.env("SHELL", &self.shell);
        cmd.env("LANG", &self.lang);
        cmd.env("LC_ALL", &self.lc_all);
        cmd.env("TERM", &self.term);
        if let Some(home) = &self.home {
            cmd.env("HOME", home);
        }
    }
}

const TMUX_OUTPUT_EVENT: &str = "tmux-output";
const TMUX_STATE_EVENT: &str = "tmux-state";
const TMUX_BIN: &str = "tmux";
const TMUX_BIN_ENV: &str = "DEVHAVEN_TMUX_BIN";
const TMUX_BIN_CANDIDATES: [&str; 4] = [
    "/opt/homebrew/bin/tmux",
    "/usr/local/bin/tmux",
    "/opt/local/bin/tmux",
    "/usr/bin/tmux",
];
const TMUX_PANE_BORDER_STYLE: &str = "fg=#586e75,bg=default";
const TMUX_PANE_ACTIVE_BORDER_STYLE: &str = "fg=#268bd2,bg=default";
const TMUX_HISTORY_LIMIT: &str = "200000";
const CONTROL_COMMAND_TIMEOUT_MS: u64 = 2500;
const CONTROL_COMMAND_QUEUE_POLL_MS: u64 = 100;
const LEGACY_TMUX_SESSION_PREFIX: &str = "devhaven_";
const DEFAULT_PATH: &str =
    "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/opt/local/bin";

fn build_tmux_env() -> TmuxEnv {
    let current_path = std::env::var("PATH").unwrap_or_else(|_| DEFAULT_PATH.to_string());
    let full_path = if current_path.contains("/opt/homebrew/bin") && current_path.contains("/usr/local/bin") {
        current_path
    } else {
        format!("{}:{}", DEFAULT_PATH, current_path)
    };
    let shell = get_user_shell();
    let home = get_user_home();
    let lang = std::env::var("LANG")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "en_US.UTF-8".to_string());
    let lc_all = std::env::var("LC_ALL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| lang.clone());
    let term = std::env::var("TERM")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "xterm-256color".to_string());

    TmuxEnv {
        path: full_path,
        shell,
        home,
        lang,
        lc_all,
        term,
    }
}

fn resolve_tmux_bin() -> OsString {
    if let Some(path) = std::env::var_os(TMUX_BIN_ENV) {
        if Path::new(&path).is_file() {
            return path;
        }
    }
    for candidate in TMUX_BIN_CANDIDATES {
        if Path::new(candidate).is_file() {
            return OsString::from(candidate);
        }
    }
    OsString::from(TMUX_BIN)
}

fn tmux_command() -> Command {
    let mut cmd = Command::new(resolve_tmux_bin());
    let tmux_env = build_tmux_env();
    tmux_env.apply_to_command(&mut cmd);

    cmd
}

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
pub struct TmuxPaneCursor {
    pub col: u16,
    pub row: u16,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TmuxOutputPayload {
    session_id: String,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ControlModeState {
    Recovery,
    Idle,
    InResponse,
    Exiting,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ResponseBlock {
    id: String,
    number: String,
}

#[derive(Debug)]
enum ControlCommandResult {
    Ok,
    Error(String),
}

struct ControlCommand {
    command: String,
    result_tx: Sender<ControlCommandResult>,
}

struct ControlParserState {
    mode: ControlModeState,
    recovery_pending: bool,
    current_response: Option<ResponseBlock>,
    pending_completion: Option<Sender<ControlCommandResult>>,
}

impl ControlParserState {
    fn new() -> Self {
        Self {
            mode: ControlModeState::Recovery,
            recovery_pending: true,
            current_response: None,
            pending_completion: None,
        }
    }
}

pub struct TerminalManager {
    controls: HashMap<String, TmuxControlClient>,
    active_session_id: Option<String>,
}

#[allow(dead_code)]
struct TmuxControlClient {
    master: Mutex<Box<dyn MasterPty + Send>>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
    alive: Arc<AtomicBool>,
    parser_state: Arc<Mutex<ControlParserState>>,
    command_tx: Sender<ControlCommand>,
}

impl TmuxControlClient {
    fn is_alive(&self) -> bool {
        self.alive.load(Ordering::SeqCst)
    }

    fn enqueue_command(&self, command: String) -> Result<Receiver<ControlCommandResult>, String> {
        let (result_tx, result_rx) = mpsc::channel();
        let payload = ControlCommand { command, result_tx };
        self.command_tx
            .send(payload)
            .map_err(|_| "控制命令队列已关闭".to_string())?;
        Ok(result_rx)
    }
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            controls: HashMap::new(),
            active_session_id: None,
        }
    }

    pub fn create_session(
        &mut self,
        app: AppHandle,
        project_id: &str,
        project_path: &str,
        project_name: &str,
    ) -> Result<TerminalSessionInfo, String> {
        ensure_supported()?;
        let session_name = session_name_for_project(project_name);
        if !tmux_session_exists(&session_name)? {
            let legacy_session_name = legacy_session_name_for_project_id(project_id);
            if tmux_session_exists(&legacy_session_name)? {
                rename_tmux_session(&legacy_session_name, &session_name)?;
            } else {
                // 使用系统调用获取 shell 路径
                let shell_path = get_user_shell();

                run_tmux_status(&[
                    "new-session".to_string(),
                    "-d".to_string(),
                    "-s".to_string(),
                    session_name.clone(),
                    "-c".to_string(),
                    project_path.to_string(),
                    shell_path, // 显式指定 shell
                ])?;
            }
        }

        self.ensure_control_client(app, &session_name)?;
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
        self.ensure_control_client(app, session_id)?;
        self.active_session_id = Some(session_id.to_string());
        apply_tmux_pane_style(session_id)
    }

    pub fn close_session(&mut self, session_id: &str) -> Result<(), String> {
        self.drop_control_client(session_id);
        if self.active_session_id.as_deref() == Some(session_id) {
            self.active_session_id = None;
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
        let command = tmux_command_string(&[
            "split-window",
            flag,
            "-t",
            pane_id,
            "-c",
            "#{pane_current_path}",
        ]);
        self.send_control_or_fallback(None, &command, || {
            run_tmux_status(&[
                "split-window".to_string(),
                flag.to_string(),
                "-t".to_string(),
                pane_id.to_string(),
                "-c".to_string(),
                "#{pane_current_path}".to_string(),
            ])
        })
    }

    pub fn select_pane(&self, pane_id: &str) -> Result<(), String> {
        ensure_supported()?;
        let command = tmux_command_string(&["select-pane", "-t", pane_id]);
        self.send_control_or_fallback(None, &command, || {
            run_tmux_status(&[
                "select-pane".to_string(),
                "-t".to_string(),
                pane_id.to_string(),
            ])
        })
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
        let command = tmux_command_string(&["select-pane", flag, "-t", pane_id]);
        self.send_control_or_fallback(None, &command, || {
            run_tmux_status(&[
                "select-pane".to_string(),
                flag.to_string(),
                "-t".to_string(),
                pane_id.to_string(),
            ])
        })
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
        let count_value = count.to_string();
        let command = tmux_command_string(&["resize-pane", flag, "-t", pane_id, &count_value]);
        self.send_control_or_fallback(None, &command, || {
            run_tmux_status(&[
                "resize-pane".to_string(),
                flag.to_string(),
                "-t".to_string(),
                pane_id.to_string(),
                count_value,
            ])
        })
    }

    pub fn kill_pane(&self, pane_id: &str) -> Result<(), String> {
        ensure_supported()?;
        let command = tmux_command_string(&["kill-pane", "-t", pane_id]);
        self.send_control_or_fallback(None, &command, || {
            run_tmux_status(&[
                "kill-pane".to_string(),
                "-t".to_string(),
                pane_id.to_string(),
            ])
        })
    }

    pub fn new_window(&self, session_id: &str, project_path: &str) -> Result<(), String> {
        ensure_supported()?;
        let command = tmux_command_string(&["new-window", "-t", session_id, "-c", project_path]);
        self.send_control_or_fallback(Some(session_id), &command, || {
            run_tmux_status(&[
                "new-window".to_string(),
                "-t".to_string(),
                session_id.to_string(),
                "-c".to_string(),
                project_path.to_string(),
            ])
        })
    }

    pub fn select_window(&self, window_id: &str) -> Result<(), String> {
        ensure_supported()?;
        let command = tmux_command_string(&["select-window", "-t", window_id]);
        self.send_control_or_fallback(None, &command, || {
            run_tmux_status(&[
                "select-window".to_string(),
                "-t".to_string(),
                window_id.to_string(),
            ])
        })
    }

    pub fn select_window_index(&self, session_id: &str, window_index: i32) -> Result<(), String> {
        ensure_supported()?;
        let target = format!("{}:{}", session_id, window_index);
        let command = tmux_command_string(&["select-window", "-t", &target]);
        self.send_control_or_fallback(Some(session_id), &command, || {
            run_tmux_status(&[
                "select-window".to_string(),
                "-t".to_string(),
                target,
            ])
        })
    }

    pub fn next_window(&self) -> Result<(), String> {
        ensure_supported()?;
        let command = tmux_command_string(&["select-window", "-n"]);
        self.send_control_or_fallback(None, &command, || {
            run_tmux_status(&["select-window".to_string(), "-n".to_string()])
        })
    }

    pub fn previous_window(&self) -> Result<(), String> {
        ensure_supported()?;
        let command = tmux_command_string(&["select-window", "-p"]);
        self.send_control_or_fallback(None, &command, || {
            run_tmux_status(&["select-window".to_string(), "-p".to_string()])
        })
    }

    pub fn resize_client(
        &mut self,
        app: AppHandle,
        session_id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<(), String> {
        ensure_supported()?;
        self.ensure_control_client(app, session_id)?;
        let size = format!("{}x{}", cols, rows);
        let command = tmux_command_string(&["refresh-client", "-C", &size]);
        self.send_control_or_fallback(Some(session_id), &command, || {
            run_tmux_status(&[
                "refresh-client".to_string(),
                "-C".to_string(),
                size,
            ])
        })
    }

    pub fn capture_pane(&self, pane_id: &str) -> Result<String, String> {
        ensure_supported()?;
        run_tmux_command(&[
            "capture-pane".to_string(),
            "-p".to_string(),
            "-S".to_string(),
            "-".to_string(),
            "-e".to_string(),
            "-t".to_string(),
            pane_id.to_string(),
        ])
    }

    pub fn get_pane_cursor(&self, pane_id: &str) -> Result<TmuxPaneCursor, String> {
        ensure_supported()?;
        let output = run_tmux_command(&[
            "display-message".to_string(),
            "-p".to_string(),
            "-t".to_string(),
            pane_id.to_string(),
            "#{cursor_x}\t#{cursor_y}".to_string(),
        ])?;
        let mut parts = output.trim().split('\t');
        let col = parts
            .next()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(0);
        let row = parts
            .next()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(0);
        Ok(TmuxPaneCursor { col, row })
    }

    fn ensure_control_client(&mut self, app: AppHandle, session_id: &str) -> Result<(), String> {
        if let Some(control) = self.controls.get(session_id) {
            if control.is_alive() {
                return Ok(());
            }
        }
        self.drop_control_client(session_id);
        let control = spawn_tmux_control_client(app, session_id)?;
        self.controls.insert(session_id.to_string(), control);
        Ok(())
    }

    fn drop_control_client(&mut self, session_id: &str) {
        let Some(control) = self.controls.remove(session_id) else {
            return;
        };
        control.alive.store(false, Ordering::SeqCst);
        let child_lock = control.child.lock();
        if let Ok(mut child) = child_lock {
            let _ = child.kill();
        }
    }

    fn control_client_for_target(&self, session_id: Option<&str>) -> Option<&TmuxControlClient> {
        if let Some(session_id) = session_id {
            return self.controls.get(session_id);
        }
        if let Some(active_session) = self.active_session_id.as_deref() {
            if let Some(control) = self.controls.get(active_session) {
                return Some(control);
            }
        }
        self.controls.values().next()
    }

    fn send_control_command_to(&self, session_id: Option<&str>, command: &str) -> Result<(), String> {
        let control = self
            .control_client_for_target(session_id)
            .ok_or_else(|| "控制客户端未启动".to_string())?;
        if !control.is_alive() {
            return Err("控制客户端不可用".to_string());
        }
        let result_rx = control.enqueue_command(command.to_string())?;
        let timeout = Duration::from_millis(CONTROL_COMMAND_TIMEOUT_MS + 200);
        match result_rx.recv_timeout(timeout) {
            Ok(ControlCommandResult::Ok) => Ok(()),
            Ok(ControlCommandResult::Error(message)) => Err(message),
            Err(_) => Err("控制命令超时".to_string()),
        }
    }

    fn send_control_or_fallback<F>(
        &self,
        session_id: Option<&str>,
        command: &str,
        fallback: F,
    ) -> Result<(), String>
    where
        F: FnOnce() -> Result<(), String>,
    {
        if let Ok(()) = self.send_control_command_to(session_id, command) {
            return Ok(());
        }
        fallback()
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
    tmux_command()
        .arg("-V")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn tmux_session_exists(session_id: &str) -> Result<bool, String> {
    let output = tmux_command()
        .args(["has-session", "-t", session_id])
        .output()
        .map_err(|err| format!("tmux 命令执行失败: {err}"))?;
    Ok(output.status.success())
}

fn run_tmux_command(args: &[String]) -> Result<String, String> {
    let output = tmux_command()
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
    let output = tmux_command()
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

fn tmux_quote_arg(value: &str) -> String {
    if value.is_empty() {
        return "\"\"".to_string();
    }
    let is_safe = value.chars().all(|ch| {
        ch.is_ascii_alphanumeric()
            || matches!(ch, '-' | '_' | '.' | '/' | ':' | '@' | '%' | '#' | '{' | '}' | '=' | '+' | ',')
    });
    if is_safe {
        value.to_string()
    } else {
        let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
        format!("\"{}\"", escaped)
    }
}

fn tmux_command_string(args: &[&str]) -> String {
    args.iter()
        .map(|arg| tmux_quote_arg(arg))
        .collect::<Vec<_>>()
        .join(" ")
}

fn apply_tmux_pane_style(session_id: &str) -> Result<(), String> {
    run_tmux_status(&[
        "set-option".to_string(),
        "-t".to_string(),
        session_id.to_string(),
        "history-limit".to_string(),
        TMUX_HISTORY_LIMIT.to_string(),
    ])?;
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

fn session_name_for_project(project_name: &str) -> String {
    let sanitized: String = project_name
        .trim()
        .chars()
        .map(|ch| if ch.is_alphanumeric() || ch == '-' || ch == '_' || ch == ' ' { ch } else { '_' })
        .collect();
    let trimmed = sanitized.trim();
    if trimmed.is_empty() {
        "devhaven".to_string()
    } else {
        trimmed.to_string()
    }
}

fn legacy_session_name_for_project_id(project_id: &str) -> String {
    let sanitized: String = project_id
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' { ch } else { '_' })
        .collect();
    format!("{LEGACY_TMUX_SESSION_PREFIX}{sanitized}")
}

fn rename_tmux_session(old_name: &str, new_name: &str) -> Result<(), String> {
    run_tmux_status(&[
        "rename-session".to_string(),
        "-t".to_string(),
        old_name.to_string(),
        new_name.to_string(),
    ])
}

fn spawn_tmux_control_client(app: AppHandle, session_id: &str) -> Result<TmuxControlClient, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| format!("创建 tmux 控制终端失败: {err}"))?;

    let mut command = CommandBuilder::new(resolve_tmux_bin());
    command.arg("-CC");
    command.arg("attach-session");
    command.arg("-t");
    command.arg(session_id);
    let tmux_env = build_tmux_env();
    tmux_env.apply_to_builder(&mut command);
    command.env("TERM", "xterm-256color");

    // 打印调试信息
    eprintln!("启动 tmux 控制模式:");
    eprintln!("  PATH: {}", tmux_env.path);
    eprintln!("  SHELL: {}", tmux_env.shell);
    eprintln!("  tmux 路径: {:?}", resolve_tmux_bin());
    eprintln!("  session: {}", session_id);

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
    let parser_state = Arc::new(Mutex::new(ControlParserState::new()));
    let (command_tx, command_rx) = mpsc::channel();
    let child = Arc::new(Mutex::new(child));

    spawn_tmux_reader(
        app,
        reader,
        Arc::clone(&alive),
        session_id.to_string(),
        Arc::clone(&parser_state),
    );
    spawn_control_command_worker(
        writer,
        Arc::clone(&alive),
        Arc::clone(&parser_state),
        command_rx,
        Arc::clone(&child),
    );

    Ok(TmuxControlClient {
        master: Mutex::new(pair.master),
        child,
        alive,
        parser_state,
        command_tx,
    })
}

fn spawn_tmux_reader(
    app: AppHandle,
    mut reader: Box<dyn Read + Send>,
    alive: Arc<AtomicBool>,
    session_id: String,
    parser_state: Arc<Mutex<ControlParserState>>,
) {
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
                        handle_tmux_line(&app, &line, &alive, &session_id, &parser_state);
                    }
                }
                Err(_) => break,
            }
        }
        alive.store(false, Ordering::SeqCst);
    });
}

fn spawn_control_command_worker(
    mut writer: Box<dyn Write + Send>,
    alive: Arc<AtomicBool>,
    parser_state: Arc<Mutex<ControlParserState>>,
    command_rx: Receiver<ControlCommand>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
) {
    thread::spawn(move || {
        while alive.load(Ordering::SeqCst) {
            match command_rx.recv_timeout(Duration::from_millis(CONTROL_COMMAND_QUEUE_POLL_MS)) {
                Ok(command) => {
                    let completion_rx = match prepare_command_completion(&parser_state) {
                        Ok(receiver) => receiver,
                        Err(message) => {
                            let _ = command
                                .result_tx
                                .send(ControlCommandResult::Error(message));
                            mark_control_unhealthy(&alive, &child);
                            continue;
                        }
                    };
                    if let Err(message) = write_control_command(&mut writer, &command.command) {
                        if let Ok(mut state) = parser_state.lock() {
                            state.pending_completion = None;
                            state.current_response = None;
                            state.mode = ControlModeState::Recovery;
                            state.recovery_pending = true;
                        }
                        let _ = command
                            .result_tx
                            .send(ControlCommandResult::Error(message));
                        mark_control_unhealthy(&alive, &child);
                        continue;
                    }
                    let timeout = Duration::from_millis(CONTROL_COMMAND_TIMEOUT_MS);
                    let result = wait_for_command_completion(&parser_state, completion_rx, timeout);
                    if matches!(result, ControlCommandResult::Error(ref message) if message == "控制命令超时") {
                        mark_control_unhealthy(&alive, &child);
                    }
                    let _ = command.result_tx.send(result);
                }
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });
}

fn prepare_command_completion(
    parser_state: &Arc<Mutex<ControlParserState>>,
) -> Result<Receiver<ControlCommandResult>, String> {
    let (completion_tx, completion_rx) = mpsc::channel::<ControlCommandResult>();
    {
        let mut state = parser_state
            .lock()
            .map_err(|_| "控制通道状态不可用".to_string())?;
        if let Some(previous) = state.pending_completion.take() {
            let _ = previous.send(ControlCommandResult::Error("控制命令被覆盖".to_string()));
        }
        state.pending_completion = Some(completion_tx);
        state.current_response = None;
        state.mode = ControlModeState::InResponse;
    }
    Ok(completion_rx)
}

fn wait_for_command_completion(
    parser_state: &Arc<Mutex<ControlParserState>>,
    completion_rx: Receiver<ControlCommandResult>,
    timeout: Duration,
) -> ControlCommandResult {
    match completion_rx.recv_timeout(timeout) {
        Ok(result) => result,
        Err(_) => {
            if let Ok(mut state) = parser_state.lock() {
                state.pending_completion = None;
                state.current_response = None;
                state.mode = ControlModeState::Recovery;
                state.recovery_pending = true;
            }
            ControlCommandResult::Error("控制命令超时".to_string())
        }
    }
}

fn write_control_command(
    writer: &mut Box<dyn Write + Send>,
    command: &str,
) -> Result<(), String> {
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

fn mark_control_unhealthy(
    alive: &Arc<AtomicBool>,
    child: &Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
) {
    alive.store(false, Ordering::SeqCst);
    if let Ok(mut child) = child.lock() {
        let _ = child.kill();
    }
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

#[derive(Debug, PartialEq, Eq)]
enum ControlLine {
    Output { pane_id: String, data: String },
    LayoutChange { window_id: Option<String> },
    WindowPaneChanged { window_id: Option<String> },
    WindowsChanged,
    SessionChanged { session_name: Option<String> },
    Begin { block: ResponseBlock },
    End { block: ResponseBlock, is_error: bool },
    Exit,
    Unknown,
}

fn parse_response_block(line: &str) -> Option<ResponseBlock> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 3 {
        return None;
    }
    Some(ResponseBlock {
        id: parts[1].to_string(),
        number: parts[2].to_string(),
    })
}

fn parse_control_line(line: &str) -> ControlLine {
    if line.starts_with("%output ") {
        let rest = &line[8..];
        let mut parts = rest.splitn(2, ' ');
        let pane_id = parts.next().unwrap_or("").trim();
        let raw = parts.next().unwrap_or("");
        if pane_id.is_empty() {
            return ControlLine::Unknown;
        }
        let data = decode_tmux_output(raw);
        return ControlLine::Output {
            pane_id: pane_id.to_string(),
            data,
        };
    }

    if line.starts_with("%layout-change") {
        let window_id = line.split_whitespace().nth(1).map(|value| value.to_string());
        return ControlLine::LayoutChange { window_id };
    }

    if line.starts_with("%window-pane-changed") {
        let window_id = line.split_whitespace().nth(1).map(|value| value.to_string());
        return ControlLine::WindowPaneChanged { window_id };
    }

    if line.starts_with("%window-add ")
        || line.starts_with("%window-close ")
        || line.starts_with("%window-renamed ")
        || line.starts_with("%unlinked-window-add ")
        || line.starts_with("%unlinked-window-close ")
        || line.starts_with("%unlinked-window-renamed ")
        || line.starts_with("%sessions-changed")
    {
        return ControlLine::WindowsChanged;
    }

    if line.starts_with("%session-changed ") || line.starts_with("%client-session-changed ") {
        let session_name = if line.starts_with("%client-session-changed ") {
            line.split_whitespace().nth(3).map(|value| value.to_string())
        } else {
            line.split_whitespace().nth(2).map(|value| value.to_string())
        };
        return ControlLine::SessionChanged { session_name };
    }

    if line.starts_with("%begin ") {
        if let Some(block) = parse_response_block(line) {
            return ControlLine::Begin { block };
        }
    }

    if line.starts_with("%end ") {
        if let Some(block) = parse_response_block(line) {
            return ControlLine::End {
                block,
                is_error: false,
            };
        }
    }

    if line.starts_with("%error ") {
        if let Some(block) = parse_response_block(line) {
            return ControlLine::End {
                block,
                is_error: true,
            };
        }
    }

    if line.starts_with("%exit") {
        return ControlLine::Exit;
    }

    ControlLine::Unknown
}

fn handle_tmux_line(
    app: &AppHandle,
    line: &str,
    alive: &Arc<AtomicBool>,
    session_id: &str,
    parser_state: &Arc<Mutex<ControlParserState>>,
) {
    if line.is_empty() {
        return;
    }

    let mut output_payload: Option<TmuxOutputPayload> = None;
    let mut state_payload: Option<TmuxStatePayload> = None;
    let mut completion_tx: Option<Sender<ControlCommandResult>> = None;
    let mut completion_result: Option<ControlCommandResult> = None;
    let mut should_exit = false;

    {
        let mut state = match parser_state.lock() {
            Ok(state) => state,
            Err(_) => return,
        };
        if state.recovery_pending
            && !line.starts_with("%begin ")
            && !line.starts_with("%exit")
        {
            state.recovery_pending = false;
            state.mode = ControlModeState::Idle;
            return;
        }
        if state.recovery_pending {
            state.recovery_pending = false;
            state.mode = ControlModeState::Idle;
        }

        match parse_control_line(line) {
            ControlLine::Output { pane_id, data } => {
                output_payload = Some(TmuxOutputPayload {
                    session_id: session_id.to_string(),
                    pane_id,
                    data,
                });
            }
            ControlLine::LayoutChange { window_id } => {
                state_payload = Some(TmuxStatePayload {
                    kind: "layout-change".to_string(),
                    session_name: None,
                    window_id,
                });
            }
            ControlLine::WindowPaneChanged { window_id } => {
                state_payload = Some(TmuxStatePayload {
                    kind: "window-pane-changed".to_string(),
                    session_name: None,
                    window_id,
                });
            }
            ControlLine::WindowsChanged => {
                state_payload = Some(TmuxStatePayload {
                    kind: "windows-changed".to_string(),
                    session_name: None,
                    window_id: None,
                });
            }
            ControlLine::SessionChanged { session_name } => {
                state_payload = Some(TmuxStatePayload {
                    kind: "session-changed".to_string(),
                    session_name,
                    window_id: None,
                });
            }
            ControlLine::Begin { block } => {
                state.current_response = Some(block);
                state.mode = ControlModeState::InResponse;
            }
            ControlLine::End { block, is_error } => {
                let should_complete = match &state.current_response {
                    Some(current) => current == &block,
                    None => true,
                };
                if should_complete {
                    state.current_response = None;
                    state.mode = ControlModeState::Idle;
                    completion_tx = state.pending_completion.take();
                    completion_result = Some(if is_error {
                        ControlCommandResult::Error(format!("控制命令失败: {line}"))
                    } else {
                        ControlCommandResult::Ok
                    });
                }
            }
            ControlLine::Exit => {
                state.mode = ControlModeState::Exiting;
                completion_tx = state.pending_completion.take();
                completion_result = Some(ControlCommandResult::Error("控制通道已退出".to_string()));
                state_payload = Some(TmuxStatePayload {
                    kind: "client-exit".to_string(),
                    session_name: None,
                    window_id: None,
                });
                should_exit = true;
            }
            ControlLine::Unknown => {}
        }
    }

    if let Some(payload) = output_payload {
        let _ = app.emit(TMUX_OUTPUT_EVENT, payload);
    }
    if let Some(payload) = state_payload {
        let _ = app.emit(TMUX_STATE_EVENT, payload);
    }
    if let (Some(tx), Some(result)) = (completion_tx, completion_result) {
        let _ = tx.send(result);
    }
    if should_exit {
        alive.store(false, Ordering::SeqCst);
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decode_tmux_output_handles_octal() {
        let input = "hello\\040world\\041";
        let output = decode_tmux_output(input);
        assert_eq!(output, "hello world!");
    }

    #[test]
    fn parse_control_line_handles_output() {
        let line = "%output %1 hello\\040world";
        let expected = ControlLine::Output {
            pane_id: "%1".to_string(),
            data: "hello world".to_string(),
        };
        assert_eq!(parse_control_line(line), expected);
    }

    #[test]
    fn parse_control_line_handles_begin_end_error() {
        let begin = parse_control_line("%begin 123 0");
        let end = parse_control_line("%end 123 0");
        let error = parse_control_line("%error 123 0");
        assert_eq!(
            begin,
            ControlLine::Begin {
                block: ResponseBlock {
                    id: "123".to_string(),
                    number: "0".to_string(),
                }
            }
        );
        assert_eq!(
            end,
            ControlLine::End {
                block: ResponseBlock {
                    id: "123".to_string(),
                    number: "0".to_string(),
                },
                is_error: false,
            }
        );
        assert_eq!(
            error,
            ControlLine::End {
                block: ResponseBlock {
                    id: "123".to_string(),
                    number: "0".to_string(),
                },
                is_error: true,
            }
        );
    }

    #[test]
    fn parse_control_line_handles_session_changed() {
        let line = "%client-session-changed 0 1 devhaven";
        let expected = ControlLine::SessionChanged {
            session_name: Some("devhaven".to_string()),
        };
        assert_eq!(parse_control_line(line), expected);
    }
}
