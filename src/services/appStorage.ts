import { invoke } from "@tauri-apps/api/core";

import type { AppStateFile, Project } from "../models/types";

/** 读取应用状态文件。 */
export async function loadAppState(): Promise<AppStateFile> {
  return invoke<AppStateFile>("load_app_state");
}

/** 保存应用状态文件。 */
export async function saveAppState(state: AppStateFile): Promise<void> {
  await invoke("save_app_state", { state });
}

/** 读取项目缓存列表。 */
export async function loadProjects(): Promise<Project[]> {
  return invoke<Project[]>("load_projects");
}

/** 保存项目缓存列表。 */
export async function saveProjects(projects: Project[]): Promise<void> {
  await invoke("save_projects", { projects });
}

/** 扫描目录，返回可识别的项目路径集合。 */
export async function discoverProjects(directories: string[]): Promise<string[]> {
  return invoke<string[]>("discover_projects", { directories });
}

/** 基于路径与缓存数据构建项目列表。 */
export async function buildProjects(paths: string[], existing: Project[]): Promise<Project[]> {
  return invoke<Project[]>("build_projects", { paths, existing });
}
