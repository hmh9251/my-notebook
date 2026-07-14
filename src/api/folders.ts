import { invoke } from "@tauri-apps/api/core";
import type { Folder } from "@/types/note";

export async function getFolders(): Promise<Folder[]> {
  return invoke("get_folders");
}

export async function getUncatCount(): Promise<number> {
  return invoke("get_uncat_count");
}

export async function createFolder(name: string): Promise<number> {
  return invoke("create_folder", { name });
}

export async function renameFolder(id: number, name: string): Promise<void> {
  return invoke("rename_folder", { id, name });
}

export async function deleteFolder(id: number): Promise<void> {
  return invoke("delete_folder", { id });
}

export async function moveNote(id: number, folderId: number | null): Promise<void> {
  return invoke("move_note", { id, folderId });
}
