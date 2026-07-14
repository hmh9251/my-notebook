import { GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

interface BranchChipProps {
  branch: string;
  className?: string;
}

/** 代码分支 chip：等宽、弱化色 */
export function BranchChip({ branch, className }: BranchChipProps) {
  if (!branch) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1 font-mono text-xs text-muted-foreground",
        className,
      )}
    >
      <GitBranch className="h-3 w-3 shrink-0" />
      <span className="truncate">{branch}</span>
    </span>
  );
}
