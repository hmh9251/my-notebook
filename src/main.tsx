import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { router } from "./router";
import { initTheme } from "./lib/theme";
import "./styles/globals.css";

const feLog = (level: string, msg: string) => {
  void invoke("log_frontend", { level, msg }).catch(() => {});
};

// 全局 JS 错误/未捕获 rejection → 桥到 Rust stdout + toast（便于排查）
window.addEventListener("error", (e) => {
  const m = `error: ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`;
  feLog("error", m);
  toast.error(m);
});
window.addEventListener("unhandledrejection", (e) => {
  const m = `unhandledrejection: ${String(e.reason)}`;
  feLog("error", m);
  toast.error(m);
});

// 先同步应用缓存主题，再异步读 DB 校正（避免首屏闪烁）
void initTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

/** MCP 写入 → Rust emit('db_changed') → 失效所有 query 重新拉取 */
function DbChangedSync({ client }: { client: QueryClient }) {
  useEffect(() => {
    let un: (() => void) | undefined;
    listen("db_changed", () => {
      client.invalidateQueries();
    }).then((fn) => {
      un = fn;
    });
    return () => un?.();
  }, [client]);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <DbChangedSync client={queryClient} />
      <RouterProvider router={router} />
      <Toaster position="top-center" theme="light" richColors />
    </QueryClientProvider>
  </React.StrictMode>,
);