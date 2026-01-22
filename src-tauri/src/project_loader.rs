use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::Command;

use crate::models::Project;
use crate::time_utils::{now_swift, system_time_to_swift, system_time_to_unix_seconds};

/// 根据目录列表扫描可用项目路径。
pub fn discover_projects(directories: &[String]) -> Vec<String> {
    let mut all_paths = Vec::new();
    for directory in directories {
        let mut found = scan_directory_two_levels(directory);
        all_paths.append(&mut found);
    }
    all_paths.sort();
    all_paths.dedup();
    all_paths
}

/// 构建项目列表，复用已有数据并更新元信息。
pub fn build_projects(paths: &[String], existing: &[Project]) -> Vec<Project> {
    let mut existing_by_path: HashMap<&str, &Project> = HashMap::new();
    for project in existing {
        existing_by_path.insert(project.path.as_str(), project);
    }

    paths
        .iter()
        .filter_map(|path| create_project(path, &existing_by_path))
        .collect()
}

// 扫描指定目录及其直接子目录。
fn scan_directory_two_levels(path: &str) -> Vec<String> {
    let mut results = Vec::new();
    let root = Path::new(path);
    if !root.exists() {
        return results;
    }

    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(_) => return results,
    };

    for entry in entries.flatten() {
        let entry_path = entry.path();
        if entry_path.is_dir() {
            if let Some(as_str) = entry_path.to_str() {
                results.push(as_str.to_string());
            }
        }
    }

    results
}

#[cfg(test)]
mod tests {
    use super::scan_directory_two_levels;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn scan_directory_two_levels_excludes_root() {
        let root = std::env::temp_dir().join(format!("devhaven_test_{}", uuid::Uuid::new_v4()));
        let sub_a = root.join("alpha");
        let sub_b = root.join("beta");

        fs::create_dir_all(&sub_a).expect("create alpha dir");
        fs::create_dir_all(&sub_b).expect("create beta dir");

        let root_str = root.to_string_lossy().to_string();
        let results = scan_directory_two_levels(&root_str);
        let result_paths: Vec<PathBuf> = results.into_iter().map(PathBuf::from).collect();

        assert!(!result_paths.contains(&root));
        assert!(result_paths.contains(&sub_a));
        assert!(result_paths.contains(&sub_b));

        let _ = fs::remove_dir_all(&root);
    }
}

// 创建单个项目模型，必要时复用已存在的配置。
fn create_project(path: &str, existing_by_path: &HashMap<&str, &Project>) -> Option<Project> {
    let metadata = fs::metadata(path).ok()?;
    if !metadata.is_dir() {
        return None;
    }

    let name = Path::new(path)
        .file_name()
        .and_then(|os| os.to_str())
        .unwrap_or(path)
        .to_string();

    let mtime = metadata
        .modified()
        .map(system_time_to_swift)
        .unwrap_or_else(|_| now_swift());

    let unix_mtime = metadata
        .modified()
        .map(system_time_to_unix_seconds)
        .unwrap_or(0.0);
    let size = metadata.len() as i64;
    let checksum = format!("{}_{}", unix_mtime, size);

    let git_info = load_git_info(path);

    if let Some(existing) = existing_by_path.get(path) {
        return Some(Project {
            id: existing.id.clone(),
            name,
            path: path.to_string(),
            tags: existing.tags.clone(),
            mtime,
            size,
            checksum,
            git_commits: git_info.commit_count,
            git_last_commit: git_info.last_commit,
            git_daily: existing.git_daily.clone(),
            created: existing.created,
            checked: now_swift(),
        });
    }

    Some(Project {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        path: path.to_string(),
        tags: Vec::new(),
        mtime,
        size,
        checksum,
        git_commits: git_info.commit_count,
        git_last_commit: git_info.last_commit,
        git_daily: None,
        created: now_swift(),
        checked: now_swift(),
    })
}

struct GitInfo {
    commit_count: i64,
    last_commit: f64,
}

// 读取 Git 信息（提交次数与最后提交时间）。
fn load_git_info(path: &str) -> GitInfo {
    let git_dir = Path::new(path).join(".git");
    if !git_dir.exists() {
        return GitInfo {
            commit_count: 0,
            last_commit: 0.0,
        };
    }

    let last_commit = run_git_command(path, &["log", "--format=%ct", "-n", "1"])
        .and_then(|output| output.trim().parse::<f64>().ok())
        .unwrap_or(0.0);

    let commit_count = run_git_command(path, &["rev-list", "--count", "HEAD"])
        .and_then(|output| output.trim().parse::<i64>().ok())
        .unwrap_or(0);

    GitInfo {
        commit_count,
        last_commit: crate::time_utils::unix_to_swift(last_commit),
    }
}

// 执行 Git 命令并返回输出内容。
fn run_git_command(path: &str, args: &[&str]) -> Option<String> {
    let output = Command::new("/usr/bin/git")
        .args(args)
        .current_dir(path)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    String::from_utf8(output.stdout).ok()
}
