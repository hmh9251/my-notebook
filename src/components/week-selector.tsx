import { ChevronLeft, ChevronRight } from "lucide-react";
import { addWeeks, getCurrentWeekKey, formatWeekRange } from "@/lib/utils/week-key";
import { cn } from "@/lib/utils";

interface WeekSelectorProps {
  weekKey: string;
  onChange: (w: string) => void;
  className?: string;
}

/** ‹ › 周次选择器，显示 ISO 周次 + 日期范围 */
export function WeekSelector({ weekKey, onChange, className }: WeekSelectorProps) {
  const isCurrent = weekKey === getCurrentWeekKey();
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        onClick={() => onChange(addWeeks(weekKey, -1))}
        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="上一周"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange(getCurrentWeekKey())}
        className={cn(
          "rounded px-2 py-1 text-xs transition-colors hover:bg-muted",
          isCurrent ? "text-muted-foreground" : "text-accent",
        )}
        title="回到本周"
      >
        本周
      </button>
      <button
        onClick={() => onChange(addWeeks(weekKey, 1))}
        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="下一周"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="ml-2 flex flex-col leading-tight">
        <span className="font-mono text-sm font-medium text-foreground">{weekKey}</span>
        <span className="text-xs text-muted-foreground">{formatWeekRange(weekKey)}</span>
      </div>
    </div>
  );
}
