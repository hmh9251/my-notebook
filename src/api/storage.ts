import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

/** 当前 DB 存储目录 */
export async function getStoragePath(): Promise<string> {
  return invoke("get_storage_path");
}

/** 在资源管理器中打开路径 */
export async function openInExplorer(path: string): Promise<void> {
  return invoke("open_in_explorer", { path });
}

/** 选目录（dialog 插件） */
export async function pickDirectory(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false });
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected;
}

/** 迁移 DB 到新目录（复制 + 写 config + 重启） */
export async function changeStoragePath(newDir: string): Promise<void> {
  return invoke("change_storage_path", { newDir });
}
