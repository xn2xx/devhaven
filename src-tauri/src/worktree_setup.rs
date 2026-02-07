use std::fs;
use std::path::Path;
use std::process::{Command, Output};

use serde::Deserialize;

const PROJECT_SETUP_DIR: &str = ".devhaven";
const SETUP_CONFIG_FILE: &str = "config.json";

#[derive(Debug, Deserialize)]
struct SetupConfig {
    #[serde(default)]
    setup: Vec<String>,
}

/// 为新建 worktree 准备环境。
///
/// 行为对齐 DevHaven：
/// 1) 尝试复制主仓库 .devhaven 到 worktree（仅当 worktree 不存在该目录时）；
/// 2) 读取 .devhaven/config.json 的 setup 命令并依次执行；
/// 3) 任一步失败只返回告警，不阻塞 worktree 创建完成。
pub fn prepare_worktree_environment(
    main_repo_path: &str,
    worktree_path: &str,
    workspace_name: &str,
) -> Option<String> {
    let mut warnings: Vec<String> = Vec::new();

    if let Err(error) = copy_setup_directory(main_repo_path, worktree_path) {
        warnings.push(format!("复制 .devhaven 目录失败：{}", error));
    }

    if let Err(error) = run_setup_commands_if_needed(main_repo_path, worktree_path, workspace_name)
    {
        warnings.push(error);
    }

    if warnings.is_empty() {
        None
    } else {
        Some(warnings.join("\n"))
    }
}

fn run_setup_commands_if_needed(
    main_repo_path: &str,
    worktree_path: &str,
    workspace_name: &str,
) -> Result<(), String> {
    let commands = load_setup_commands(main_repo_path)?;
    if commands.is_empty() {
        return Ok(());
    }
    run_setup_commands(main_repo_path, worktree_path, workspace_name, &commands)
}

fn copy_setup_directory(main_repo_path: &str, worktree_path: &str) -> Result<(), String> {
    let source = Path::new(main_repo_path).join(PROJECT_SETUP_DIR);
    let target = Path::new(worktree_path).join(PROJECT_SETUP_DIR);

    if !source.exists() {
        return Ok(());
    }

    if !source.is_dir() {
        return Err("源 .devhaven 不是目录".to_string());
    }

    if target.exists() {
        return Ok(());
    }

    copy_dir_recursive(&source, &target).map_err(|error| {
        format!(
            "{} -> {} 复制失败：{}",
            source.display(),
            target.display(),
            error
        )
    })
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), std::io::Error> {
    fs::create_dir_all(target)?;

    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());

        let source_meta = fs::symlink_metadata(&source_path)?;
        let file_type = source_meta.file_type();

        if file_type.is_symlink() {
            // 防止软链环路：仅复制软链目标为文件的场景。
            let resolved_meta = fs::metadata(&source_path)?;
            if resolved_meta.is_dir() {
                continue;
            }
            fs::copy(&source_path, &target_path)?;
            continue;
        }

        if source_meta.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
            continue;
        }

        fs::copy(&source_path, &target_path)?;
    }

    Ok(())
}

fn load_setup_commands(main_repo_path: &str) -> Result<Vec<String>, String> {
    let config_path = Path::new(main_repo_path)
        .join(PROJECT_SETUP_DIR)
        .join(SETUP_CONFIG_FILE);

    if !config_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&config_path).map_err(|error| {
        format!(
            "读取 setup 配置失败（{}）：{}",
            config_path.display(),
            error
        )
    })?;

    let parsed: SetupConfig = serde_json::from_str(&content).map_err(|error| {
        format!(
            "解析 setup 配置失败（{}）：{}",
            config_path.display(),
            error
        )
    })?;

    Ok(parsed
        .setup
        .into_iter()
        .map(|command| command.trim().to_string())
        .filter(|command| !command.is_empty())
        .collect())
}

fn run_setup_commands(
    main_repo_path: &str,
    worktree_path: &str,
    workspace_name: &str,
    commands: &[String],
) -> Result<(), String> {
    for command in commands {
        let output = run_shell_command(main_repo_path, worktree_path, workspace_name, command)?;

        if output.status.success() {
            continue;
        }

        let output_text = summarize_command_output(&output);
        let status_text = output
            .status
            .code()
            .map(|code| code.to_string())
            .unwrap_or_else(|| "unknown".to_string());

        return Err(format!(
            "环境初始化命令执行失败：\n$ {}\n退出码：{}\n{}",
            command, status_text, output_text
        ));
    }

    Ok(())
}

fn run_shell_command(
    main_repo_path: &str,
    worktree_path: &str,
    workspace_name: &str,
    command: &str,
) -> Result<Output, String> {
    let (shell, mut args) = resolve_shell();
    args.push(command.to_string());

    let mut process = Command::new(&shell);
    process.current_dir(worktree_path);
    process.args(&args);

    process.env("DEVHAVEN_WORKSPACE_NAME", workspace_name);
    process.env("DEVHAVEN_ROOT_PATH", main_repo_path);

    process
        .output()
        .map_err(|error| format!("执行 setup 命令失败（{}）：{}", command, error))
}

fn resolve_shell() -> (String, Vec<String>) {
    #[cfg(target_os = "windows")]
    {
        let shell = std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string());
        return (shell, vec!["/C".to_string()]);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        return (shell, vec!["-lc".to_string()]);
    }
}

fn summarize_command_output(output: &Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    let combined = match (stdout.is_empty(), stderr.is_empty()) {
        (true, true) => "命令无输出".to_string(),
        (false, true) => format!("stdout:\n{}", stdout),
        (true, false) => format!("stderr:\n{}", stderr),
        (false, false) => format!("stdout:\n{}\n\nstderr:\n{}", stdout, stderr),
    };

    const MAX_CHARS: usize = 4000;
    if combined.chars().count() <= MAX_CHARS {
        combined
    } else {
        let truncated: String = combined.chars().take(MAX_CHARS).collect();
        format!("{}\n...(输出已截断)", truncated)
    }
}
