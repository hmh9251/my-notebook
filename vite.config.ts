import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Tauri expects a fixed port, fail if already in use
  server: {
    port: 5173,
    strictPort: true,
  },
  // Env variables starting with TAURI_ are exposed to the client
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    // Tauri supports iOS and Android, but desktop uses Chromium/WebView2
    target: "chrome105",
    // Tauri webview on Windows uses Edge (Chromium), minify is still useful
    minify: "esbuild",
    // don't inline large assets
    assetsInlineLimit: 4096,
  },
});
