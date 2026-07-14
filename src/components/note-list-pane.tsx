import { Plus, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note } from "@/types/note";

interface NoteListPaneProps {
  notes: Note[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
}

/** 笔记左栏列表（288px）：标题 + 更新时间 + 正文预览 */
export function NoteListPane({
  notes,
  selectedId,
  onSelect,
  onCreate,
}: NoteListPaneProps) {
  return (
    <div className="flex h-full w-[288px] shrink-0 flex-col border-r border-border">
      <div className="flex shrink-0 items-center justify-between px-3 py-2">
        <span className="text-sm font-medium text-foreground">笔记</span>
        <button
          onClick={onCreate}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="新建笔记"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
            <FileText className="h-5 w-5" />
            <span className="text-xs">暂无笔记</span>
          </div>
        ) : (
          notes.map((note) => {
            const selected = note.id === selectedId;
            const preview = note.content.replace(/[#*`>\-\[\]!\(\)]/g, "").trim().slice(0, 80);
            return (
              <button
                key={note.id}
                onClick={() => onSelect(note.id)}
                className={cn(
                  "relative flex w-full flex-col gap-1 border-b border-border/60 px-3 py-2.5 text-left transition-colors",
                  selected ? "bg-accent/5" : "hover:bg-muted/40",
                )}
              >
                {selected && (
                  <span className="absolute left-0 top-0 h-full w-0.5 bg-accent" />
                )}
                <span
                  className={cn(
                    "truncate text-sm",
                    selected ? "font-medium text-foreground" : "text-foreground",
                  )}
                >
                  {note.title || "无标题"}
                </span>
                {preview && (
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {preview}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground/80">
                  {formatTime(note.updated_at)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
