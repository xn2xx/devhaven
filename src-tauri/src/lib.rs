mod models;
mod git_daily;
mod git_ops;
mod notes;
mod project_loader;
mod storage;
mod system;
mod terminal;
mod time_utils;

use std::io::Write;
use std::sync::Mutex;
use std::time::Instant;
use tauri::AppHandle;
use tauri::Manager;
use tauri::State;
use tauri_plugin_log::{Target, TargetKind};

use crate::models::{AppStateFile, BranchListItem, GitDailyResult, HeatmapCacheFile, Project};
use crate::system::{EditorOpenParams, TerminalOpenParams};
use crate::terminal::{TerminalManager, TerminalSessionInfo};

#[tauri::command]
/// 读取应用状态。
fn load_app_state(app: AppHandle) -> Result<AppStateFile, String> {
    log_command_result("load_app_state", || storage::load_app_state(&app))
}

#[tauri::command]
/// 保存应用状态。
fn save_app_state(app: AppHandle, state: AppStateFile) -> Result<(), String> {
    log_command_result("save_app_state", || storage::save_app_state(&app, &state))
}

#[tauri::command]
/// 读取项目缓存列表。
fn load_projects(app: AppHandle) -> Result<Vec<Project>, String> {
    log_command_result("load_projects", || storage::load_projects(&app))
}

#[tauri::command]
/// 保存项目缓存列表。
fn save_projects(app: AppHandle, projects: Vec<Project>) -> Result<(), String> {
    log_command_result("save_projects", || storage::save_projects(&app, &projects))
}

#[tauri::command]
/// 扫描工作目录，发现项目路径。
fn discover_projects(directories: Vec<String>) -> Vec<String> {
    log_command("discover_projects", || {
        log::info!("discover_projects directories={}", directories.len());
        project_loader::discover_projects(&directories)
    })
}

#[tauri::command]
/// 构建项目列表并补齐元数据。
fn build_projects(paths: Vec<String>, existing: Vec<Project>) -> Vec<Project> {
    log_command("build_projects", || {
        log::info!(
            "build_projects paths={} existing={}",
            paths.len(),
            existing.len()
        );
        project_loader::build_projects(&paths, &existing)
    })
}

#[tauri::command]
/// 获取分支列表。
fn list_branches(base_path: String) -> Vec<BranchListItem> {
    log_command("list_branches", || {
        log::info!("list_branches base_path={}", base_path);
        git_ops::list_branches(&base_path)
    })
}

#[tauri::command]
/// 在文件管理器中定位路径。
fn open_in_finder(path: String) -> Result<(), String> {
    log_command_result("open_in_finder", || {
        log::info!("open_in_finder path={}", path);
        system::open_in_finder(&path)
    })
}

#[tauri::command]
/// 在终端中打开路径。
fn open_in_terminal(params: TerminalOpenParams) -> Result<(), String> {
    log_command_result("open_in_terminal", || {
        log::info!("open_in_terminal path={}", params.path);
        system::open_in_terminal(params)
    })
}

#[tauri::command]
/// 使用外部编辑器打开路径。
fn open_in_editor(params: EditorOpenParams) -> Result<(), String> {
    log_command_result("open_in_editor", || {
        log::info!("open_in_editor path={}", params.path);
        system::open_in_editor(params)
    })
}

#[tauri::command]
/// 复制文本到剪贴板。
fn copy_to_clipboard(app: AppHandle, content: String) -> Result<(), String> {
    log_command_result("copy_to_clipboard", || {
        log::info!("copy_to_clipboard size={}", content.len());
        system::copy_to_clipboard(&app, &content)
    })
}

#[tauri::command]
/// 读取项目备注内容。
fn read_project_notes(path: String) -> Result<Option<String>, String> {
    log_command_result("read_project_notes", || {
        log::info!("read_project_notes path={}", path);
        notes::read_notes(&path)
    })
}

#[tauri::command]
/// 写入项目备注内容。
fn write_project_notes(path: String, notes: Option<String>) -> Result<(), String> {
    log_command_result("write_project_notes", || {
        let note_len = notes.as_ref().map(|value| value.len()).unwrap_or(0);
        log::info!("write_project_notes path={} size={}", path, note_len);
        notes::write_notes(&path, notes)
    })
}

#[tauri::command]
fn collect_git_daily(paths: Vec<String>) -> Vec<GitDailyResult> {
    log_command("collect_git_daily", || {
        log::info!("collect_git_daily paths={}", paths.len());
        git_daily::collect_git_daily(&paths)
    })
}

#[tauri::command]
fn load_heatmap_cache(app: AppHandle) -> Result<HeatmapCacheFile, String> {
    log_command_result("load_heatmap_cache", || storage::load_heatmap_cache(&app))
}

#[tauri::command]
fn save_heatmap_cache(app: AppHandle, cache: HeatmapCacheFile) -> Result<(), String> {
    log_command_result("save_heatmap_cache", || storage::save_heatmap_cache(&app, &cache))
}

#[tauri::command]
fn create_terminal_session(
    app: AppHandle,
    state: State<'_, Mutex<TerminalManager>>,
    project_id: String,
    project_path: String,
) -> Result<TerminalSessionInfo, String> {
    log_command_result("create_terminal_session", || {
        log::info!(
            "create_terminal_session project_id={} project_path={}",
            project_id,
            project_path
        );
        state
            .lock()
            .map_err(|_| "终端状态锁异常".to_string())?
            .create_session(app, &project_id, &project_path)
    })
}

#[tauri::command]
fn list_terminal_sessions(
    state: State<'_, Mutex<TerminalManager>>,
) -> Result<Vec<TerminalSessionInfo>, String> {
    log_command_result("list_terminal_sessions", || {
        Ok(state
            .lock()
            .map_err(|_| "终端状态锁异常".to_string())?
            .list_sessions())
    })
}

#[tauri::command]
fn close_terminal_session(
    state: State<'_, Mutex<TerminalManager>>,
    session_id: String,
) -> Result<(), String> {
    log_command_result("close_terminal_session", || {
        log::info!("close_terminal_session session_id={}", session_id);
        state
            .lock()
            .map_err(|_| "终端状态锁异常".to_string())?
            .close_session(&session_id)
    })
}

#[tauri::command]
fn write_to_terminal(
    state: State<'_, Mutex<TerminalManager>>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let data_len = data.len();
    let writer = {
        let manager = state
            .lock()
            .map_err(|_| "终端状态锁异常".to_string())?;
        manager.get_writer(&session_id)?
    };
    let mut locked = writer
        .lock()
        .map_err(|_| "终端写入锁异常".to_string())?;
    locked
        .write_all(data.as_bytes())
        .map_err(|err| {
            let message = format!("终端写入失败: {err}");
            log::error!(
                "write_to_terminal session_id={} size={} error={}",
                session_id,
                data_len,
                message
            );
            message
        })?;
    locked.flush().map_err(|err| {
        let message = format!("终端写入失败: {err}");
        log::error!(
            "write_to_terminal session_id={} size={} error={}",
            session_id,
            data_len,
            message
        );
        message
    })?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
/// 启动 Tauri 应用。
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                ])
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(Mutex::new(TerminalManager::new()))
        .setup(|app| {
            log::info!(
                "app start name={} version={}",
                app.package_info().name,
                app.package_info().version
            );
            if let Ok(path) = app.path().app_log_dir() {
                log::info!("log dir={}", path.display());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_app_state,
            save_app_state,
            load_projects,
            save_projects,
            discover_projects,
            build_projects,
            list_branches,
            open_in_finder,
            open_in_terminal,
            open_in_editor,
            copy_to_clipboard,
            read_project_notes,
            write_project_notes,
            collect_git_daily,
            load_heatmap_cache,
            save_heatmap_cache,
            create_terminal_session,
            list_terminal_sessions,
            close_terminal_session,
            write_to_terminal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn log_command<T, F: FnOnce() -> T>(name: &str, action: F) -> T {
    let start = Instant::now();
    log::info!("command {} start", name);
    let result = action();
    log::info!("command {} done {}ms", name, start.elapsed().as_millis());
    result
}

fn log_command_result<T, E: std::fmt::Display, F: FnOnce() -> Result<T, E>>(
    name: &str,
    action: F,
) -> Result<T, E> {
    let start = Instant::now();
    log::info!("command {} start", name);
    let result = action();
    match &result {
        Ok(_) => log::info!("command {} ok {}ms", name, start.elapsed().as_millis()),
        Err(err) => log::error!(
            "command {} failed {}ms: {}",
            name,
            start.elapsed().as_millis(),
            err
        ),
    }
    result
}
