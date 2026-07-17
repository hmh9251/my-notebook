import { useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Check, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

interface BranchChipProps {
  branch: string;
  className?: string;
}

/** 代码分支 chip：点击复制分支号，等宽、弱化色 */
export function BranchChip({ branch, className }: BranchChipProps) {
  const [copied, setCopied] = useState(false);

  if (!branch) return <span className="text-muted-foreground">—</span>;

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    await writeText(branch);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={(e) => void handleCopy(e)}
      title={copied ? "已复制分支号" : `点击复制分支号：${branch}`}
      className={cn(
        "inline-flex min-w-0 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-left font-mono text-xs text-muted-foreground transition-colors hover:text-accent",
        className,
      )}
    >
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-accent" />
      ) : (
        <GitBranch className="h-3 w-3 shrink-0" />
      )}
      <span className="truncate">{branch}</span>
    </button>
  );
}
