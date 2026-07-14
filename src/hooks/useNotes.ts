import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/notes";
import type { Note } from "@/types/note";

export function useNotes(filter: string, folderId: number | null) {
  return useQuery({
    queryKey: ["notes", filter, folderId],
    queryFn: () => api.getNotes(filter, folderId),
  });
}

export function useNoteById(id: number | undefined) {
  return useQuery({
    queryKey: ["note", id],
    queryFn: () => (id == null ? null : api.getNoteById(id)),
    enabled: id != null,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, folderId }: { title: string; folderId: number | null }) =>
      api.createNote(title, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["uncatCount"] });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: Note) => api.updateNote(note),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["note", updated.id] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["uncatCount"] });
    },
  });
}
