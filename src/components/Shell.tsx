import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Minus, Square, X, Search } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { SearchDialog } from "@/components/search-dialog";

export function Shell() {
  const navigate = useNavigate();
  const [isMaximized, setIsMaximized] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleMinimize = () => getCurrentWebviewWindow()?.minimize();
  const handleMaximize = () => {
    const win = getCurrentWebviewWindow();
    if (win) {
      win.toggleMaximize();
      setIsMaximized(!isMaximized);
    }
  };
  const handleClose = () => getCurrentWebviewWindow()?.close();

  // 全局快捷键：Ctrl+N 新建任务、Ctrl+Enter 周报、Ctrl+P 全局搜索
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          navigate("/");
          window.dispatchEvent(new CustomEvent("jilu:new-task"));
        } else if (e.key === "Enter") {
          e.preventDefault();
          navigate("/");
          window.dispatchEvent(new CustomEvent("jilu:weekly-report"));
        } else if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          setSearchOpen((v) => !v);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* 自绘标题栏 */}
      <header
        className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3 select-none"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <span className="text-sm font-medium">记录</span>
        </div>

        {/* 搜索胶囊 */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex h-6 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search className="h-3 w-3" />
          <span>搜索</span>
          <kbd className="ml-1 rounded border border-border px-1 text-[10px]">Ctrl+P</kbd>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={handleMinimize}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted"
            title="最小化"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted"
            title="最大化"
          >
            <Square className="h-3 w-3" />
          </button>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
