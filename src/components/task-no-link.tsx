import { open } from "@tauri-apps/plugin-shell";
import { cn } from "@/lib/utils";

interface TaskNoLinkProps {
  taskNo: string;
  linkUrl?: string;
  className?: string;
}

/** 任务号超链接：等宽、弱化色、hover 变紫、点击浏览器打开原 URL */
export function TaskNoLink({ taskNo, linkUrl, className }: TaskNoLinkProps) {
  if (!taskNo) return <span className="text-muted-foreground">—</span>;

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (linkUrl) void open(linkUrl);
  };

  if (!linkUrl) {
    return (
      <span
        className={cn(
          "block min-w-0 truncate font-mono text-xs text-muted-foreground",
          className,
        )}
      >
        {taskNo}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      title={`打开 ${linkUrl}`}
      className={cn(
        "block min-w-0 cursor-pointer truncate border-0 bg-transparent px-0 text-left font-mono text-xs text-muted-foreground transition-colors hover:text-accent",
        className,
      )}
    >
      {taskNo}
    </button>
  );
}
