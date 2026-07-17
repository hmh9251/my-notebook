---
name: verify-jilu-desktop
description: Launch and drive the Tauri WebView2 desktop app through Chrome DevTools Protocol
---

# Verify jilu desktop

1. Launch with WebView2 remote debugging:
   `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9222' npm run tauri dev`
2. Wait for `target/debug/jilu.exe`, then inspect `http://localhost:9222/json/list`.
3. Connect to the returned `webSocketDebuggerUrl` with Node's built-in `WebSocket`. Use CDP `Runtime.evaluate` to inspect/click the DOM and `Input.dispatchMouseEvent` for pointer interactions such as dnd-kit drag/drop.
4. The development DB is `src-tauri/data/jilu.db`; remove any temporary records created during verification.
5. Stop the background Tauri process when finished.
