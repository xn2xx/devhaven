mod models;
mod git_daily;
mod git_ops;
mod notes;
mod project_loader;
mod storage;
mod system;
mod time_utils;

use tauri::AppHandle;

use crate::models::{AppStateFile, BranchListItem, GitDailyResult, HeatmapCacheFile, Project};
use crate::system::EditorOpenParams;

#[tauri::command]
/// 读取应用状态。
fn load_app_state(app: AppHandle) -> Result<AppStateFile, String> {
    storage::load_app_state(&app)
}

#[tauri::command]
/// 保存应用状态。
fn save_app_state(app: AppHandle, state: AppStateFile) -> Result<(), String> {
    storage::save_app_state(&app, &state)
}

#[tauri::command]
/// 读取项目缓存列表。
fn load_projects(app: AppHandle) -> Result<Vec<Project>, String> {
    storage::load_projects(&app)
}

#[tauri::command]
/// 保存项目缓存列表。
fn save_projects(app: AppHandle, projects: Vec<Project>) -> Result<(), String> {
    storage::save_projects(&app, &projects)
}

#[tauri::command]
/// 扫描工作目录，发现项目路径。
fn discover_projects(directories: Vec<String>) -> Vec<String> {
    project_loader::discover_projects(&directories)
}

#[tauri::command]
/// 构建项目列表并补齐元数据。
fn build_projects(paths: Vec<String>, existing: Vec<Project>) -> Vec<Project> {
    project_loader::build_projects(&paths, &existing)
}

#[tauri::command]
/// 获取分支列表。
fn list_branches(base_path: String) -> Vec<BranchListItem> {
    git_ops::list_branches(&base_path)
}

#[tauri::command]
/// 在文件管理器中定位路径。
fn open_in_finder(path: String) -> Result<(), String> {
    system::open_in_finder(&path)
}

#[tauri::command]
/// 在终端中打开路径。
fn open_in_terminal(path: String) -> Result<(), String> {
    system::open_in_terminal(&path)
}

#[tauri::command]
/// 使用外部编辑器打开路径。
fn open_in_editor(params: EditorOpenParams) -> Result<(), String> {
    system::open_in_editor(params)
}

#[tauri::command]
/// 复制文本到剪贴板。
fn copy_to_clipboard(app: AppHandle, content: String) -> Result<(), String> {
    system::copy_to_clipboard(&app, &content)
}

#[tauri::command]
/// 读取项目备注内容。
fn read_project_notes(path: String) -> Result<Option<String>, String> {
    notes::read_notes(&path)
}

#[tauri::command]
/// 写入项目备注内容。
fn write_project_notes(path: String, notes: Option<String>) -> Result<(), String> {
    notes::write_notes(&path, notes)
}

#[tauri::command]
fn collect_git_daily(paths: Vec<String>) -> Vec<GitDailyResult> {
    git_daily::collect_git_daily(&paths)
}

#[tauri::command]
fn load_heatmap_cache(app: AppHandle) -> Result<HeatmapCacheFile, String> {
    storage::load_heatmap_cache(&app)
}

#[tauri::command]
fn save_heatmap_cache(app: AppHandle, cache: HeatmapCacheFile) -> Result<(), String> {
    storage::save_heatmap_cache(&app, &cache)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
/// 启动 Tauri 应用。
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
