import { cn } from "@/lib/utils";
import { LinearStatusIcon } from "@/components/linear-status-icon";
import {
  STATUS_LABEL,
  nextStatus,
} from "@/lib/utils/task-domain";
import type { TaskStatus } from "@/types/week_task";

interface StatusBadgeProps {
  status: TaskStatus;
  /** 点击时循环切换到下一状态；不传则纯展示 */
  onCycle?: () => void;
  className?: string;
}

/**
 * 状态徽标：圆点 + 中文标签。整块可点循环切换，切换时 CSS 淡入淡出。
 */
export function StatusBadge({ status, onCycle, className }: StatusBadgeProps) {
  const interactive = !!onCycle;
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onCycle ? () => onCycle() : undefined}
      title={interactive ? `切换：${STATUS_LABEL[status]} → ${STATUS_LABEL[nextStatus(status)]}` : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs transition-opacity duration-150",
        interactive && "cursor-pointer hover:bg-muted",
        !interactive && "cursor-default",
        className,
      )}
    >
      <LinearStatusIcon status={status} />
      <span className="font-medium text-foreground">{STATUS_LABEL[status]}</span>
    </button>
  );
}
