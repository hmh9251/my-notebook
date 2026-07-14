import { useEffect, useState } from "react";
import { toast } from "sonner";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { confirm } from "@tauri-apps/plugin-dialog";
import { Plus, FileText, Copy, Check, Download } from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  useTasksByWeek,
  useWeekTaskChildren,
  useCreateTask,
  useUpdateTaskStatus,
  useReorderTasks,
  useDeleteTask,
  generateWeeklyReport,
} from "@/hooks/useWeekTasks";
import { nextStatus } from "@/lib/utils/task-domain";
import { WeekSelector } from "@/components/week-selector";
import { TaskTableView } from "@/components/task-table-view";
import { TaskEditDialog } from "@/components/task-edit-dialog";
import { CopyWeekDialog } from "@/components/copy-week-dialog";
import { ImportJiraDialog } from "@/components/import-jira-dialog";
import { Modal } from "@/components/ui/modal";
import type { NewTask } from "@/types/week_task";

export function WeekTasks() {
  const selectedWeek = useUIStore((s) => s.selectedWeek);
  const setSelectedWeek = useUIStore((s) => s.setSelectedWeek);

  const { data: tasks = [], isLoading } = useTasksByWeek(selectedWeek);
  const { data: childrenMap = {} } = useWeekTaskChildren(selectedWeek);
  const createTask = useCreateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const reorderTasks = useReorderTasks();
  const deleteTask = useDeleteTask();

  const [showCreate, setShowCreate] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [copied, setCopied] = useState(false);

  const topLevelCount = tasks.filter((t) => t.parent_id == null).length;

  const handleStatusCycle = (id: number) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const next = nextStatus(task.status);
    updateTaskStatus.mutate({ id, status: next });
  };

  const handleReorder = (orderedIds: number[]) => {
    reorderTasks.mutate({ week_key: selectedWeek, ordered_ids: orderedIds });
  };

  const handleDelete = async (id: number) => {
    const task = tasks.find((t) => t.id === id);
    const ok = await confirm(`确定删除任务「${task?.name ?? id}」吗？`);
    if (!ok) return;
    deleteTask.mutate(id, {
      onSuccess: () => toast.success("已删除任务"),
      onError: (e) => toast.error(`删除失败：${e}`),
    });
  };

  const handleCreate = async (task: NewTask) => {
    await createTask.mutateAsync({ ...task, week_key: selectedWeek, sort_order: topLevelCount });
    toast.success("已新建任务");
  };

  const handleGenerateReport = async () => {
    try {
      const report = await generateWeeklyReport(selectedWeek);
      setReportContent(report);
      setShowReport(true);
    } catch (e) {
      toast.error(`生成周报失败：${e}`);
    }
  };

  const handleCopyReport = async () => {
    await writeText(reportContent);
    setCopied(true);
    toast.success("周报已复制到剪贴板");
    setTimeout(() => setCopied(false), 2000);
  };

  // 全局快捷键事件（来自 Shell）
  useEffect(() => {
    const onNew = () => setShowCreate(true);
    const onReport = () => {
      void handleGenerateReport();
    };
    window.addEventListener("jilu:new-task", onNew);
    window.addEventListener("jilu:weekly-report", onReport);
    return () => {
      window.removeEventListener("jilu:new-task", onNew);
      window.removeEventListener("jilu:weekly-report", onReport);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, topLevelCount]);

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <WeekSelector weekKey={selectedWeek} onChange={setSelectedWeek} />
        <div className="flex items-center gap-2">
          <span className="mr-1 text-xs text-muted-foreground">
            {topLevelCount} 个任务
          </span>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
            title="从 Jira 按任务号导入"
          >
            <Download className="h-4 w-4" />
            导入
          </button>
          <button
            onClick={() => setShowCopy(true)}
            className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <Copy className="h-4 w-4" />
            复制周任务
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={topLevelCount === 0}
            className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            生成周报
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            新建任务
          </button>
        </div>
      </header>

      {/* 表格 */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            加载中…
          </div>
        ) : (
          <TaskTableView
            tasks={tasks}
            childrenMap={childrenMap}
            onReorder={handleReorder}
            onStatusCycle={handleStatusCycle}
            onDelete={handleDelete}
          />
        )}
      </div>

      <TaskEditDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        initial={null}
        weekKey={selectedWeek}
        mode="create"
      />

      <CopyWeekDialog open={showCopy} onClose={() => setShowCopy(false)} />

      <ImportJiraDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        weekKey={selectedWeek}
      />

      {/* 周报预览 */}
      <Modal
        open={showReport}
        onClose={() => setShowReport(false)}
        title="周报预览"
        className="max-w-2xl"
        footer={
          <>
            <button
              onClick={() => setShowReport(false)}
              className="rounded-md border border-input px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
            >
              关闭
            </button>
            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "已复制" : "复制到剪贴板"}
            </button>
          </>
        }
      >
        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
          {reportContent}
        </pre>
      </Modal>
    </div>
  );
}
