import { invoke } from "@tauri-apps/api/core";

import type { BranchListItem } from "../models/branch";

/** 获取指定 Git 仓库根目录的分支列表。 */
export async function listBranches(basePath: string): Promise<BranchListItem[]> {
  return invoke<BranchListItem[]>("list_branches", { basePath });
}
