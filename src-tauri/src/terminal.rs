use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

const TERMINAL_OUTPUT_EVENT: &str = "terminal-output";
const TERMINAL_EXIT_EVENT: &str = "terminal-exit";

/// 将 PTY 的字节流按 UTF-8 逐步解码。
///
/// 关键点：PTY 读到的字节可能会把一个 UTF-8 字符拆到两次 read() 里。
/// 如果每次 read() 都直接 `String::from_utf8_lossy(&chunk)`，就会把拆开的字符解成 `�`，
/// 在中文/emoji 等多字节字符场景看起来像“乱码”。
fn drain_utf8_stream(pending: &mut Vec<u8>) -> String {
    if pending.is_empty() {
        return String::new();
    }

    let mut out = String::new();
    loop {
        match std::str::from_utf8(pending) {
            Ok(text) => {
                out.push_str(text);
                pending.clear();
                break;
            }
            Err(err) => {
                let valid_up_to = err.valid_up_to();
                if valid_up_to > 0 {
                    // SAFETY: valid_up_to 之前的字节已被 UTF-8 校验为有效。
                    let valid = unsafe { std::str::from_utf8_unchecked(&pending[..valid_up_to]) };
                    out.push_str(valid);
                    pending.drain(..valid_up_to);
                    continue;
                }

                match err.error_len() {
                    None => {
                        // 不完整的 UTF-8 序列（通常发生在末尾），等待更多字节再解码。
                        break;
                    }
                    Some(len) => {
                        // 非法字节：输出替换字符并跳过该段，避免死循环。
                        out.push('\u{FFFD}');
                        pending.drain(..len);
                    }
                }
            }
        }
    }

    out
}

#[derive(Default)]
pub struct TerminalState {
    pub sessions: Arc<Mutex<HashMap<String, Arc<PtySession>>>>,
}

pub struct PtySession {
    pub master: Mutex<Box<dyn MasterPty + Send>>,
    pub writer: Mutex<Box<dyn Write + Send>>,
    pub child: Mutex<Box<dyn Child + Send>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalCreateResult {
    pub pty_id: String,
    pub session_id: String,
    pub shell: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalOutputPayload {
    session_id: String,
    data: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalExitPayload {
    session_id: String,
    code: Option<i32>,
}

fn default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
}

fn ensure_terminal_env(cmd: &mut CommandBuilder) {
    // GUI 启动的 macOS App 往往缺少 TERM/PATH 等环境变量，导致交互式 shell 初始化时报错。
    if cmd.get_env("TERM").is_none() {
        cmd.env("TERM", "xterm-256color");
    }

    #[cfg(target_os = "macos")]
    {
        // Homebrew 典型安装路径不一定在 Finder 启动的进程 PATH 中，补齐以保持 dev/打包一致。
        let current = cmd
            .get_env("PATH")
            .map(|p| p.to_os_string())
            .or_else(|| std::env::var_os("PATH"))
            .unwrap_or_default();
        let existing: Vec<PathBuf> = std::env::split_paths(&current).collect();

        let mut prepend: Vec<PathBuf> = Vec::new();
        for dir in [
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "/usr/local/bin",
            "/usr/local/sbin",
        ] {
            let p = Path::new(dir);
            if !p.exists() {
                continue;
            }
            if existing.iter().any(|e| e == p) || prepend.iter().any(|e| e == p) {
                continue;
            }
            prepend.push(p.to_path_buf());
        }

        if !prepend.is_empty() {
            let mut merged = prepend;
            merged.extend(existing);
            if let Ok(joined) = std::env::join_paths(merged) {
                cmd.env("PATH", joined);
            }
        }
    }
}

#[tauri::command]
pub fn terminal_create_session(
    app: AppHandle,
    state: State<TerminalState>,
    project_path: String,
    cols: u16,
    rows: u16,
    window_label: String,
    session_id: Option<String>,
) -> Result<TerminalCreateResult, String> {
    let shell = default_shell();
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| format!("创建终端失败: {err}"))?;

    let mut cmd = CommandBuilder::new(shell.clone());
    cmd.cwd(project_path);
    ensure_terminal_env(&mut cmd);

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|err| format!("启动终端失败: {err}"))?;
    drop(pair.slave);

    let master = pair.master;
    let reader = master
        .try_clone_reader()
        .map_err(|err| format!("读取终端失败: {err}"))?;
    let writer = master
        .take_writer()
        .map_err(|err| format!("打开终端写入失败: {err}"))?;

    let session_id = session_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let pty_id = Uuid::new_v4().to_string();

    let session = Arc::new(PtySession {
        master: Mutex::new(master),
        writer: Mutex::new(writer),
        child: Mutex::new(child),
    });

    {
        let mut sessions = state
            .sessions
            .lock()
            .map_err(|_| "终端会话锁定失败".to_string())?;
        sessions.insert(pty_id.clone(), session.clone());
    }

    let app_handle = app.clone();
    let sessions_map = state.sessions.clone();
    let session_id_for_output = session_id.clone();
    let window_label_for_output = window_label.clone();
    let pty_id_for_output = pty_id.clone();

    thread::spawn(move || {
        let mut reader = reader;
        let mut buffer = [0u8; 8192];
        let mut pending_utf8: Vec<u8> = Vec::new();
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    pending_utf8.extend_from_slice(&buffer[..size]);
                    let data = drain_utf8_stream(&mut pending_utf8);
                    if !data.is_empty() {
                        let _ = app_handle.emit_to(
                            &window_label_for_output,
                            TERMINAL_OUTPUT_EVENT,
                            TerminalOutputPayload {
                                session_id: session_id_for_output.clone(),
                                data,
                            },
                        );
                    }
                }
                Err(_) => break,
            }
        }

        // 尽量不要丢尾巴：如果最后残留了半个字符（或非法字节），用 lossy 方式吐出来。
        if !pending_utf8.is_empty() {
            let data = String::from_utf8_lossy(&pending_utf8).to_string();
            if !data.is_empty() {
                let _ = app_handle.emit_to(
                    &window_label_for_output,
                    TERMINAL_OUTPUT_EVENT,
                    TerminalOutputPayload {
                        session_id: session_id_for_output.clone(),
                        data,
                    },
                );
            }
        }

        let _ = app_handle.emit_to(
            &window_label_for_output,
            TERMINAL_EXIT_EVENT,
            TerminalExitPayload {
                session_id: session_id_for_output.clone(),
                code: None,
            },
        );
        if let Ok(mut sessions) = sessions_map.lock() {
            sessions.remove(&pty_id_for_output);
        }
    });

    Ok(TerminalCreateResult {
        pty_id,
        session_id,
        shell,
    })
}

#[tauri::command]
pub fn terminal_write(
    state: State<TerminalState>,
    pty_id: String,
    data: String,
) -> Result<(), String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| "终端会话锁定失败".to_string())?;
    let session = sessions
        .get(&pty_id)
        .ok_or_else(|| "终端会话不存在".to_string())?;
    let mut writer = session
        .writer
        .lock()
        .map_err(|_| "终端写入锁定失败".to_string())?;
    writer
        .write_all(data.as_bytes())
        .map_err(|err| format!("终端写入失败: {err}"))?;
    writer
        .flush()
        .map_err(|err| format!("终端刷新失败: {err}"))?;
    Ok(())
}

#[tauri::command]
pub fn terminal_resize(
    state: State<TerminalState>,
    pty_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| "终端会话锁定失败".to_string())?;
    let session = sessions
        .get(&pty_id)
        .ok_or_else(|| "终端会话不存在".to_string())?;
    let master = session
        .master
        .lock()
        .map_err(|_| "终端调整锁定失败".to_string())?;
    master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| format!("调整终端大小失败: {err}"))?;
    Ok(())
}

#[tauri::command]
pub fn terminal_kill(state: State<TerminalState>, pty_id: String) -> Result<(), String> {
    let session = {
        let mut sessions = state
            .sessions
            .lock()
            .map_err(|_| "终端会话锁定失败".to_string())?;
        sessions.remove(&pty_id)
    };

    if let Some(session) = session {
        let mut child = session
            .child
            .lock()
            .map_err(|_| "终端会话锁定失败".to_string())?;
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}
