import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

// Apply saved theme on startup
const savedTheme = localStorage.getItem("theme_preset") || "creamyWhite";
document.documentElement.dataset.theme = savedTheme;

function App() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Custom title bar */}
      <div
        data-tauri-drag-region
        className="flex h-[34px] shrink-0 items-center justify-between border-b border-border bg-background px-3"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">记录</span>
          <span className="text-xs text-muted-foreground">本地笔记工具</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => getCurrentWebviewWindow().minimize()}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="1" y="4.5" width="8" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            onClick={() => getCurrentWebviewWindow().toggleMaximize()}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button
            onClick={() => getCurrentWebviewWindow().close()}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-[232px] shrink-0 flex-col border-r border-border bg-background p-3">
          <div className="space-y-1">
            <div className="rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted cursor-pointer">
              周任务
            </div>
            <div className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted cursor-pointer">
              笔记
            </div>
            <div className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted cursor-pointer">
              设置
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-background p-6">
          <h1 className="text-xl font-medium text-foreground">骨架就绪</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tauri 2 + React + TypeScript + shadcn/ui + Tailwind CSS + SQLite
          </p>
        </main>
      </div>
    </div>
  );
}

export default App;
