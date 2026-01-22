import { invoke } from "@tauri-apps/api/core";

/** 读取项目备注内容，未设置时返回 null。 */
export async function readProjectNotes(path: string): Promise<string | null> {
  return invoke<string | null>("read_project_notes", { path });
}

/** 写入项目备注内容，传 null 则删除备注文件。 */
export async function writeProjectNotes(path: string, notes: string | null) {
  await invoke("write_project_notes", { path, notes });
}
