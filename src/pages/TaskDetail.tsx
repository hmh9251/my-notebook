import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-shell";
import { confirm } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft,
  ExternalLink,
  Pencil,
  ChevronRight,
  Bug,
  GitBranch,
  FileText,
  X,
} from "lucide-react";
import {
  useTaskById,
  useTaskChildren,
  useUpdateTask,
  useUpdateTaskStatus,
  useDeleteTask,
} from "@/hooks/useWeekTasks";
import { useUIStore } from "@/lib/stores/ui-store";
import { useTaskTabs, type PreviewTab } from "@/lib/stores/task-tabs-store";
import { StatusBadge } from "@/components/status-badge";
import { TaskNoLink } from "@/components/task-no-link";
import { BranchChip } from "@/components/branch-chip";
import { TaskEditDialog } from "@/components/task-edit-dialog";
import { MarkdownContent } from "@/components/markdown-content";
import { FilePreviewPanel } from "@/components/file-preview-panel";
import {
  nextStatus,
  TYPE_LABEL,
} from "@/lib/utils/task-domain";
import { formatWeekRange } from "@/lib/utils/week-key";
import { cn } from "@/lib/utils";
import type { NewTask, TaskStatus } from "@/types/week_task";

// 按任务 id 记忆正文滚动位置
const scrollMem = new Map<number, number>();
// 稳定空数组引用（避免 Zustand selector 每次 ?? [] 产生新引用导致无限渲染）
const EMPTY_TABS: PreviewTab[] = [];

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const taskId = id ? Number(id) : undefined;
  const navigate = useNavigate();
  const setSelectedWeek = useUIStore((s) => s.setSelectedWeek);

  const { data: task } = useTaskById(taskId);
  const { data: children = [] } = useTaskChildren(taskId);
  const { data: parent } = useTaskById(task?.parent_id ?? undefined);
  const updateTask = useUpdateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();
  const scrollRef = useRef<HTMLDivElement>(null);

  const tabs = useTaskTabs((s) =>
    taskId ? s.tabs[taskId] ?? EMPTY_TABS : EMPTY_TABS,
  );
  const activeUrl = useTaskTabs((s) =>
    taskId ? s.active[taskId] ?? null : null,
  );
  const openTab = useTaskTabs((s) => s.openTab);
  const closeTab = useTaskTabs((s) => s.closeTab);
  const setActive = useTaskTabs((s) => s.setActive);

  // 内容就绪后还原正文滚动（等图加载完，避免异步撑高偏移）
  useEffect(() => {
    if (!task || !scrollRef.current || activeUrl !== null) return;
    const el = scrollRef.current;
    const saved = taskId ? scrollMem.get(taskId) ?? 0 : 0;
    if (saved === 0) return;
    let restored = false;
    const allLoaded = () => {
      const imgs = el.querySelectorAll("img");
      if (imgs.length === 0) return true;
      return Array.from(imgs).every((img) => img.complete && img.naturalHeight > 0);
    };
    const restore = () => {
      if (restored) return;
      el.scrollTop = saved;
      restored = true;
    };
    const poll = () => {
      if (restored) return;
      if (allLoaded()) {
        restore();
        return;
      }
      setTimeout(poll, 80);
    };
    poll();
    const t = setTimeout(restore, 3000);
    return () => {
      clearTimeout(t);
      restored = true;
    };
  }, [task, taskId, activeUrl]);

  const onScroll = () => {
    if (taskId && scrollRef.current) {
      scrollMem.set(taskId, scrollRef.current.scrollTop);
    }
  };

  const [showEdit, setShowEdit] = useState(false);

  if (taskId == null) {
    return <div className="p-6 text-muted-foreground">无效的任务 id</div>;
  }
  if (!task) {
    return <div className="p-6 text-muted-foreground">加载中…</div>;
  }

  const isMain = task.parent_id == null;

  const handleStatusCycle = () => {
    const next = nextStatus(task.status);
    updateTaskStatus.mutate({ id: task.id, status: next });
  };

  const handleSave = async (form: NewTask) => {
    await updateTask.mutateAsync({ id: task.id, task: { ...form, week_key: task.week_key } });
    toast.success("已保存");
  };

  const handleDelete = async () => {
    const ok = await confirm(`确定删除任务「${task.name}」吗？`);
    if (!ok) return;
    await deleteTask.mutateAsync(task.id);
    toast.success("已删除");
    navigate("/");
  };

  const goParent = () => {
    if (parent) {
      setSelectedWeek(parent.week_key);
      navigate(`/tasks/${parent.id}`);
    }
  };

  const handlePreviewLink = (url: string, name: string, ext: string) => {
    openTab(taskId, { url, name, ext });
  };

  const activeTab = tabs.find((t) => t.url === activeUrl) ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <header className="shrink-0 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </button>
          <span>/</span>
          <span className="font-mono">{task.week_key}</span>
          {isMain && <span>· 主任务</span>}
          {!isMain && parent && (
            <>
              <span>· 子任务</span>
              <button
                onClick={goParent}
                className="rounded px-1 py-0.5 font-mono text-muted-foreground transition-colors hover:text-accent"
              >
                {parent.task_no} ↗
              </button>
            </>
          )}
        </div>

        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-lg font-medium text-foreground">{task.name}</h1>
          <StatusBadge status={task.status as TaskStatus} onCycle={handleStatusCycle} />
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {TYPE_LABEL[task.type]}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            任务号 <TaskNoLink taskNo={task.task_no} linkUrl={task.link_url} />
          </span>
          <span className="flex items-center gap-1">
            分支 <BranchChip branch={task.branch} />
          </span>
          <span>周次 {formatWeekRange(task.week_key)}</span>
          {task.link_url && (
            <button
              onClick={() => void open(task.link_url)}
              className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-accent"
            >
              <ExternalLink className="h-3 w-3" />
              打开链接
            </button>
          )}
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-accent"
          >
            <Pencil className="h-3 w-3" />
            编辑
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-destructive"
          >
            删除
          </button>
        </div>
      </header>

      {/* tab 栏 */}
      {tabs.length > 0 && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-2 py-1">
          <button
            onClick={() => setActive(taskId, null)}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
              activeUrl === null
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <FileText className="h-3 w-3" />
            正文
          </button>
          {tabs.map((t) => (
            <div
              key={t.url}
              className={cn(
                "group flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
                activeUrl === t.url
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <button
                onClick={() => setActive(taskId, t.url)}
                className="max-w-[180px] truncate"
                title={t.name}
              >
                {t.name}
              </button>
              <button
                onClick={() => closeTab(taskId, t.url)}
                className="rounded text-muted-foreground/60 hover:text-destructive"
                title="关闭"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 正文（常驻，预览时隐藏以保留滚动）+ 预览 tab */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="absolute inset-0 overflow-auto px-5 py-4"
          style={{ display: activeUrl === null ? "block" : "none" }}
        >
          {task.content ? (
            <MarkdownContent
              content={task.content}
              className="markdown-body max-w-3xl"
              onPreviewLink={handlePreviewLink}
            />
          ) : (
            <p className="text-sm text-muted-foreground">无内容</p>
          )}

          {isMain && children.length > 0 && (
            <div className="mt-8 max-w-3xl">
              <h2 className="mb-2 text-xs font-medium text-muted-foreground">
                子任务 / 缺陷（{children.length}）
              </h2>
              <div className="flex flex-col rounded-md border border-border">
                {children.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/tasks/${c.id}`)}
                    className="group flex items-center gap-2 border-b border-border/60 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-muted/40"
                  >
                    {c.type === "bug" ? (
                      <Bug className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    ) : (
                      <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate text-sm text-foreground">{c.name}</span>
                    <TaskNoLink taskNo={c.task_no} linkUrl={c.link_url} />
                    <StatusBadge status={c.status as TaskStatus} />
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {activeTab && (
          <div className="absolute inset-0 flex flex-col">
            <FilePreviewPanel
              key={activeTab.url}
              url={activeTab.url}
              name={activeTab.name}
              ext={activeTab.ext}
            />
          </div>
        )}
      </div>

      <TaskEditDialog
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSubmit={handleSave}
        initial={task}
        weekKey={task.week_key}
        mode="edit"
      />
    </div>
  );
}
