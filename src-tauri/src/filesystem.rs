use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::models::{
    FsEntry, FsEntryKind, FsFailureReason, FsListResponse, FsReadResponse, FsWriteResponse,
};

const MAX_FILE_PREVIEW_BYTES: u64 = 512 * 1024;

pub fn list_dir_entries(
    project_path: &str,
    relative_path: &str,
    show_hidden: bool,
) -> FsListResponse {
    let root = Path::new(project_path);
    let relative = Path::new(relative_path);

    let target = match resolve_project_path(root, relative) {
        Ok(value) => value,
        Err(reason) => {
            return FsListResponse {
                ok: false,
                relative_path: relative_path.to_string(),
                entries: Vec::new(),
                reason: Some(reason),
                message: None,
            };
        }
    };

    let metadata = match fs::metadata(&target) {
        Ok(value) => value,
        Err(err) => {
            let reason = if err.kind() == std::io::ErrorKind::NotFound {
                FsFailureReason::NotFound
            } else {
                FsFailureReason::IoError
            };
            return FsListResponse {
                ok: false,
                relative_path: relative_path.to_string(),
                entries: Vec::new(),
                reason: Some(reason),
                message: Some(format!("读取目录失败: {err}")),
            };
        }
    };

    if !metadata.is_dir() {
        return FsListResponse {
            ok: false,
            relative_path: relative_path.to_string(),
            entries: Vec::new(),
            reason: Some(FsFailureReason::NotADirectory),
            message: None,
        };
    }

    let read_dir = match fs::read_dir(&target) {
        Ok(value) => value,
        Err(err) => {
            return FsListResponse {
                ok: false,
                relative_path: relative_path.to_string(),
                entries: Vec::new(),
                reason: Some(FsFailureReason::IoError),
                message: Some(format!("读取目录失败: {err}")),
            };
        }
    };

    let mut entries = Vec::new();
    for entry in read_dir.flatten() {
        let file_type = match entry.file_type() {
            Ok(value) => value,
            Err(_) => continue,
        };
        if file_type.is_symlink() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        if !show_hidden && name.starts_with('.') {
            continue;
        }

        let kind = if file_type.is_dir() {
            FsEntryKind::Dir
        } else if file_type.is_file() {
            FsEntryKind::File
        } else {
            continue;
        };

        let absolute_path = entry.path();
        let relative_candidate = match absolute_path.strip_prefix(root) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let normalized_relative_path = normalize_path(relative_candidate);

        let size = if matches!(kind, FsEntryKind::File) {
            entry.metadata().ok().map(|value| value.len())
        } else {
            None
        };

        entries.push(FsEntry {
            name,
            relative_path: normalized_relative_path,
            kind,
            size,
        });
    }

    entries.sort_by(|a, b| {
        let kind_key = |kind: &FsEntryKind| match kind {
            FsEntryKind::Dir => 0,
            FsEntryKind::File => 1,
        };
        let left = (kind_key(&a.kind), a.name.to_lowercase());
        let right = (kind_key(&b.kind), b.name.to_lowercase());
        left.cmp(&right)
    });

    FsListResponse {
        ok: true,
        relative_path: relative_path.to_string(),
        entries,
        reason: None,
        message: None,
    }
}

pub fn read_file(project_path: &str, relative_path: &str) -> FsReadResponse {
    let root = Path::new(project_path);
    let relative = Path::new(relative_path);

    let target = match resolve_project_path(root, relative) {
        Ok(value) => value,
        Err(reason) => {
            return FsReadResponse {
                ok: false,
                relative_path: relative_path.to_string(),
                content: None,
                size: 0,
                max_size: MAX_FILE_PREVIEW_BYTES,
                reason: Some(reason),
                message: None,
            };
        }
    };

    let metadata = match fs::metadata(&target) {
        Ok(value) => value,
        Err(err) => {
            let reason = if err.kind() == std::io::ErrorKind::NotFound {
                FsFailureReason::NotFound
            } else {
                FsFailureReason::IoError
            };
            return FsReadResponse {
                ok: false,
                relative_path: relative_path.to_string(),
                content: None,
                size: 0,
                max_size: MAX_FILE_PREVIEW_BYTES,
                reason: Some(reason),
                message: Some(format!("读取文件失败: {err}")),
            };
        }
    };

    if !metadata.is_file() {
        return FsReadResponse {
            ok: false,
            relative_path: relative_path.to_string(),
            content: None,
            size: 0,
            max_size: MAX_FILE_PREVIEW_BYTES,
            reason: Some(FsFailureReason::NotAFile),
            message: None,
        };
    }

    let size = metadata.len();
    if size > MAX_FILE_PREVIEW_BYTES {
        return FsReadResponse {
            ok: false,
            relative_path: relative_path.to_string(),
            content: None,
            size,
            max_size: MAX_FILE_PREVIEW_BYTES,
            reason: Some(FsFailureReason::TooLarge),
            message: None,
        };
    }

    let bytes = match fs::read(&target) {
        Ok(value) => value,
        Err(err) => {
            return FsReadResponse {
                ok: false,
                relative_path: relative_path.to_string(),
                content: None,
                size,
                max_size: MAX_FILE_PREVIEW_BYTES,
                reason: Some(FsFailureReason::IoError),
                message: Some(format!("读取文件失败: {err}")),
            };
        }
    };

    if bytes.iter().any(|byte| *byte == 0) {
        return FsReadResponse {
            ok: false,
            relative_path: relative_path.to_string(),
            content: None,
            size,
            max_size: MAX_FILE_PREVIEW_BYTES,
            reason: Some(FsFailureReason::Binary),
            message: None,
        };
    }

    let content = match String::from_utf8(bytes) {
        Ok(value) => value,
        Err(_) => {
            return FsReadResponse {
                ok: false,
                relative_path: relative_path.to_string(),
                content: None,
                size,
                max_size: MAX_FILE_PREVIEW_BYTES,
                reason: Some(FsFailureReason::Binary),
                message: None,
            };
        }
    };

    FsReadResponse {
        ok: true,
        relative_path: relative_path.to_string(),
        content: Some(content),
        size,
        max_size: MAX_FILE_PREVIEW_BYTES,
        reason: None,
        message: None,
    }
}

pub fn write_file(project_path: &str, relative_path: &str, content: &str) -> FsWriteResponse {
    let root = Path::new(project_path);
    let relative = Path::new(relative_path);

    let target = match resolve_project_path(root, relative) {
        Ok(value) => value,
        Err(reason) => {
            return FsWriteResponse {
                ok: false,
                relative_path: relative_path.to_string(),
                size: 0,
                max_size: MAX_FILE_PREVIEW_BYTES,
                reason: Some(reason),
                message: None,
            };
        }
    };

    let metadata = match fs::metadata(&target) {
        Ok(value) => value,
        Err(err) => {
            let reason = if err.kind() == std::io::ErrorKind::NotFound {
                FsFailureReason::NotFound
            } else {
                FsFailureReason::IoError
            };
            return FsWriteResponse {
                ok: false,
                relative_path: relative_path.to_string(),
                size: 0,
                max_size: MAX_FILE_PREVIEW_BYTES,
                reason: Some(reason),
                message: Some(format!("读取文件失败: {err}")),
            };
        }
    };

    if !metadata.is_file() {
        return FsWriteResponse {
            ok: false,
            relative_path: relative_path.to_string(),
            size: 0,
            max_size: MAX_FILE_PREVIEW_BYTES,
            reason: Some(FsFailureReason::NotAFile),
            message: None,
        };
    }

    let bytes = content.as_bytes();
    let size = bytes.len() as u64;
    if size > MAX_FILE_PREVIEW_BYTES {
        return FsWriteResponse {
            ok: false,
            relative_path: relative_path.to_string(),
            size,
            max_size: MAX_FILE_PREVIEW_BYTES,
            reason: Some(FsFailureReason::TooLarge),
            message: None,
        };
    }

    // Reject NUL-containing content to avoid accidentally writing binary-like payloads.
    if bytes.iter().any(|byte| *byte == 0) {
        return FsWriteResponse {
            ok: false,
            relative_path: relative_path.to_string(),
            size,
            max_size: MAX_FILE_PREVIEW_BYTES,
            reason: Some(FsFailureReason::Binary),
            message: None,
        };
    }

    if let Err(err) = fs::write(&target, bytes) {
        return FsWriteResponse {
            ok: false,
            relative_path: relative_path.to_string(),
            size,
            max_size: MAX_FILE_PREVIEW_BYTES,
            reason: Some(FsFailureReason::IoError),
            message: Some(format!("写入文件失败: {err}")),
        };
    }

    FsWriteResponse {
        ok: true,
        relative_path: relative_path.to_string(),
        size,
        max_size: MAX_FILE_PREVIEW_BYTES,
        reason: None,
        message: None,
    }
}

fn resolve_project_path(root: &Path, relative: &Path) -> Result<PathBuf, FsFailureReason> {
    if !root.exists() {
        return Err(FsFailureReason::NotFound);
    }
    if relative.is_absolute() {
        return Err(FsFailureReason::InvalidPath);
    }

    let mut target = root.to_path_buf();
    for component in relative.components() {
        match component {
            Component::CurDir => continue,
            Component::Normal(segment) => {
                target.push(segment);
                let metadata = match fs::symlink_metadata(&target) {
                    Ok(value) => value,
                    Err(err) => {
                        return Err(if err.kind() == std::io::ErrorKind::NotFound {
                            FsFailureReason::NotFound
                        } else {
                            FsFailureReason::IoError
                        });
                    }
                };
                if metadata.file_type().is_symlink() {
                    return Err(FsFailureReason::SymlinkEscape);
                }
            }
            Component::ParentDir => return Err(FsFailureReason::OutsideProject),
            _ => return Err(FsFailureReason::InvalidPath),
        }
    }

    Ok(target)
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}
