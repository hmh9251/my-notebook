import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Trash2 } from "lucide-react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useUpdateNote, useDeleteNote } from "@/hooks/useNotes";
import { useFolders, useMoveNote } from "@/hooks/useFolders";
import { Segmented } from "@/components/ui/segmented";
import type { Note } from "@/types/note";

type ViewMode = "edit" | "split" | "preview";

interface NoteEditorProps {
  note: Note;
  onDeleted: () => void;
}

const inputCls =
  "w-full bg-transparent px-3 py-1.5 text-base font-medium text-foreground outline-none placeholder:text-muted-foreground/60";

/**
 * 笔记编辑器：标题 + 文件夹 + 视图切换 + 内容区。
 * 防抖自动保存（停笔 600ms 写库），切换/卸载 flush。
 */
export function NoteEditor({ note, onDeleted }: NoteEditorProps) {
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const { data: folders = [] } = useFolders();
  const moveNote = useMoveNote();

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [view, setView] = useState<ViewMode>("preview");

  const dirtyRef = useRef(false);
  const saveRef = useRef<() => void>(() => {});

  saveRef.current = () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    updateNote.mutate({
      ...note,
      title: title.trim(),
      content,
    });
  };

  const markDirty = () => {
    dirtyRef.current = true;
  };

  // 防抖：停笔 600ms 自动保存
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => saveRef.current(), 600);
    return () => clearTimeout(t);
  }, [title, content]);

  // 卸载/切笔记时 flush
  useEffect(() => {
    return () => {
      saveRef.current();
    };
  }, []);

  const handleDelete = async () => {
    const ok = await confirm(`确定删除笔记「${note.title || "无标题"}」吗？`);
    if (!ok) return;
    await deleteNote.mutateAsync(note.id);
    onDeleted();
  };

  const showEditor = view === "edit" || view === "split";
  const showPreview = view === "split" || view === "preview";

  return (
    <div className="flex h-full flex-col">
      {/* 顶部工具栏 */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
        <input
          className={inputCls}
          value={title}
          autoFocus={note.title === "" && note.content === ""}
          onChange={(e) => {
            markDirty();
            setTitle(e.target.value);
          }}
          placeholder="无标题"
        />
        <div className="flex items-center gap-2">
          <Segmented<ViewMode>
            value={view}
            onChange={setView}
            options={[
              { value: "edit", label: "编辑" },
              { value: "split", label: "分屏" },
              { value: "preview", label: "预览" },
            ]}
          />
          <button
            onClick={handleDelete}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            title="删除笔记"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 文件夹选择 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-1.5">
        <span className="text-xs text-muted-foreground">文件夹</span>
        <select
          className="flex-1 rounded border border-input bg-background px-2 py-0.5 text-sm text-foreground outline-none focus:border-accent"
          value={note.folder_id ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            moveNote.mutate({
              id: note.id,
              folderId: v === "" ? null : Number(v),
            });
          }}
        >
          <option value="">未分类</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* 内容区 */}
      <div className="flex min-h-0 flex-1">
        {showEditor && (
          <div
            className={
              (view === "split"
                ? "flex min-w-0 flex-1 flex-col border-r border-border"
                : "flex min-w-0 flex-1 flex-col") + " min-h-0 overflow-hidden"
            }
          >
            <CodeMirror
              value={content}
              height="100%"
              theme="light"
              basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: false }}
              extensions={[markdown({ base: markdownLanguage })]}
              onChange={(val) => {
                markDirty();
                setContent(val);
              }}
            />
          </div>
        )}
        {showPreview && (
          <div className="min-w-0 flex-1 overflow-auto px-5 py-4">
            {content ? (
              <div className="markdown-body max-w-3xl">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                >
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">无内容，开始输入…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
