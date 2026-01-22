import { invoke } from "@tauri-apps/api/core";

export type EditorOpenParams = {
  path: string;
  app_name?: string | null;
  bundle_id?: string | null;
  command_path?: string | null;
  arguments?: string[] | null;
};

/** 在系统文件管理器中定位路径。 */
export async function openInFinder(path: string) {
  await invoke("open_in_finder", { path });
}

/** 在终端中打开指定目录。 */
export async function openInTerminal(path: string) {
  await invoke("open_in_terminal", { path });
}

/** 使用指定编辑器打开文件或目录。 */
export async function openInEditor(params: EditorOpenParams) {
  await invoke("open_in_editor", { params });
}

/** 将内容写入系统剪贴板。 */
export async function copyToClipboard(content: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(content);
      return;
    } catch (error) {
      console.warn("浏览器剪贴板写入失败，尝试使用系统命令。", error);
    }
  }
  await invoke("copy_to_clipboard", { content });
}
