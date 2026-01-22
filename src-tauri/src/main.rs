// 在 Windows 发布版本中隐藏额外控制台窗口，请勿删除。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 应用主入口。
fn main() {
    tauri_app_lib::run()
}
