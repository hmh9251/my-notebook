import { useEffect } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";
import { useNotes, useNoteById, useCreateNote } from "@/hooks/useNotes";
import { NoteListPane } from "@/components/note-list-pane";
import { NoteEditor } from "@/components/note-editor";

export function Notes() {
  const selectedNoteId = useUIStore((s) => s.selectedNoteId);
  const setSelectedNoteId = useUIStore((s) => s.setSelectedNoteId);
  const noteFolderFilter = useUIStore((s) => s.noteFolderFilter);
  const setNoteFolderFilter = useUIStore((s) => s.setNoteFolderFilter);

  const filterStr =
    noteFolderFilter === "uncat" ? "uncat" : noteFolderFilter != null ? "folder" : "all";
  const folderId = typeof noteFolderFilter === "number" ? noteFolderFilter : null;

  const { data: notes = [], isLoading } = useNotes(filterStr, folderId);
  const { data: selectedNote } = useNoteById(selectedNoteId ?? undefined);
  const createNote = useCreateNote();

  useEffect(() => {
    if (selectedNoteId != null && notes.length > 0 && !notes.some((n) => n.id === selectedNoteId)) {
      if (noteFolderFilter !== null) setNoteFolderFilter(null);
    }
  }, [selectedNoteId, notes, noteFolderFilter, setNoteFolderFilter]);

  const handleCreate = async () => {
    try {
      const fid = typeof noteFolderFilter === "number" ? noteFolderFilter : null;
      const note = await createNote.mutateAsync({ title: "", folderId: fid });
      setNoteFolderFilter(null);
      setSelectedNoteId(note.id);
    } catch (e) {
      toast.error(`新建笔记失败：${e}`);
    }
  };

  return (
    <div className="flex h-full">
      <NoteListPane
        notes={notes}
        selectedId={selectedNoteId}
        onSelect={setSelectedNoteId}
        onCreate={handleCreate}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            加载中…
          </div>
        ) : selectedNote ? (
          <NoteEditor
            key={selectedNote.id}
            note={selectedNote}
            onDeleted={() => setSelectedNoteId(null)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileText className="h-6 w-6" />
            <span className="text-sm">选择左侧笔记，或点「+」新建</span>
          </div>
        )}
      </div>
    </div>
  );
}
