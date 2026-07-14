import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Calendar, FileText, Settings, ChevronRight, Folder, Plus, X } from "lucide-react";
import { useRecentWeeks } from "@/hooks/useSearch";
import { useFolders, useUncatCount, useCreateFolder, useDeleteFolder, useRenameFolder } from "@/hooks/useFolders";
import { useUIStore } from "@/lib/stores/ui-store";
import { formatWeekRange } from "@/lib/utils/week-key";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "tasks", label: "周任务", icon: Calendar, path: "/" },
  { id: "notes", label: "笔记", icon: FileText, path: "/notes", match: "/notes" },
  { id: "settings", label: "设置", icon: Settings, path: "/settings", match: "/settings" },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedWeek = useUIStore((s) => s.selectedWeek);
  const setSelectedWeek = useUIStore((s) => s.setSelectedWeek);
  const noteFolderFilter = useUIStore((s) => s.noteFolderFilter);
  const setNoteFolderFilter = useUIStore((s) => s.setNoteFolderFilter);

  const { data: recentWeeks = [] } = useRecentWeeks();
  const { data: folders = [] } = useFolders();
  const { data: uncatCount = 0 } = useUncatCount();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();
  const renameFolder = useRenameFolder();

  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showRenameFolder, setShowRenameFolder] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState<number>(0);
  const [renameFolderName, setRenameFolderName] = useState("");

  const activeNavId =
    navItems.find((item) =>
      item.path === "/"
        ? location.pathname === "/" || location.pathname.startsWith("/tasks")
        : location.pathname.startsWith(item.match!),
    )?.id ?? "tasks";

  const goWeek = (weekKey: string) => {
    setSelectedWeek(weekKey);
    navigate("/");
  };

  const goFolder = (f: number | null | "uncat") => {
    setNoteFolderFilter(f);
    navigate("/notes");
  };

  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-border bg-background">
      {/* workspace 头 */}
      <button
        onClick={() => navigate("/settings")}
        className="flex items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="h-4 w-4 rounded-[3px] bg-accent" />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-medium text-foreground">记录</span>
          <span className="truncate text-[11px] text-muted-foreground">本地笔记工具</span>
        </div>
        <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <div className="flex flex-col gap-0.5 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNavId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 中段：最近周次 + 笔记标签（可滚动） */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {/* 最近周次 */}
        <div className="mt-4 flex flex-col gap-1 px-3">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
            最近周次
          </span>
        </div>
        <div className="flex flex-col gap-0.5 px-2">
          {recentWeeks.length === 0 && (
            <span className="px-2 py-1 text-[11px] text-muted-foreground/60">暂无</span>
          )}
          {recentWeeks.map((w) => {
            const isActive = w.week_key === selectedWeek;
            return (
              <button
                key={w.week_key}
                onClick={() => goWeek(w.week_key)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors",
                  isActive ? "bg-accent/10" : "hover:bg-muted/60",
                )}
              >
                <span
                  className={cn(
                    "font-mono text-xs",
                    isActive ? "text-accent" : "text-foreground",
                  )}
                >
                  {w.week_key}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatWeekRange(w.week_key)}
                </span>
                {w.count > 0 && (
                  <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                    {w.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 笔记文件夹 */}
        <div className="mt-4 flex items-center justify-between px-3">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
            笔记文件夹
          </span>
          <button
            onClick={() => setShowCreateFolder(true)}
            className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            title="新建文件夹"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <div className="flex flex-col gap-0.5 px-2 pb-3">
          <button
            onClick={() => goFolder(null)}
            className={cn(
              "rounded-md px-2 py-1 text-left text-xs transition-colors",
              noteFolderFilter === null
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            全部
          </button>
          {folders.map((f) => (
            <div
              key={f.id}
              className={cn(
                "group flex items-center rounded-md px-2 py-1 text-xs transition-colors",
                noteFolderFilter === f.id
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <button
                onClick={() => goFolder(f.id)}
                onDoubleClick={() => {
                  setRenameFolderId(f.id);
                  setRenameFolderName(f.name);
                  setShowRenameFolder(true);
                }}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                title={f.name + "（双击改名）"}
              >
                <Folder className="h-3 w-3 shrink-0" />
                <span className="truncate">{f.name}</span>
              </button>
              <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                {f.count}
              </span>
              <button
                onClick={() => deleteFolder.mutate(f.id)}
                className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                title="删除文件夹（其下笔记归入未分类）"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {uncatCount > 0 && (
            <button
              onClick={() => goFolder("uncat")}
              className={cn(
                "flex items-center rounded-md px-2 py-1 text-left text-xs transition-colors",
                noteFolderFilter === "uncat"
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Folder className="h-3 w-3 shrink-0" />
              <span>未分类</span>
              <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                {uncatCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 新建文件夹弹窗 */}
      <Modal
        open={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        title="新建文件夹"
        footer={
          <>
            <button
              onClick={() => setShowCreateFolder(false)}
              className="rounded-md border border-input px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
            >
              取消
            </button>
            <button
              onClick={() => {
                if (newFolderName.trim()) {
                  createFolder.mutate(newFolderName.trim());
                  setNewFolderName("");
                  setShowCreateFolder(false);
                }
              }}
              disabled={!newFolderName.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              新建
            </button>
          </>
        }
      >
        <input
          autoFocus
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newFolderName.trim()) {
              createFolder.mutate(newFolderName.trim());
              setNewFolderName("");
              setShowCreateFolder(false);
            }
          }}
          placeholder="文件夹名"
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </Modal>

      {/* 重命名文件夹弹窗 */}
      <Modal
        open={showRenameFolder}
        onClose={() => setShowRenameFolder(false)}
        title="重命名文件夹"
        footer={
          <>
            <button
              onClick={() => setShowRenameFolder(false)}
              className="rounded-md border border-input px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
            >
              取消
            </button>
            <button
              onClick={() => {
                if (renameFolderName.trim()) {
                  renameFolder.mutate({ id: renameFolderId, name: renameFolderName.trim() });
                  setShowRenameFolder(false);
                }
              }}
              disabled={!renameFolderName.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              保存
            </button>
          </>
        }
      >
        <input
          autoFocus
          value={renameFolderName}
          onChange={(e) => setRenameFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && renameFolderName.trim()) {
              renameFolder.mutate({ id: renameFolderId, name: renameFolderName.trim() });
              setShowRenameFolder(false);
            }
          }}
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </Modal>
    </aside>
  );
}
