import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";
import { FilePreviewPanel } from "@/components/file-preview-panel";

/** /preview 路由页（笔记正文链接用）：顶栏 + 预览面板 */
export function FilePreview() {
  const active = useUIStore((s) => s.activePreview);
  const clear = useUIStore((s) => s.clearActivePreview);
  const navigate = useNavigate();

  if (!active) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        未选择预览文件
      </div>
    );
  }

  const handleClose = () => {
    clear();
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-3">
        <button
          onClick={handleClose}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          title="返回"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回
        </button>
        <span className="truncate text-sm font-medium text-foreground" title={active.name}>
          {active.name}
        </span>
      </div>
      <FilePreviewPanel url={active.url} name={active.name} ext={active.ext} />
    </div>
  );
}
