import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTasksByWeek, useCopyWeekTasks } from "@/hooks/useWeekTasks";
import { useUIStore } from "@/lib/stores/ui-store";
import { addWeeks, formatWeekRange } from "@/lib/utils/week-key";
import { LinearStatusIcon } from "@/components/linear-status-icon";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { WeekTask } from "@/types/week_task";

interface CopyWeekDialogProps {
  open: boolean;
  onClose: () => void;
}

/** 复制周任务：选来源周（默认上周，‹ › 翻）→ 勾选 → 复制到当前周 */
export function CopyWeekDialog({ open, onClose }: CopyWeekDialogProps) {
  const toWeek = useUIStore((s) => s.selectedWeek);
  const [fromWeek, setFromWeek] = useState(() => addWeeks(toWeek, -1));
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: srcTasks = [], isLoading } = useTasksByWeek(fromWeek);
  const { data: toTasks = [] } = useTasksByWeek(toWeek);
  const copyTasks = useCopyWeekTasks(toWeek);

  // 目标周已存在的 taskNo（用于置灰「已存在」）
  const toTaskNos = useMemo(
    () => new Set(toTasks.map((t) => t.task_no).filter(Boolean)),
    [toTasks],
  );

  // 可勾选项 = 不在 toTaskNos 中的来源任务
  const selectable = useMemo(
    () => srcTasks.filter((t) => !toTaskNos.has(t.task_no)),
    [srcTasks, toTaskNos],
  );

  useEffect(() => {
    // 切换来源周时默认全选可勾选项
    setSelected(new Set(selectable.map((t) => t.id)));
  }, [fromWeek, selectable]);

  if (!open) return null;

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = selectable.length > 0 && selectable.every((t) => selected.has(t.id));
  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        selectable.forEach((t) => next.delete(t.id));
        return next;
      }
      return new Set(selectable.map((t) => t.id));
    });
  };

  const handleConfirm = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      const n = await copyTasks.mutateAsync({ from_week: fromWeek, task_ids: ids });
      toast.success(`已复制 ${n} 条任务到本周`);
      onClose();
    } catch (e) {
      toast.error(`复制失败：${e}`);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="复制周任务" className="w-[520px]">
      <div className="flex flex-col gap-3">
        {/* 来源周选择 */}
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <button
            onClick={() => setFromWeek((w) => addWeeks(w, -1))}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            title="上一周"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <div className="font-mono text-sm text-foreground">{fromWeek}</div>
            <div className="text-xs text-muted-foreground">{formatWeekRange(fromWeek)}</div>
          </div>
          <button
            onClick={() => setFromWeek((w) => addWeeks(w, 1))}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            title="下一周"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between px-1">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={selectable.length === 0}
              className="accent-[hsl(var(--accent))]"
            />
            全选可复制项（{selectable.length}）
          </label>
          <span className="text-xs text-muted-foreground">
            目标周：{toWeek}
          </span>
        </div>

        {/* 任务列表 */}
        <div className="max-h-72 overflow-auto rounded-md border border-border">
          {isLoading ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              加载中…
            </div>
          ) : srcTasks.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              该周无任务
            </div>
          ) : (
            srcTasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                disabled={toTaskNos.has(t.task_no)}
                checked={selected.has(t.id)}
                onToggle={() => toggle(t.id)}
              />
            ))
          )}
        </div>

        {/* 操作 */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-input px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0 || copyTasks.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            复制 {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TaskRow({
  task,
  disabled,
  checked,
  onToggle,
}: {
  task: WeekTask;
  disabled: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 border-b border-border/60 px-3 py-2 last:border-b-0",
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-muted/40",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={disabled}
        className="accent-[hsl(var(--accent))]"
      />
      <LinearStatusIcon status={task.status} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">{task.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {task.task_no}
          {task.branch && ` · ${task.branch}`}
        </div>
      </div>
      {disabled && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          已存在
        </span>
      )}
    </label>
  );
}
