use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::git_ops;
use crate::models::{
    WorktreeInitCancelResult, WorktreeInitJobStatus, WorktreeInitProgressPayload,
    WorktreeInitRetryRequest, WorktreeInitStartRequest, WorktreeInitStartResult,
    WorktreeInitStatusQuery, WorktreeInitStep,
};

pub const WORKTREE_INIT_PROGRESS_EVENT: &str = "worktree-init-progress";

#[derive(Clone, Default)]
pub struct WorktreeInitState {
    inner: Arc<Mutex<WorktreeInitRuntime>>,
}

#[derive(Default)]
struct WorktreeInitRuntime {
    jobs: HashMap<String, WorktreeInitJob>,
    running_projects: HashSet<String>,
}

#[derive(Clone)]
struct WorktreeInitJob {
    job_id: String,
    project_id: String,
    project_path: String,
    project_key: String,
    worktree_path: String,
    branch: String,
    create_branch: bool,
    step: WorktreeInitStep,
    message: String,
    error: Option<String>,
    updated_at: i64,
    is_running: bool,
    cancel_requested: bool,
}

impl WorktreeInitState {
    pub fn start(
        &self,
        app: &AppHandle,
        request: WorktreeInitStartRequest,
    ) -> Result<WorktreeInitStartResult, String> {
        let project_path = request.project_path.trim().to_string();
        if project_path.is_empty() {
            return Err("项目路径不能为空".to_string());
        }

        if !git_ops::is_git_repo(&project_path) {
            return Err("不是 Git 仓库".to_string());
        }

        let branch = request.branch.trim().to_string();
        if branch.is_empty() {
            return Err("分支名不能为空".to_string());
        }

        let worktree_path = git_ops::resolve_worktree_target_path(
            &project_path,
            &branch,
            request.target_path.as_deref(),
        )?;

        let project_key = normalize_path_for_compare(&project_path);
        let now = now_millis();
        let job_id = Uuid::new_v4().to_string();

        let job = WorktreeInitJob {
            job_id: job_id.clone(),
            project_id: request.project_id.clone(),
            project_path: project_path.clone(),
            project_key: project_key.clone(),
            worktree_path: worktree_path.clone(),
            branch: branch.clone(),
            create_branch: request.create_branch,
            step: WorktreeInitStep::Pending,
            message: "已进入创建队列".to_string(),
            error: None,
            updated_at: now,
            is_running: true,
            cancel_requested: false,
        };

        {
            let mut runtime = self
                .inner
                .lock()
                .map_err(|_| "worktree 初始化状态锁定失败".to_string())?;

            if runtime.running_projects.contains(&project_key) {
                return Err("该项目已有 worktree 正在创建，请稍候".to_string());
            }

            runtime.running_projects.insert(project_key);
            runtime.jobs.insert(job_id.clone(), job);
        }

        self.emit_progress(
            app,
            &job_id,
            WorktreeInitStep::Pending,
            "已进入创建队列".to_string(),
            None,
        );

        self.spawn_job(app.clone(), job_id.clone());

        Ok(WorktreeInitStartResult {
            job_id,
            project_id: request.project_id,
            project_path,
            worktree_path,
            branch,
            step: WorktreeInitStep::Pending,
            message: "已进入创建队列".to_string(),
        })
    }

    pub fn cancel(
        &self,
        app: &AppHandle,
        job_id: &str,
    ) -> Result<WorktreeInitCancelResult, String> {
        let mut runtime = self
            .inner
            .lock()
            .map_err(|_| "worktree 初始化状态锁定失败".to_string())?;

        let Some(job) = runtime.jobs.get_mut(job_id) else {
            return Err("创建任务不存在".to_string());
        };

        job.cancel_requested = true;
        job.updated_at = now_millis();

        if job.is_running {
            let payload = WorktreeInitProgressPayload {
                job_id: job.job_id.clone(),
                project_id: job.project_id.clone(),
                project_path: job.project_path.clone(),
                worktree_path: job.worktree_path.clone(),
                branch: job.branch.clone(),
                step: job.step.clone(),
                message: "已收到取消请求，等待当前步骤结束".to_string(),
                error: None,
            };
            if let Err(error) = app.emit(WORKTREE_INIT_PROGRESS_EVENT, payload) {
                log::warn!("发送 worktree-init-progress 失败: {}", error);
            }
        }

        Ok(WorktreeInitCancelResult {
            job_id: job_id.to_string(),
            cancelled: true,
        })
    }

    pub fn retry(
        &self,
        app: &AppHandle,
        request: WorktreeInitRetryRequest,
    ) -> Result<WorktreeInitStartResult, String> {
        let runtime = self
            .inner
            .lock()
            .map_err(|_| "worktree 初始化状态锁定失败".to_string())?;

        let Some(job) = runtime.jobs.get(&request.job_id) else {
            return Err("创建任务不存在".to_string());
        };

        if job.is_running {
            return Err("创建任务仍在进行中，暂不可重试".to_string());
        }

        let start_request = WorktreeInitStartRequest {
            project_id: job.project_id.clone(),
            project_path: job.project_path.clone(),
            branch: job.branch.clone(),
            create_branch: job.create_branch,
            target_path: Some(job.worktree_path.clone()),
        };

        drop(runtime);
        self.start(app, start_request)
    }

    pub fn query_status(
        &self,
        query: WorktreeInitStatusQuery,
    ) -> Result<Vec<WorktreeInitJobStatus>, String> {
        let runtime = self
            .inner
            .lock()
            .map_err(|_| "worktree 初始化状态锁定失败".to_string())?;

        let query_project_id = query.project_id.map(|value| value.trim().to_string());
        let query_project_key = query
            .project_path
            .map(|value| normalize_path_for_compare(&value));

        let mut jobs: Vec<WorktreeInitJobStatus> = runtime
            .jobs
            .values()
            .filter(|job| {
                if let Some(project_id) = query_project_id.as_ref() {
                    if &job.project_id != project_id {
                        return false;
                    }
                }
                if let Some(project_key) = query_project_key.as_ref() {
                    if &job.project_key != project_key {
                        return false;
                    }
                }
                true
            })
            .map(|job| WorktreeInitJobStatus {
                job_id: job.job_id.clone(),
                project_id: job.project_id.clone(),
                project_path: job.project_path.clone(),
                worktree_path: job.worktree_path.clone(),
                branch: job.branch.clone(),
                create_branch: job.create_branch,
                step: job.step.clone(),
                message: job.message.clone(),
                error: job.error.clone(),
                updated_at: job.updated_at,
                is_running: job.is_running,
                cancel_requested: job.cancel_requested,
            })
            .collect();

        jobs.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
        Ok(jobs)
    }

    fn spawn_job(&self, app: AppHandle, job_id: String) {
        let state = self.clone();
        thread::spawn(move || {
            state.run_job(app, job_id);
        });
    }

    fn run_job(&self, app: AppHandle, job_id: String) {
        self.emit_progress(
            &app,
            &job_id,
            WorktreeInitStep::Validating,
            "校验仓库状态...".to_string(),
            None,
        );

        if self.is_cancel_requested(&job_id) {
            self.finish_cancelled(&app, &job_id, "已取消".to_string());
            return;
        }

        self.emit_progress(
            &app,
            &job_id,
            WorktreeInitStep::CheckingBranch,
            "检查分支可用性...".to_string(),
            None,
        );

        let Some(job_snapshot) = self.snapshot_job(&job_id) else {
            return;
        };

        if let Err(error) = validate_branch(
            &job_snapshot.project_path,
            &job_snapshot.branch,
            job_snapshot.create_branch,
        ) {
            self.finish_failed(&app, &job_id, error);
            return;
        }

        if self.is_cancel_requested(&job_id) {
            self.finish_cancelled(&app, &job_id, "已取消".to_string());
            return;
        }

        self.emit_progress(
            &app,
            &job_id,
            WorktreeInitStep::CreatingWorktree,
            "正在创建 Git worktree...".to_string(),
            None,
        );

        let add_result = git_ops::add_worktree(
            &job_snapshot.project_path,
            Some(&job_snapshot.worktree_path),
            &job_snapshot.branch,
            job_snapshot.create_branch,
        );

        let created_path = match add_result {
            Ok(result) => result.path,
            Err(error) => {
                self.finish_failed(&app, &job_id, error);
                return;
            }
        };

        if self.is_cancel_requested(&job_id) {
            match git_ops::remove_worktree(&job_snapshot.project_path, &created_path, true) {
                Ok(_) => {
                    self.finish_cancelled(
                        &app,
                        &job_id,
                        "创建任务已取消，已回滚新建 worktree".to_string(),
                    );
                }
                Err(error) => {
                    self.finish_failed(
                        &app,
                        &job_id,
                        format!(
                            "创建任务已取消，但回滚失败：{}。请手动清理目录 {}",
                            error, created_path
                        ),
                    );
                }
            }
            return;
        }

        self.emit_progress(
            &app,
            &job_id,
            WorktreeInitStep::Syncing,
            "同步工作区状态...".to_string(),
            None,
        );

        if let Err(error) = git_ops::list_worktrees(&job_snapshot.project_path) {
            log::warn!("同步 worktree 列表失败: {}", error);
        }

        self.finish_ready(&app, &job_id);
    }

    fn snapshot_job(&self, job_id: &str) -> Option<WorktreeInitJob> {
        let runtime = self.inner.lock().ok()?;
        runtime.jobs.get(job_id).cloned()
    }

    fn is_cancel_requested(&self, job_id: &str) -> bool {
        let Ok(runtime) = self.inner.lock() else {
            return false;
        };
        runtime
            .jobs
            .get(job_id)
            .map(|job| job.cancel_requested)
            .unwrap_or(false)
    }

    fn finish_ready(&self, app: &AppHandle, job_id: &str) {
        self.emit_progress(
            app,
            job_id,
            WorktreeInitStep::Ready,
            "创建完成".to_string(),
            None,
        );
        self.finalize_job(job_id);
    }

    fn finish_failed(&self, app: &AppHandle, job_id: &str, error: String) {
        self.emit_progress(
            app,
            job_id,
            WorktreeInitStep::Failed,
            "创建失败".to_string(),
            Some(error),
        );
        self.finalize_job(job_id);
    }

    fn finish_cancelled(&self, app: &AppHandle, job_id: &str, message: String) {
        self.emit_progress(app, job_id, WorktreeInitStep::Cancelled, message, None);
        self.finalize_job(job_id);
    }

    fn emit_progress(
        &self,
        app: &AppHandle,
        job_id: &str,
        step: WorktreeInitStep,
        message: String,
        error: Option<String>,
    ) {
        let payload = {
            let Ok(mut runtime) = self.inner.lock() else {
                return;
            };
            let Some(job) = runtime.jobs.get_mut(job_id) else {
                return;
            };

            job.step = step.clone();
            job.message = message.clone();
            job.error = error.clone();
            job.updated_at = now_millis();

            WorktreeInitProgressPayload {
                job_id: job.job_id.clone(),
                project_id: job.project_id.clone(),
                project_path: job.project_path.clone(),
                worktree_path: job.worktree_path.clone(),
                branch: job.branch.clone(),
                step,
                message,
                error,
            }
        };

        if let Err(error) = app.emit(WORKTREE_INIT_PROGRESS_EVENT, payload) {
            log::warn!("发送 worktree-init-progress 失败: {}", error);
        }
    }

    fn finalize_job(&self, job_id: &str) {
        let Ok(mut runtime) = self.inner.lock() else {
            return;
        };

        let Some(project_key) = runtime.jobs.get(job_id).map(|job| job.project_key.clone()) else {
            return;
        };

        if let Some(job) = runtime.jobs.get_mut(job_id) {
            job.is_running = false;
        }

        runtime.running_projects.remove(&project_key);
    }
}

fn validate_branch(project_path: &str, branch: &str, create_branch: bool) -> Result<(), String> {
    let branches = git_ops::list_branches(project_path);

    if create_branch {
        if branches.iter().any(|item| item.name == branch) {
            return Err("分支已存在，请改用“已有分支”模式或更换分支名".to_string());
        }
        return Ok(());
    }

    if branches.iter().any(|item| item.name == branch) {
        return Ok(());
    }

    Err("分支不存在或不可用，请检查分支名称".to_string())
}

fn normalize_path_for_compare(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let normalized = trimmed.replace('\\', "/").trim_end_matches('/').to_string();
    if cfg!(windows) {
        normalized.to_ascii_lowercase()
    } else {
        normalized
    }
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
