use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::OnceLock;

use crate::models::{BranchListItem, GitChangedFile, GitDiffContents, GitFileStatus, GitRepoStatus};

/// 列出仓库下所有分支名称。
pub fn list_branches(base_path: &str) -> Vec<BranchListItem> {
    if !is_git_repo(base_path) {
        return Vec::new();
    }

    let result = execute_git_command(base_path, &["branch", "--list"]);
    if !result.success {
        return Vec::new();
    }

    let branches: Vec<String> = result
        .output
        .lines()
        .map(|line| line.replace('*', "").trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();

    let default_branch = resolve_default_branch(&branches, base_path);

    branches
        .into_iter()
        .map(|name| BranchListItem {
            is_main: default_branch.as_deref() == Some(name.as_str()),
            name,
        })
        .collect()
}

/// 判断路径是否为 Git 仓库（以 `<path>/.git` 是否存在为准）。
///
/// 注意：worktree 场景下 `.git` 可能是文件，但依然视为存在。
pub fn is_git_repo(path: &str) -> bool {
    Path::new(path).join(".git").exists()
}

/// 获取仓库状态（staged/unstaged/untracked + 分支信息）。
pub fn get_repo_status(base_path: &str) -> Result<GitRepoStatus, String> {
    if !is_git_repo(base_path) {
        return Err("不是 Git 仓库".to_string());
    }

    let result = execute_git_command(base_path, &["status", "--porcelain=v2", "-z", "-b"]);
    if !result.success {
        return Err(result.output);
    }

    parse_porcelain_v2_status(&result.output)
}

/// 获取单文件对比用的原始/修改内容（用于 Monaco DiffEditor）。
///
/// - staged=true: original=HEAD:<old_or_current_path> modified=:<current_path>
/// - staged=false: original=:<old_or_current_path> modified=工作区文件内容
pub fn get_diff_contents(
    base_path: &str,
    relative_path: &str,
    staged: bool,
    old_relative_path: Option<&str>,
) -> Result<GitDiffContents, String> {
    if !is_git_repo(base_path) {
        return Err("不是 Git 仓库".to_string());
    }
    let relative_path = relative_path.trim();
    if relative_path.is_empty() {
        return Err("路径为空".to_string());
    }

    let old_path = old_relative_path
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or(relative_path);

    const MAX_FILE_BYTES: usize = 1_200_000;

    let (original_bytes, original_truncated) = if staged {
        let spec = format!("HEAD:{old_path}");
        read_git_object_optional(base_path, &spec, MAX_FILE_BYTES)?
    } else {
        let spec = format!(":{old_path}");
        read_git_object_optional(base_path, &spec, MAX_FILE_BYTES)?
    };

    let (modified_bytes, modified_truncated) = if staged {
        let spec = format!(":{relative_path}");
        read_git_object_optional(base_path, &spec, MAX_FILE_BYTES)?
    } else {
        read_worktree_file_optional(base_path, relative_path, MAX_FILE_BYTES)?
    };

    let original = bytes_to_text(original_bytes)?;
    let modified = bytes_to_text(modified_bytes)?;

    Ok(GitDiffContents {
        original,
        modified,
        original_truncated,
        modified_truncated,
    })
}

/// 暂存文件（git add）。
pub fn stage_files(base_path: &str, relative_paths: &[String]) -> Result<(), String> {
    run_git_with_paths(base_path, ["add", "--"], relative_paths)
}

/// 取消暂存（git reset HEAD -- <paths>）。
pub fn unstage_files(base_path: &str, relative_paths: &[String]) -> Result<(), String> {
    run_git_with_paths(base_path, ["reset", "HEAD", "--"], relative_paths)
}

/// 丢弃未暂存修改（git checkout -- <paths>）。
pub fn discard_files(base_path: &str, relative_paths: &[String]) -> Result<(), String> {
    run_git_with_paths(base_path, ["checkout", "--"], relative_paths)
}

/// 提交已暂存改动（git commit -m）。
pub fn commit(base_path: &str, message: &str) -> Result<(), String> {
    if !is_git_repo(base_path) {
        return Err("不是 Git 仓库".to_string());
    }
    let message = message.trim();
    if message.is_empty() {
        return Err("提交信息不能为空".to_string());
    }
    let result = execute_git_command(base_path, &["commit", "-m", message]);
    if result.success {
        Ok(())
    } else {
        Err(result.output)
    }
}

/// 切换分支（git checkout <branch>）。
pub fn checkout_branch(base_path: &str, branch: &str) -> Result<(), String> {
    if !is_git_repo(base_path) {
        return Err("不是 Git 仓库".to_string());
    }
    let branch = branch.trim();
    if branch.is_empty() {
        return Err("分支名不能为空".to_string());
    }
    let result = execute_git_command(base_path, &["checkout", branch]);
    if result.success {
        Ok(())
    } else {
        Err(result.output)
    }
}

// 执行 Git 命令并统一输出格式。
fn execute_git_command(path: &str, args: &[&str]) -> GitCommandResult {
    let output = Command::new(resolve_git_executable())
        .args(args)
        .current_dir(path)
        .output();

    match output {
        Ok(output) => {
            let success = output.status.success();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let combined = if success {
                stdout
            } else if stderr.is_empty() {
                stdout
            } else {
                format!("{stdout}\n{stderr}").trim().to_string()
            };
            GitCommandResult {
                success,
                output: combined,
            }
        }
        Err(err) => GitCommandResult {
            success: false,
            output: format!("执行命令失败: {err}"),
        },
    }
}

fn is_git_show_not_found(stderr: &str) -> bool {
    let msg = stderr.to_ascii_lowercase();
    msg.contains("does not exist")
        || msg.contains("not in the index")
        || msg.contains("exists on disk, but not in the index")
        || msg.contains("invalid object name")
        || msg.contains("ambiguous argument")
}

fn looks_binary(bytes: &[u8]) -> bool {
    bytes.iter().take(8000).any(|b| *b == 0)
}

fn bytes_to_text(bytes: Option<Vec<u8>>) -> Result<String, String> {
    match bytes {
        None => Ok(String::new()),
        Some(bytes) => {
            if looks_binary(&bytes) {
                return Err("检测到二进制文件，无法以文本对比展示。".to_string());
            }
            Ok(String::from_utf8_lossy(&bytes).to_string())
        }
    }
}

fn read_git_object_optional(
    base_path: &str,
    spec: &str,
    max_bytes: usize,
) -> Result<(Option<Vec<u8>>, bool), String> {
    let output = Command::new(resolve_git_executable())
        .args(["show", spec])
        .current_dir(base_path)
        .output()
        .map_err(|err| format!("执行命令失败: {err}"))?;

    if output.status.success() {
        let (bytes, truncated) = truncate_bytes(output.stdout, max_bytes);
        return Ok((Some(bytes), truncated));
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if is_git_show_not_found(&stderr) {
        return Ok((None, false));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stderr.is_empty() {
        Err(stdout)
    } else if stdout.is_empty() {
        Err(stderr)
    } else {
        Err(format!("{stdout}\n{stderr}").trim().to_string())
    }
}

fn read_worktree_file_optional(
    base_path: &str,
    relative_path: &str,
    max_bytes: usize,
) -> Result<(Option<Vec<u8>>, bool), String> {
    use std::io::Read;

    let path = Path::new(base_path).join(relative_path);
    let file = match fs::File::open(&path) {
        Ok(file) => file,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok((None, false)),
        Err(err) => return Err(format!("读取文件失败: {err}")),
    };

    let mut buf: Vec<u8> = Vec::new();
    let mut handle = file.take((max_bytes as u64) + 1);
    handle
        .read_to_end(&mut buf)
        .map_err(|err| format!("读取文件失败: {err}"))?;

    let truncated = buf.len() > max_bytes;
    if truncated {
        buf.truncate(max_bytes);
    }
    Ok((Some(buf), truncated))
}

fn truncate_bytes(mut bytes: Vec<u8>, max_bytes: usize) -> (Vec<u8>, bool) {
    if bytes.len() <= max_bytes {
        return (bytes, false);
    }
    bytes.truncate(max_bytes);
    (bytes, true)
}

fn resolve_git_executable() -> &'static str {
    static BIN: OnceLock<String> = OnceLock::new();
    BIN.get_or_init(|| {
        if Path::new("/usr/bin/git").exists() {
            "/usr/bin/git".to_string()
        } else {
            "git".to_string()
        }
    })
    .as_str()
}

fn run_git_with_paths<const N: usize>(
    base_path: &str,
    prefix_args: [&str; N],
    relative_paths: &[String],
) -> Result<(), String> {
    if !is_git_repo(base_path) {
        return Err("不是 Git 仓库".to_string());
    }
    if relative_paths.is_empty() {
        return Ok(());
    }

    let output = Command::new(resolve_git_executable())
        .args(prefix_args)
        .args(relative_paths)
        .current_dir(base_path)
        .output()
        .map_err(|err| format!("执行命令失败: {err}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        Err(stdout)
    } else if stdout.is_empty() {
        Err(stderr)
    } else {
        Err(format!("{stdout}\n{stderr}").trim().to_string())
    }
}

fn parse_porcelain_v2_status(output: &str) -> Result<GitRepoStatus, String> {
    let mut branch = String::new();
    let mut upstream: Option<String> = None;
    let mut ahead: i32 = 0;
    let mut behind: i32 = 0;
    let mut staged: Vec<GitChangedFile> = Vec::new();
    let mut unstaged: Vec<GitChangedFile> = Vec::new();
    let mut untracked: Vec<GitChangedFile> = Vec::new();

    let parts: Vec<&str> = output.split('\0').collect();
    let mut index = 0usize;
    while index < parts.len() {
        let record = parts[index];
        if record.is_empty() {
            index += 1;
            continue;
        }

        if let Some(rest) = record.strip_prefix("# ") {
            if let Some(value) = rest.strip_prefix("branch.head ") {
                branch = value.trim().to_string();
            } else if let Some(value) = rest.strip_prefix("branch.upstream ") {
                let value = value.trim();
                if !value.is_empty() {
                    upstream = Some(value.to_string());
                }
            } else if let Some(value) = rest.strip_prefix("branch.ab ") {
                // Format: +A -B
                let mut iter = value.split_whitespace();
                let ahead_token = iter.next().unwrap_or("");
                let behind_token = iter.next().unwrap_or("");
                ahead = ahead_token
                    .trim_start_matches('+')
                    .parse::<i32>()
                    .unwrap_or(0);
                behind = behind_token
                    .trim_start_matches('-')
                    .parse::<i32>()
                    .unwrap_or(0);
            }
            index += 1;
            continue;
        }

        let record_type = record.chars().next().unwrap_or(' ');
        match record_type {
            '1' => {
                parse_change_record(
                    record,
                    8,
                    None,
                    &mut staged,
                    &mut unstaged,
                );
            }
            '2' => {
                let old_path = parts.get(index + 1).map(|value| (*value).to_string());
                parse_change_record(
                    record,
                    9,
                    old_path,
                    &mut staged,
                    &mut unstaged,
                );
                // Record type 2 uses an extra NUL-delimited pathname
                index += 1;
            }
            '?' => {
                // Format: "? <path>"
                if let Some(path) = record.strip_prefix("? ") {
                    let path = path.trim();
                    if !path.is_empty() {
                        untracked.push(GitChangedFile {
                            path: path.to_string(),
                            old_path: None,
                            status: GitFileStatus::Untracked,
                        });
                    }
                }
            }
            // ignore ignored files: "! <path>"
            '!' => {}
            _ => {
                // Unrecognized record type; ignore to avoid breaking the UI.
            }
        }

        index += 1;
    }

    if branch.is_empty() {
        branch = "HEAD".to_string();
    }

    Ok(GitRepoStatus {
        branch,
        upstream,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
    })
}

fn parse_change_record(
    record: &str,
    path_token_start_index: usize,
    old_path: Option<String>,
    staged: &mut Vec<GitChangedFile>,
    unstaged: &mut Vec<GitChangedFile>,
) {
    let tokens: Vec<&str> = record.split_whitespace().collect();
    if tokens.len() < 2 {
        return;
    }
    let xy = tokens[1];
    let x = xy.chars().next().unwrap_or('.');
    let y = xy.chars().nth(1).unwrap_or('.');

    if tokens.len() <= path_token_start_index {
        return;
    }
    let path_tokens = &tokens[path_token_start_index..];
    let path = path_tokens.join(" ").trim().to_string();
    if path.is_empty() {
        return;
    }

    if x != '.' && x != ' ' {
        staged.push(GitChangedFile {
            path: path.clone(),
            old_path: old_path.clone(),
            status: map_git_status_char(x),
        });
    }

    if y != '.' && y != ' ' {
        unstaged.push(GitChangedFile {
            path,
            old_path,
            status: map_git_status_char(y),
        });
    }
}

fn map_git_status_char(value: char) -> GitFileStatus {
    match value {
        'A' => GitFileStatus::Added,
        'M' => GitFileStatus::Modified,
        'D' => GitFileStatus::Deleted,
        'R' => GitFileStatus::Renamed,
        'C' => GitFileStatus::Copied,
        '?' => GitFileStatus::Untracked,
        _ => GitFileStatus::Modified,
    }
}

fn resolve_default_branch(branches: &[String], base_path: &str) -> Option<String> {
    let symbolic = execute_git_command(base_path, &["symbolic-ref", "refs/remotes/origin/HEAD"]);
    if symbolic.success {
        if let Some(name) = symbolic.output.split('/').last() {
            let name = name.trim();
            if branches.iter().any(|branch| branch == name) {
                return Some(name.to_string());
            }
        }
    }

    if branches.iter().any(|branch| branch == "main") {
        return Some("main".to_string());
    }
    if branches.iter().any(|branch| branch == "master") {
        return Some("master".to_string());
    }

    None
}

struct GitCommandResult {
    success: bool,
    output: String,
}
