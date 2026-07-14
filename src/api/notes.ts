import { invoke } from "@tauri-apps/api/core";
import type { Note } from "@/types/note";

export async function getNotes(filter: string, folderId: number | null): Promise<Note[]> {
  return invoke("get_notes", { filter, folderId });
}

export async function getNoteById(id: number): Promise<Note | null> {
  return invoke("get_note_by_id", { id });
}

export async function createNote(title: string, folderId: number | null): Promise<Note> {
  return invoke("create_note", { title, folderId });
}

export async function updateNote(note: Note): Promise<Note> {
  return invoke("update_note", { note });
}

export async function deleteNote(id: number): Promise<void> {
  return invoke("delete_note", { id });
}
