use std::collections::BTreeMap;
use std::path::Path;
use std::process::Command;

use crate::models::GitDailyResult;

pub fn collect_git_daily(paths: &[String]) -> Vec<GitDailyResult> {
    paths.iter().map(|path| collect_single(path)).collect()
}

fn collect_single(path: &str) -> GitDailyResult {
    let repo_root = Path::new(path);
    if !repo_root.join(".git").exists() {
        return GitDailyResult {
            path: path.to_string(),
            git_daily: None,
            error: None,
        };
    }

    let output = Command::new("git")
        .args(["log", "--pretty=format:%cd", "--date=short"])
        .current_dir(repo_root)
        .output();

    let output = match output {
        Ok(output) => output,
        Err(err) => {
            return GitDailyResult {
                path: path.to_string(),
                git_daily: None,
                error: Some(format!("执行 git log 失败: {err}")),
            }
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return GitDailyResult {
            path: path.to_string(),
            git_daily: None,
            error: Some(format!("git log 返回失败: {stderr}")),
        };
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut counts: BTreeMap<String, i64> = BTreeMap::new();

    for line in stdout.lines() {
        let date = line.trim();
        if date.is_empty() {
            continue;
        }
        *counts.entry(date.to_string()).or_insert(0) += 1;
    }

    if counts.is_empty() {
        return GitDailyResult {
            path: path.to_string(),
            git_daily: None,
            error: None,
        };
    }

    let git_daily = counts
        .iter()
        .map(|(date, count)| format!("{date}:{count}"))
        .collect::<Vec<_>>()
        .join(",");

    GitDailyResult {
        path: path.to_string(),
        git_daily: Some(git_daily),
        error: None,
    }
}
