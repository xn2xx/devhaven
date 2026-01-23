use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

const TERMINAL_OUTPUT_EVENT: &str = "terminal-output";
const DEFAULT_TERM: &str = "xterm-256color";

#[derive(Clone, serde::Serialize)]
pub struct TerminalSessionInfo {
    pub id: String,
    pub project_id: String,
    pub project_path: String,
    pub created_at: i64,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalOutputPayload {
    session_id: String,
    data: String,
}

pub struct TerminalManager {
    sessions: HashMap<String, TerminalSession>,
    project_sessions: HashMap<String, String>,
    active_session_id: Option<String>,
}

struct TerminalSessionPty {
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Box<dyn portable_pty::Child + Send>>,
    alive: Arc<AtomicBool>,
}

struct TerminalSession {
    info: TerminalSessionInfo,
    pty: Option<TerminalSessionPty>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            project_sessions: HashMap::new(),
            active_session_id: None,
        }
    }

    pub fn list_sessions(&self) -> Vec<TerminalSessionInfo> {
        self.sessions.values().map(|session| session.info.clone()).collect()
    }

    pub fn create_session(
        &mut self,
        project_id: &str,
        project_path: &str,
    ) -> Result<TerminalSessionInfo, String> {
        if let Some(session_id) = self.project_sessions.get(project_id) {
            if let Some(session) = self.sessions.get(session_id) {
                return Ok(session.info.clone());
            }
        }

        let session_id = Uuid::new_v4().to_string();
        let info = TerminalSessionInfo {
            id: session_id.clone(),
            project_id: project_id.to_string(),
            project_path: project_path.to_string(),
            created_at: chrono::Utc::now().timestamp_millis(),
        };

        self.sessions.insert(
            session_id.clone(),
            TerminalSession {
                info: info.clone(),
                pty: None,
            },
        );
        self.project_sessions
            .insert(project_id.to_string(), session_id);

        Ok(info)
    }

    pub fn switch_session(&mut self, app: AppHandle, session_id: &str) -> Result<(), String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| "终端会话不存在".to_string())?;
        let needs_spawn = match session.pty.as_ref() {
            Some(pty) => !pty.alive.load(Ordering::SeqCst),
            None => true,
        };
        if needs_spawn {
            if let Some(pty) = session.pty.take() {
                pty.alive.store(false, Ordering::SeqCst);
                if let Ok(mut child) = pty.child.lock() {
                    let _ = child.kill();
                }
            }
            session.pty = Some(spawn_pty(
                app,
                session_id.to_string(),
                &session.info.project_path,
            )?);
        }
        self.active_session_id = Some(session_id.to_string());
        Ok(())
    }

    pub fn resize_session(&self, cols: u16, rows: u16) -> Result<(), String> {
        let session_id = self
            .active_session_id
            .as_ref()
            .ok_or_else(|| "未选择终端会话".to_string())?;
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| "终端会话不存在".to_string())?;
        let pty = session.pty.as_ref().ok_or_else(|| "终端未初始化".to_string())?;
        if !pty.alive.load(Ordering::SeqCst) {
            return Err("终端连接已断开".to_string());
        }

        let master = pty.master.lock().map_err(|_| "终端锁异常".to_string())?;
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|err| format!("调整终端大小失败: {err}"))
    }

    pub fn write_to_terminal(&mut self, data: &str) -> Result<(), String> {
        let session_id = self
            .active_session_id
            .as_ref()
            .ok_or_else(|| "未选择终端会话".to_string())?;
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| "终端会话不存在".to_string())?;
        let pty = session.pty.as_ref().ok_or_else(|| "终端未初始化".to_string())?;
        if !pty.alive.load(Ordering::SeqCst) {
            return Err("终端连接已断开".to_string());
        }

        let mut writer = pty.writer.lock().map_err(|_| "终端锁异常".to_string())?;

        writer
            .write_all(data.as_bytes())
            .map_err(|err| format!("终端写入失败: {err}"))?;
        writer
            .flush()
            .map_err(|err| format!("终端写入失败: {err}"))?;
        Ok(())
    }

    pub fn close_session(&mut self, session_id: &str) -> Result<(), String> {
        let session = self
            .sessions
            .remove(session_id)
            .ok_or_else(|| "终端会话不存在".to_string())?;
        self.project_sessions
            .retain(|_, value| value != session_id);

        if let Some(pty) = session.pty {
            pty.alive.store(false, Ordering::SeqCst);
            if let Ok(mut child) = pty.child.lock() {
                let _ = child.kill();
            }
        }

        if self.active_session_id.as_deref() == Some(session_id) {
            self.active_session_id = None;
        }

        Ok(())
    }
}

fn shell_path() -> String {
    std::env::var("SHELL")
        .or_else(|_| std::env::var("COMSPEC"))
        .unwrap_or_else(|_| "/bin/zsh".to_string())
}

fn should_use_interactive_flag(shell: &str) -> bool {
    let lower = shell.to_lowercase();
    !(lower.ends_with("cmd.exe") || lower.contains("powershell"))
}

fn spawn_terminal_reader(
    app: AppHandle,
    session_id: String,
    mut reader: Box<dyn Read + Send>,
    alive: Arc<AtomicBool>,
) {
    thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        let mut logged = false;
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    let payload = TerminalOutputPayload {
                        session_id: session_id.clone(),
                        data: String::from_utf8_lossy(&buffer[..size]).to_string(),
                    };
                    if !logged {
                        log::info!(
                            "terminal output session_id={} size={}",
                            session_id,
                            size
                        );
                        logged = true;
                    }
                    let _ = app.emit(TERMINAL_OUTPUT_EVENT, payload);
                }
                Err(_) => break,
            }
        }
        alive.store(false, Ordering::SeqCst);
    });
}

fn spawn_pty(
    app: AppHandle,
    session_id: String,
    project_path: &str,
) -> Result<TerminalSessionPty, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| format!("创建终端失败: {err}"))?;

    let shell = shell_path();
    let mut command = CommandBuilder::new(shell.clone());
    command.cwd(project_path);
    if should_use_interactive_flag(&shell) {
        command.arg("-i");
    }
    command.env("TERM", DEFAULT_TERM);
    command.env("COLORTERM", "truecolor");

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|err| format!("启动终端失败: {err}"))?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|err| format!("读取终端失败: {err}"))?;
    let mut writer = pair
        .master
        .take_writer()
        .map_err(|err| format!("获取写入器失败: {err}"))?;
    let _ = writer.write_all(b"\r");
    let _ = writer.flush();

    let alive = Arc::new(AtomicBool::new(true));
    spawn_terminal_reader(app, session_id, reader, Arc::clone(&alive));

    Ok(TerminalSessionPty {
        master: Mutex::new(pair.master),
        writer: Mutex::new(writer),
        child: Mutex::new(child),
        alive,
    })
}
