import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { Search, Calendar, FileText } from "lucide-react";
import { useSearch } from "@/hooks/useSearch";
import { useUIStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";
import { formatWeekRange } from "@/lib/utils/week-key";
import type { SearchResult } from "@/types/search";

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

/** 全局搜索面板（cmdk，顶部对齐 + 背景变暗） */
export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const { data: results = [], isLoading } = useSearch(query);
  const navigate = useNavigate();
  const setSelectedWeek = useUIStore((s) => s.setSelectedWeek);
  const setSelectedNoteId = useUIStore((s) => s.setSelectedNoteId);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 打开时清空 + 聚焦
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tasks = results.filter((r): r is Extract<SearchResult, { kind: "task" }> => r.kind === "task");
  const notes = results.filter((r): r is Extract<SearchResult, { kind: "note" }> => r.kind === "note");

  const handleSelect = (r: SearchResult) => {
    if (r.kind === "task") {
      setSelectedWeek(r.week_key);
      navigate("/");
    } else {
      setSelectedNoteId(r.id);
      navigate("/notes");
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[12vh]"
      onClick={onClose}
    >
      <Command
        shouldFilter={false}
        loop
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Command.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder="搜索任务 / 笔记…（任务号、分支、正文、标题、标签）"
            className="flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>

        <Command.List className="flex-1 overflow-auto p-1">
          {query.trim() === "" && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              输入关键词搜索任务与笔记
            </div>
          )}

          {query.trim() !== "" && !isLoading && results.length === 0 && (
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
              无匹配结果
            </Command.Empty>
          )}

          {tasks.length > 0 && (
            <Command.Group heading="任务" className="text-muted-foreground">
              {tasks.map((r) => (
                <ResultItem key={`t-${r.id}`} value={`task-${r.id}`} onSelect={() => handleSelect(r)}>
                  <Calendar className="h-4 w-4 shrink-0 text-status-dev" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground">{r.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.task_no} · {r.week_key}（{formatWeekRange(r.week_key)}）
                    </div>
                  </div>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    任务
                  </span>
                </ResultItem>
              ))}
            </Command.Group>
          )}

          {notes.length > 0 && (
            <Command.Group heading="笔记" className="text-muted-foreground">
              {notes.map((r) => (
                <ResultItem key={`n-${r.id}`} value={`note-${r.id}`} onSelect={() => handleSelect(r)}>
                  <FileText className="h-4 w-4 shrink-0 text-status-testing" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground">
                      {r.title || "无标题"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.preview || "无内容"}
                    </div>
                  </div>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    笔记
                  </span>
                </ResultItem>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  );
}

function ResultItem({
  value,
  children,
  onSelect,
}: {
  value: string;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-foreground",
        "data-[selected=true]:bg-accent/10 data-[selected=true]:text-accent",
      )}
    >
      {children}
    </Command.Item>
  );
}
