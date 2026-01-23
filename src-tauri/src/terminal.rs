use std::collections::HashMap;
use std::io::{Read, Write};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Clone, serde::Serialize)]
pub struct TerminalSessionInfo {
    pub id: String,
    pub project_id: String,
    pub project_path: String,
    pub created_at: i64,
}

pub struct TerminalManager {
    sessions: HashMap<String, TerminalSession>,
    project_sessions: HashMap<String, String>,
}

struct TerminalSession {
    info: TerminalSessionInfo,
    tmux_session: String,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    reader_handle: Option<JoinHandle<()>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            project_sessions: HashMap::new(),
        }
    }

    pub fn list_sessions(&self) -> Vec<TerminalSessionInfo> {
        self.sessions.values().map(|session| session.info.clone()).collect()
    }

    pub fn get_writer(&self, session_id: &str) -> Result<Arc<Mutex<Box<dyn Write + Send>>>, String> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| "终端会话不存在".to_string())?;
        Ok(session.writer.clone())
    }

    pub fn create_session(
        &mut self,
        app: AppHandle,
        project_id: &str,
        project_path: &str,
    ) -> Result<TerminalSessionInfo, String> {
        if let Some(session_id) = self.project_sessions.get(project_id) {
            if let Some(session) = self.sessions.get(session_id) {
                return Ok(session.info.clone());
            }
        }

        ensure_tmux_available()?;

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: 30,
                cols: 120,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|err| format!("创建终端失败: {err}"))?;

        let tmux_session = format!("devhaven_{}", sanitize_session_id(project_id));
        let mut command = CommandBuilder::new("tmux");
        command.args([
            "new-session",
            "-A",
            "-s",
            &tmux_session,
            "-c",
            project_path,
        ]);

        pair.slave
            .spawn_command(command)
            .map_err(|err| format!("启动终端失败: {err}"))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|err| format!("读取终端失败: {err}"))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|err| format!("写入终端失败: {err}"))?;

        let session_id = Uuid::new_v4().to_string();
        let event_name = format!("terminal-output-{}", session_id);
        let reader_handle = thread::spawn(move || {
            let mut buffer = [0u8; 8192];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(size) => {
                        let payload = String::from_utf8_lossy(&buffer[..size]).to_string();
                        let _ = app.emit(&event_name, payload);
                    }
                    Err(_) => break,
                }
            }
        });

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
                tmux_session,
                writer: Arc::new(Mutex::new(writer)),
                reader_handle: Some(reader_handle),
            },
        );
        self.project_sessions
            .insert(project_id.to_string(), session_id);

        Ok(info)
    }

    pub fn close_session(&mut self, session_id: &str) -> Result<(), String> {
        let session = self
            .sessions
            .remove(session_id)
            .ok_or_else(|| "终端会话不存在".to_string())?;
        self.project_sessions
            .retain(|_, value| value != session_id);

        let _ = Command::new("tmux")
            .args(["kill-session", "-t", &session.tmux_session])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();

        if let Some(handle) = session.reader_handle {
            let _ = handle.join();
        }

        Ok(())
    }
}

fn ensure_tmux_available() -> Result<(), String> {
    let status = Command::new("tmux")
        .arg("-V")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|err| format!("未检测到 tmux: {err}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("tmux 未安装或不可用，请先安装 tmux".to_string())
    }
}

fn sanitize_session_id(value: &str) -> String {
    value
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '_' })
        .collect()
}
