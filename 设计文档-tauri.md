# 记录（jilu）— 本地笔记工具 设计文档（Tauri 重构版）

> 一个 Windows 本地的轻量笔记工具，两大核心模块：**周任务管理** + **Markdown 文本记录**。
> 技术栈从 Flutter 迁移至 **Tauri 2 + React + TypeScript**，借助 shadcn/ui + Tailwind CSS 大幅提升 UI 开发效率。
> 风格参考 Linear / Codex：近黑底 + 半透明细边 + 品牌紫，多套浅色/深色主题可切换。

---

## 1. 技术栈

| 维度 | 选型 | 说明 |
|---|---|---|
| 桌面框架 | **Tauri 2.x** | Rust 后端 + WebView2 前端，安装包 ~5–8MB，内存占用低 |
| 前端 | **React 19 + TypeScript** | 函数组件 + Hooks |
| 构建 | **Vite 6** | 极速 HMR，生产构建 Rollup |
| UI 组件 | **shadcn/ui** | 组件源码复制到项目内，完全可定制（非 npm 黑盒依赖） |
| 样式 | **Tailwind CSS** | 原子化 CSS，CSS 变量驱动主题 |
| 图标 | **lucide-react** | 轻量 SVG 图标库（shadcn 默认搭配） |
| 拖拽 | **@dnd-kit/core + sortable** | 无障碍拖拽排序，支持 DragOverlay proxy |
| Markdown 渲染 | **react-markdown** + remark-gfm + rehype-highlight | GFM 表格 + 代码高亮 |
| Markdown 编辑 | **@uiw/react-codemirror** | CodeMirror 6，行号 + 语法高亮 + 自动缩进 |
| 状态管理 | **Zustand** + **TanStack Query v5** | Zustand 管 UI 状态，Query 管 DB 数据缓存/失效 |
| 路由 | **React Router v7** | 嵌套路由 + Outlet 三栏 shell 布局 |
| 存储 | **SQLite**（rusqlite + r2d2 连接池） | Rust 端管理，Tauri State 共享；MCP 同进程复用 |
| 平台 | **仅 Windows 11** | WebView2 内核（系统自带，无需打包 Chromium） |
| 窗口 | Tauri 内置 | `decorations: false` 无框 + 自绘标题栏（`data-tauri-drag-region`） |
| 系统托盘 | Tauri 2 内置 | `TrayIconBuilder`，关窗拦截隐藏到托盘 |
| 字体 | Inter + Noto Sans SC（@fontsource） | 真字重 400/500/700，CSS @font-face |
| Toast | **sonner** | 轻量 toast 通知（shadcn 推荐） |
| 搜索面板 | **cmdk**（shadcn Command） | 内置键盘导航、过滤、分组 |

### 关键依赖

**Frontend（package.json）**

```
react / react-dom / react-router
@tauri-apps/api / @tauri-apps/plugin-dialog / @tauri-apps/plugin-fs / @tauri-apps/plugin-shell / @tauri-apps/plugin-clipboard-manager
zustand / @tanstack/react-query
tailwindcss / class-variance-authority / clsx / tailwind-merge
lucide-react
@dnd-kit/core / @dnd-kit/sortable / @dnd-kit/modifiers
react-markdown / remark-gfm / rehype-highlight
@uiw/react-codemirror / @codemirror/lang-markdown
@fontsource/inter / @fontsource/noto-sans-sc  (400/500/700)
cmdk / sonner
```

**Backend（Cargo.toml）**

```
tauri 2
tauri-plugin-dialog / tauri-plugin-fs / tauri-plugin-shell / tauri-plugin-clipboard-manager
rusqlite (features = ["bundled"]) / r2d2 / r2d2_sqlite
serde / serde_json / chrono
axum / tokio   ← MCP Streamable HTTP server
```

### 迁移对照表

| 原方案 (Flutter) | 新方案 (Tauri + React) | 说明 |
|---|---|---|
| Flutter 3.44 (Dart) | Tauri 2 (Rust) + React 19 (TS) | 自绘引擎 → WebView2，开发效率大幅提升 |
| Riverpod 3.3 | Zustand + TanStack Query | UI 状态 / DB 数据分离管理 |
| go_router (StatefulShellRoute) | React Router v7 (Outlet) | 三栏 shell 嵌套路由 |
| sqflite_common_ffi | rusqlite + r2d2 连接池 | Rust 端管理，Tauri State 共享 |
| flutter_markdown | react-markdown + remark-gfm | GFM 支持，CSS 样式表定制 |
| 无原生 Markdown 编辑器 | @uiw/react-codemirror | CodeMirror 6，行号 + 语法高亮 |
| window_manager | Tauri 内置 (`decorations: false`) | 无框窗口 + `data-tauri-drag-region` |
| tray_manager 0.5.3 | Tauri 2 内置 TrayIconBuilder | 系统托盘 |
| ReorderableListView | @dnd-kit/sortable + DragOverlay | 拖拽排序 |
| CustomPaint (LinearStatusIcon) | SVG React 组件 | 状态图标自绘 |
| flex_color_scheme（已弃用） | Tailwind CSS 变量 + shadcn | 主题系统 |
| mcp_dart (Dart) | axum (Rust) | MCP Streamable HTTP server |

### 国内环境注意

- npm 走淘宝镜像：`.npmrc` 设 `registry=https://registry.npmmirror.com`
- Cargo 走 `rsproxy.cn`：`~/.cargo/config.toml` 配置 `[source.crates-io]` 替换
- Rust 工具链 via rustup；Tauri CLI：`npm run tauri`（`@tauri-apps/cli` dev 依赖）
- WebView2 Runtime：Win11 系统自带，无需额外安装

---

## 2. 功能模块

### 2.1 周任务

每条任务字段：

| 字段 | 说明 |
|---|---|
| 任务名称 | 简短描述 |
| 任务链接 | 完整 URL，如 `https://code.fastfish.com/browse/XXZX-29986` |
| 任务号 | 从链接自动解析（URL 最后一段 path），如 `XXZX-29986` |
| 代码分支 | 录入时**默认 = 任务号**，可改 |
| 任务状态 | 3 种：`开发中` / `已提测` / `已上线`；新增默认开发中（与类型正交） |
| 任务类型 | `主任务` / `子任务` / `缺陷`；新增默认主任务 |
| 正文 content | Markdown 正文（AI 从 Jira 富文本转换而来），**纯展示不可编辑** |
| 父任务 parentId | 子任务/缺陷指向主任务 id；主任务为空（顶层） |
| 所属周次 | ISO 周次 `2026-W27` |

#### 层级（主任务 / 子任务 / 缺陷）

- `TaskType` 枚举（`main`/`sub`/`bug`）与 `TaskStatus` 正交：type 描述「是什么」，status 描述「做到哪一步」。
- 子任务/缺陷的 `parent_id` 指向主任务。顶层 = 主任务 + 无父缺陷。
- 表格视图：`useWeekTasks(weekKey)` 返顶层；`useWeekTaskChildren(weekKey)` 返 `parentId → 子项` 分组（全周一次查、展开即时取值）。
- 表格行最左 chevron 展开看子任务/缺陷（缩进子行 + 类型图标：bug 红色 bug 图标、sub 分支图标）。子项不可拖拽，顶层可拖拽排序（@dnd-kit/sortable + DragOverlay proxy 加阴影拎起反馈）。
- 行 tap → 钻进详情页 `/tasks/:id`（不再开编辑对话框）；编辑入口在详情页。

#### 详情页（`/tasks/:id`）

- 头部：返回 + 任务名 + StatusBadge（可点循环）+ 任务号链接 + 分支 + 周次 + 打开链接 + 编辑（开 `TaskEditDialog` 改 metadata）。子任务头部显示父任务号链接（点跳父任务）。
- 正文：`react-markdown` 渲染 `content`（自定义 MarkdownStyleSheet 等价 CSS）。空正文显示「无内容」。
- 主任务详情页底部列其子任务/缺陷（`useTaskChildren(id)`），每行可点跳对应详情。

#### 链接 / 任务号 / 分支 联动

1. 粘贴 URL → `linkParser.parseTaskNo` 取最后一段 path 为任务号。
2. 列表只展示任务号（等宽 Consolas、弱化色、hover 变紫、点击浏览器打开原 URL via `tauri-plugin-shell`），不展示整条 URL。
3. 分支自动填任务号，用户改过分支后不再被覆盖。
4. 解析失败则回退展示完整 URL，分支留空。

#### 状态

- `开发中`（琥珀 #E8C44A）→ `已提测`（紫 #8B7CF6）→ `已上线`（绿 #4EB783）
- Linear 风格自绘图标（`LinearStatusIcon`，**SVG React 组件**）：
  - 开发中 = 圆环 + 左半圆填充
  - 已提测 = 圆环 + 中心实心点
  - 已上线 = 实心圆 + 白色对勾
- 图标后跟中文标签（`StatusBadge`），整块可点循环切换，切换时 CSS `transition` 淡入淡出。

#### 视图

**仅表格视图**（卡片视图已删）。列：`序号 | 任务名称 | 任务号(链接) | 分支 | 状态`。
- 使用 CSS grid/flex 布局（非 HTML `<table>`，便于 @dnd-kit 拖拽排序）。
- 行紧凑、hover 高亮、整行可拖拽排序（`@dnd-kit/sortable` + `onDragEnd` 回调 `reorderTasks` mutation）。

#### 复制周任务

头部「复制周任务」按钮 → `CopyWeekTasksDialog`（shadcn Dialog）：
- 选择来源周（默认上周，可 ‹ › 翻）。
- 列出该周任务，勾选要复制的。
- 目标周已存在的任务（按 taskNo 匹配）置灰标「已存在」不可勾选。
- 「全选/全不选」只选可勾选项。
- 确认 → `useCopyWeekTasks` mutation 循环 createNew 复制到当前周（同名/同链接/同任务号/同分支，**状态重置为开发中**，新 sort_order）。

#### 一键周报

头部「生成周报」按钮 → `weeklyReport.generate` 生成 Markdown 表格 → 复制到剪贴板（`tauri-plugin-clipboard-manager`）+ toast（sonner，带「预览」动作，对话框展示源码 + 复制）。空任务时按钮置灰。

### 2.2 笔记（Markdown）

- **左栏列表（288px）+ 右栏编辑器**。
- 左栏：标题 + 更新时间 + 正文预览 + 标签 chip；选中项左侧紫竖条 + 着色；按更新时间倒序；顶部「+」新建。
- 编辑器：标题输入框 + 标签输入框 + 视图 ToggleGroup（shadcn，编辑 / 分屏 / 预览）+ 内容区。
- **CodeMirror 6** 作为 Markdown 编辑器（行号、语法高亮、自动缩进）。
- `react-markdown` 实时渲染（自定义 CSS 样式表）；分屏左编辑右预览，预览随输入实时刷新。
- **防抖自动保存**（停笔 600ms 调 Tauri command 写库；切换/关闭 flush。`useEffect` cleanup + `useRef` 缓存最新内容 + `useDebouncedCallback`）。
- 新建笔记自动聚焦标题；删除带确认（shadcn AlertDialog）。
- 编辑器用 `key={note.id}` 包裹，切换笔记重建 state。
- 标签：逗号分隔；侧栏「笔记标签」可按标签过滤列表。

### 2.3 侧栏（Codex 风格，232px）

文字为主、分 section：
- **workspace 头**：accent 色块 +「记录」+「本地笔记」+ chevron（点 → 设置）。
- **导航**：周任务 / 笔记 / 设置（icon + 文字，激活 = 柔和底色 + 紫图标）。
- **最近周次**：从 DB 聚合（`get_recent_weeks` command，含当前周）。每行两行：周次 key（等宽）+ 日期范围「MM.dd – MM.dd」+ 任务计数徽标。点 → `setSelectedWeek` + `navigate('/tasks')`。
- **笔记标签**：全部笔记 tag 聚合 + 计数（`get_note_tag_counts` command）。「全部」清过滤；点 tag → `setNoteTagFilter` + `navigate('/notes')`。

### 2.4 全局搜索（WebStorm Search Everywhere 式）

两条触发：标题栏搜索胶囊 / **Ctrl+P** 全局快捷键。
- `SearchDialog`（shadcn Command / cmdk，顶部对齐，背景变暗）：输入框（180ms 防抖）+ 结果列表。
- `useSearch(query)` 同时搜周任务（name/任务号/分支/**正文** LIKE）和笔记（标题/正文/标签 LIKE），最多 50 条。
- 结果行：类型图标（任务 琥珀 / 笔记 紫）+ 标题 + 副标题（任务号·周次 或 笔记正文预览）+ 类型标签。
- 点结果 / Enter 定位：
  - 任务 → `setSelectedWeek(weekKey)` + `navigate('/tasks')`
  - 笔记 → `setSelectedNoteId(id)` + `navigate('/notes')`
- Esc 关闭。↑↓ 选择（cmdk 内置键盘导航）。

### 2.5 主题

5 套预设（设置页迷你色板选择器切换，持久化 `theme_preset`）：

| 预设 | 强调色 | 参考 |
|---|---|---|
| **奶油白**（默认）| 赭石 #B45A3A | Notion / Craft / Apple Notes |
| 冷灰白 | 紫 #5E6AD2 | Linear / Vercel / Supabase |
| 薄荷白 | 绿 #12A374 | Arc / Cron / Things 3 |
| 粉白 | 玫瑰 #C8477A | Reflect / Amie / Day One |
| 线性深色 | 紫 #5E6AD2 | Linear Dark |

实现方式：每套预设 = 一组 CSS 自定义属性（`--background` / `--foreground` / `--accent` / `--border` / `--muted` / `--card` / …），通过 `data-theme` 属性挂在 `<html>` 上。切换主题时 `document.documentElement.dataset.theme = preset`，纯 CSS 变量替换，无需 React 重新渲染。Tailwind 通过 `@theme` 引用这些变量，shadcn/ui 组件自动适配。调色板定义在 `src/lib/theme/palettes.ts`，每套含 chrome/content/raised/text/muted/faint/divider/dividerStrong/hoverOverlay/accent/accentHover/accentTint/onAccent 等语义色。

### 2.6 存储位置

设置页「存储」区：显示当前 DB 目录 + 「打开」（`tauri-plugin-shell` 调 explorer.exe）+「更改…」（`tauri-plugin-dialog` 选目录 → 确认 → 迁移）。

- DB 路径可配置：位置存固定路径的 config 文件 `appSupportDir/jilu.json`（`{storagePath:...}`），**不放 DB 里**（读「DB 在哪」时 DB 没开）。
- `change_storage_path(newDir)` command（Rust 端）：关库 → `std::fs::copy` 复制 jilu.db 到新目录 → 删旧 → 写 config → 重开 → 前端 `queryClient.invalidateQueries()` 级联失效所有 query 重新拉取。
- 旧用户 config 不存在 → 默认 appSupportDir → 原 DB 照常打开，无需迁移。

---

## 3. 架构设计（Tauri IPC 模式）

### 3.1 数据流

```
┌──────────────────────────────────────────────────┐
│                    React 前端                     │
│                                                    │
│  Zustand (UI state)     TanStack Query (DB cache) │
│  - selectedWeek         - useWeekTasks            │
│  - selectedNoteId       - useNotes                │
│  - noteTagFilter        - useSearch               │
│       │                       │                   │
│       │              invoke() / Tauri IPC         │
└───────┼───────────────────────┼──────────────────┘
        │                       │
        │          ┌────────────▼────────────┐
        │          │     Rust 后端 (Tauri)    │
        │          │                          │
        │          │  Tauri Commands          │
        │          │  - get_week_tasks       │
        │          │  - create_task          │
        │          │  - update_note          │
        │          │  - search               │
        │          │  - change_storage_path  │
        │          │       │                  │
        │          │  ┌────▼────┐  ┌────────▼────────┐
        │          │  │ SQLite  │  │  MCP HTTP Server │
        │          │  │ (r2d2)  │  │  (axum, :7431)   │
        │          │  │  Pool   │  │  共享同一 DB Pool │
        │          │  └─────────┘  └────────┬────────┘
        │          │                        │
        │          │     emit Tauri Event   │
        │          └────────────────────────┘
        │                      │
        │          listen() ← db_changed event
        │          → queryClient.invalidateQueries()
        └──────────────────────┘
```

**核心原则**：前端通过 `invoke('command_name', { args })` 调 Rust 后端；TanStack Query 缓存结果；MCP server 写入后 Rust 端 `app.emit('db_changed')` → 前端 `listen()` → `invalidateQueries()` 实时刷新。

### 3.2 Tauri Commands 清单

**任务 Commands**

| command | 入参 | 返回 | 说明 |
|---|---|---|---|
| `get_week_tasks` | `weekKey: string` | `WeekTask[]` | 某周顶层任务 |
| `get_week_task_children` | `weekKey: string` | `Record<i32, WeekTask[]>` | 某周 parentId→子项 分组 |
| `get_task_by_id` | `id: i64` | `WeekTask?` | 单条任务 |
| `get_task_children` | `id: i64` | `WeekTask[]` | 某主任务的子项 |
| `get_recent_weeks` | — | `{weekKey, count, startDate, endDate}[]` | 最近 10 周 + 计数 |
| `search_tasks` | `query: string` | `WeekTask[]` | 搜 name/任务号/分支/正文 |
| `create_task` | `NewTask` | `i64` | 新建，返回 id |
| `update_task` | `WeekTask` | `()` | 更新 |
| `update_task_status` | `id, status` | `()` | 切状态 |
| `delete_task` | `id` | `()` | 删除 |
| `reorder_tasks` | `weekKey, orderedIds[]` | `()` | 批量更新 sort_order |
| `copy_week_tasks` | `fromWeek, toWeek, taskIds[]` | `()` | 复制（状态重置开发中） |

**笔记 Commands**

| command | 入参 | 返回 | 说明 |
|---|---|---|---|
| `get_notes` | `tag?: string` | `Note[]` | 全部 / 按标签过滤 |
| `get_note_by_id` | `id: i64` | `Note?` | 单条笔记 |
| `get_note_tag_counts` | — | `{tag, count}[]` | 标签聚合 |
| `search_notes` | `query: string` | `Note[]` | 搜标题/正文/标签 |
| `create_note` | `title: string` | `i64` | 新建 |
| `update_note` | `Note` | `()` | 更新 |
| `delete_note` | `id` | `()` | 删除 |

**设置 / 存储 / 搜索 Commands**

| command | 入参 | 返回 | 说明 |
|---|---|---|---|
| `get_setting` | `key: string` | `string?` | 读设置 |
| `set_setting` | `key, value: string` | `()` | 写设置 |
| `get_storage_path` | — | `string` | 当前 DB 目录 |
| `change_storage_path` | `newDir: string` | `()` | 迁移 DB |
| `open_in_explorer` | `path: string` | `()` | 打开资源管理器 |
| `search` | `query: string` | `SearchResult[]` | 统一搜任务+笔记 |

### 3.3 TanStack Query Hooks

```typescript
// ── 任务 ──
useWeekTasks(weekKey)           // useQuery(['weekTasks', weekKey])
useWeekTaskChildren(weekKey)    // useQuery(['weekTaskChildren', weekKey])
useTaskById(id)                 // useQuery(['task', id])
useTaskChildren(id)             // useQuery(['taskChildren', id])
useRecentWeeks()                // useQuery(['recentWeeks'])

useCreateTask()    // useMutation → invalidate ['weekTasks'], ['weekTaskChildren'], ['recentWeeks']
useUpdateTask()    // useMutation → invalidate ['weekTasks'], ['task', id]
useUpdateTaskStatus()
useDeleteTask()
useReorderTasks()  // useMutation → invalidate ['weekTasks']
useCopyWeekTasks()

// ── 笔记 ──
useNotes(tag?)      // useQuery(['notes', tag])
useNoteById(id)     // useQuery(['note', id])
useNoteTagCounts()  // useQuery(['noteTagCounts'])

useCreateNote()     // useMutation → invalidate ['notes'], ['noteTagCounts']
useUpdateNote()     // useMutation → invalidate ['notes'], ['note', id]
useDeleteNote()

// ── 搜索 ──
useSearch(query)    // useQuery(['search', query], { enabled: !!query })
```

### 3.4 Zustand Store

```typescript
interface UIStore {
  // 周任务
  selectedWeek: string;              // '2026-W27'
  setSelectedWeek: (w: string) => void;
  // 笔记
  selectedNoteId: number | null;
  setSelectedNoteId: (id: number | null) => void;
  noteTagFilter: string | null;
  setNoteTagFilter: (tag: string | null) => void;
}
```

### 3.5 MCP 写入 → UI 实时刷新

MCP server（Rust axum）写入 DB 后，通过 Tauri 的 `app_handle.emit('db_changed', payload)` 发事件。前端 `listen('db_changed')` → `queryClient.invalidateQueries()` → 所有相关 query 重新拉取 → UI 自动刷新。

---

## 4. 数据模型（SQLite）

### 4.1 `week_tasks`

```sql
CREATE TABLE week_tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  link_url      TEXT    NOT NULL,
  task_no       TEXT    NOT NULL,
  branch        TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'dev',   -- dev | testing | released
  type          TEXT    NOT NULL DEFAULT 'main',  -- main | sub | bug
  parent_id     INTEGER,                           -- 子任务/缺陷指向主任务
  content       TEXT    NOT NULL DEFAULT '',       -- Markdown 正文
  week_key      TEXT    NOT NULL,                  -- '2026-W27'
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL,                  -- ISO8601
  updated_at    TEXT    NOT NULL
);
CREATE INDEX idx_week_tasks_week ON week_tasks(week_key);
CREATE INDEX idx_week_tasks_parent ON week_tasks(parent_id);
```

> v2 迁移（v1 旧库自动 `ALTER TABLE ADD COLUMN content/type/parent_id` + 建父索引；旧数据 content=''、type='main'、parent_id=NULL）。

**status（生命周期）**

| key | 中文 | 颜色 |
|---|---|---|
| `dev` | 开发中 | 琥珀 #E8C44A |
| `testing` | 已提测 | 紫 #8B7CF6 |
| `released` | 已上线 | 绿 #4EB783 |

**type（与 status 正交）**

| key | 中文 |
|---|---|
| `main` | 主任务 |
| `sub` | 子任务 |
| `bug` | 缺陷 |

### 4.2 `notes`

```sql
CREATE TABLE notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  content     TEXT    NOT NULL,     -- Markdown 正文
  tags        TEXT,                 -- 逗号分隔
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);
CREATE INDEX idx_notes_updated ON notes(updated_at DESC);
```

### 4.3 `settings`

```sql
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
-- 现用键：theme_preset（creamyWhite/coolGray/mintWhite/roseWhite/linearDark）
```

### 4.4 存储位置 config（DB 之外）

`<appSupportDir>/jilu.json`：`{"storagePath": "<目录>"}`，空则默认 appSupportDir。

---

## 5. 周报模板

```markdown
# 周报 2026-W27

| 序号 | 任务名称 | 任务号 | 类型 | 任务状态 |
|---|---|---|---|---|
| 1 | 用户登录优化 | XXZX-29986 | 主任务 | 开发中 |
| 1.1 | └ 校验逻辑 | XXZX-29987 | 子任务 | 已提测 |
| 1.2 | └ 兼容性缺陷 | XXZX-29990 | 缺陷 | 已上线 |
| 2 | 订单导出修复 | XXZX-29989 | 主任务 | 已提测 |
```

主任务序号 `1`，其子任务/缺陷 `1.1`/`1.2…` 缩进挂在下方（名称前缀「└ 」）。任务号纯文本（不嵌链接），状态/类型中文，标题含周次 + 日期范围，`|` 转义。一键复制到剪贴板 + toast「已复制 N 条」+ 预览动作。`weeklyReport.generate(week, topTasks, childrenMap)`。

---

## 6. UI / UX

- **整体风格**：Linear / Codex。近黑底（深色）或暖/冷/薄荷/玫瑰白（浅色），半透明细边（`border-white/10` 等 Tailwind 透明度类），品牌紫强调，compact 密度，阴影最小化。
- **布局**：标题栏（34px，无框自绘 `data-tauri-drag-region`） + 下方 [侧栏 232px + 内容区]。
- **字体**：Inter（拉丁，负字距 `tracking-tight`）+ Noto Sans SC（中文，真字重）。权重映射：标题 `font-medium`(500)、display/headline `font-bold`(700)、按钮 `font-bold`(700)、body `font-normal`(400)；**避开 w600**（Noto 无 600，歧义映射）。等宽用 `font-mono`（Consolas，任务号/分支/周次）。
- **状态色**：dev=琥珀 / testing=紫 / released=绿。
- **动效**：状态切换 CSS `transition-opacity` 淡入淡出；hover `transition-colors duration-100`；拖拽 DragOverlay 加阴影「拎起」反馈。
- **快捷键**：Ctrl+N 新建任务、Ctrl+Enter 生成周报、Ctrl+P 全局搜索。通过 React 全局 `useEffect` + `keydown` 监听。
- **半透明细边**：Tailwind `border` + 透明度（如 `border-white/10` / `border-black/5`），搭配 `backdrop-blur` 实现 Linear 质感。
- **CSS 变量主题**：所有颜色通过 CSS 变量驱动，切主题零 JS 重渲染。

---

## 7. 工程结构

```
jilu/
├── src/                                  # React 前端
│   ├── main.tsx                          # React 入口 + Providers (QueryClient, Router)
│   ├── App.tsx                           # 根组件
│   ├── router.tsx                        # React Router v7 路由定义
│   ├── components/
│   │   ├── ui/                           # shadcn/ui 组件（button, dialog, command, ...）
│   │   ├── linear-status-icon.tsx        # SVG 自绘状态图标
│   │   ├── status-badge.tsx              # 图标 + 中文标签
│   │   ├── task-no-link.tsx              # 任务号超链接
│   │   └── branch-chip.tsx               # 分支 chip
│   ├── features/
│   │   ├── week-tasks/
│   │   │   ├── tasks-page.tsx            # 头部 + 表格 + 周报/复制
│   │   │   ├── task-table-view.tsx       # @dnd-kit 拖拽表格
│   │   │   ├── task-detail-page.tsx      # /tasks/:id 详情
│   │   │   ├── task-edit-dialog.tsx      # 编辑 metadata
│   │   │   ├── copy-week-dialog.tsx      # 复制周任务
│   │   │   ├── weekly-report.ts          # Markdown 生成
│   │   │   └── week-selector.tsx         # ‹ › 周次选择
│   │   ├── notes/
│   │   │   ├── notes-page.tsx            # 主从布局
│   │   │   ├── note-list-pane.tsx        # 左栏列表
│   │   │   └── note-editor.tsx           # CodeMirror + react-markdown
│   │   ├── search/
│   │   │   └── search-dialog.tsx         # cmdk 搜索面板
│   │   ├── settings/
│   │   │   └── settings-page.tsx         # 主题/存储/MCP endpoint/关于
│   │   └── shell/
│   │       ├── app-shell.tsx             # 标题栏 + 侧栏 + Outlet + Ctrl+P
│   │       ├── title-bar.tsx             # 无框自绘标题栏 + 搜索胶囊
│   │       └── sidebar.tsx               # Codex 侧栏
│   ├── lib/
│   │   ├── tauri/                        # Tauri invoke 封装
│   │   │   ├── tasks.ts                  # 任务 commands wrapper
│   │   │   ├── notes.ts                  # 笔记 commands wrapper
│   │   │   ├── settings.ts               # 设置 commands wrapper
│   │   │   └── storage.ts                # 存储 commands wrapper
│   │   ├── stores/
│   │   │   └── ui-store.ts               # Zustand store
│   │   ├── hooks/                        # TanStack Query hooks
│   │   │   ├── use-tasks.ts
│   │   │   ├── use-notes.ts
│   │   │   └── use-search.ts
│   │   ├── utils/
│   │   │   ├── link-parser.ts            # URL → 任务号解析
│   │   │   ├── week-key.ts               # ISO 周次工具
│   │   │   └── cn.ts                     # clsx + tailwind-merge
│   │   └── theme/
│   │       ├── palettes.ts               # 5 套调色板定义
│   │       └── index.ts                  # 主题切换逻辑
│   ├── types/                            # TypeScript 类型定义
│   │   └── models.ts                     # WeekTask, Note, TaskStatus, ...
│   └── styles/
│       └── globals.css                   # Tailwind + CSS 变量 + 字体
├── src-tauri/                            # Rust 后端
│   ├── src/
│   │   ├── main.rs                       # Tauri app + plugins + tray + MCP 启动
│   │   ├── db/
│   │   │   ├── mod.rs                    # r2d2 连接池 + Tauri State
│   │   │   ├── schema.rs                 # 建表 + 迁移
│   │   │   └── models.rs                 # Rust 数据模型 (serde)
│   │   ├── commands/
│   │   │   ├── tasks.rs                  # 任务 Tauri commands
│   │   │   ├── notes.rs                  # 笔记 Tauri commands
│   │   │   ├── settings.rs               # 设置 Tauri commands
│   │   │   └── storage.rs                # 存储 Tauri commands
│   │   ├── mcp/
│   │   │   └── mod.rs                    # axum MCP HTTP server
│   │   ├── config.rs                     # jilu.json 读写
│   │   └── tray.rs                       # 托盘 + 关窗拦截
│   ├── migrations/                       # SQL 迁移脚本
│   ├── Cargo.toml
│   └── tauri.conf.json                   # Tauri 配置 (decorations:false, tray, ...)
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json                       # shadcn/ui 配置
└── index.html
```

---

## 8. 开发阶段

| 阶段 | 内容 | 说明 |
|---|---|---|
| **M0 工程搭建** | Tauri 2 + React + Vite 工程、shadcn/ui 初始化、Tailwind 配置、无框窗口 + 自绘标题栏、SQLite (rusqlite + r2d2)、DB schema + 迁移、骨架布局（标题栏 + 侧栏 + Outlet） | 地基 |
| **M1 周任务核心** | Tauri commands (CRUD)、链接解析/任务号超链接、分支默认、按周分组、状态切换、表格视图（@dnd-kit 拖拽排序）、详情页 `/tasks/:id` | 核心功能 |
| **M2 周报生成** | Markdown 模板生成、一键复制（clipboard plugin）、toast（sonner）、预览对话框 | |
| **M3 Markdown 笔记** | 主从布局、CodeMirror 编辑器、react-markdown 渲染、编辑/分屏/预览 ToggleGroup、防抖自动保存、标签 | |
| **M4 体验打磨** | 字体（Inter + Noto Sans SC）、Linear 状态图标（SVG）、快捷键、动效、Codex 侧栏（最近周次 + 标签聚合）、全局搜索（cmdk） | |
| **M5 主题 + 存储** | 5 套 CSS 变量主题预设、存储位置迁移（jilu.json config + DB 迁移）、复制周任务 | |
| **M6 扩展** | 主/子/bug 层级 + 可展开表格、Markdown 正文展示、MCP 服务（axum HTTP server）、托盘常驻（关窗隐藏） | 高级 |

> shadcn/ui 提供 Dialog / Command / ToggleGroup / AlertDialog / Table 等现成组件，UI 开发效率相比 Flutter 手搓大幅提升。

---

## 9. 决策记录

- [x] 技术栈：Flutter → **Tauri 2 + React + TypeScript + Vite + shadcn/ui + Tailwind CSS + SQLite**。牺牲自绘引擎的极致控制，换取 React 生态 + shadcn/ui 的 UI 开发效率。
- [x] 状态管理：**Zustand（UI 状态）+ TanStack Query（DB 数据缓存）**，替代 Riverpod。Query 自动处理缓存/失效/重新拉取。
- [x] DB 访问：Rust 端 **rusqlite + r2d2 连接池**，Tauri State 共享；前端通过 `invoke()` 调 Tauri commands；MCP server 同进程复用连接池。
- [x] 任务状态：3 种 — 开发中 / 已提测 / 已上线；新增默认开发中。
- [x] 链接展示：粘贴 URL → 解析任务号 → 仅展示任务号超链接（等宽、hover 变紫、点击浏览器打开）。
- [x] 代码分支：录入时自动 = 任务号，可改。
- [x] 周报：一键复制；含序号/任务名/任务号/类型/状态，子任务缩进。
- [x] 视图：仅表格视图（CSS grid 布局 + @dnd-kit 拖拽排序）。
- [x] Markdown 编辑：**CodeMirror 6**（行号、语法高亮）；渲染用 **react-markdown**。
- [x] 字体：Inter + 思源黑体（@fontsource，真字重），权重映射到 500/700，避开 600。
- [x] 主题：5 套预设（奶油白默认），CSS 变量驱动，持久化 `theme_preset`。切主题零 JS 重渲染。
- [x] 存储：DB 位置可配置 + 迁移，路径存 `jilu.json`（DB 之外）。
- [x] 全局搜索：Ctrl+P / 标题栏胶囊，cmdk 组件，搜任务 + 笔记，点结果定位。
- [x] 复制周任务：默认上周，勾选复制到当前周，状态重置开发中。
- [x] 不做数据导入导出（存储位置迁移已能满足换目录需求）。
- [x] **MCP 服务**：Rust axum 本地 HTTP server（127.0.0.1:7431/mcp），与 Tauri 共享 DB Pool；写入后 `emit('db_changed')` → 前端 `invalidateQueries()` 实时刷新。
- [x] **托盘常驻**：点关闭不退出，隐藏到系统托盘保 MCP 在线；托盘菜单「显示 / 退出」真正退出。
- [x] **任务层级**：主/子/bug 三型（`type` 与 `status` 正交）+ `parent_id`；表格展开看子项、点行钻进详情页；content 存 Markdown 纯展示。

---

## 10. MCP 服务 + 托盘常驻

### 10.1 MCP server（让 AI agent 接入）

jilu 在 Tauri 进程内跑一个 Rust axum HTTP server，与前端共享同一个 r2d2 SQLite 连接池。agent 通过 MCP 写入后 Rust 端 `app_handle.emit('db_changed')` → 前端 `listen()` → `invalidateQueries()` → UI 实时刷新。

- **传输**：Streamable HTTP，监听 `127.0.0.1:7431`，路径 `/mcp`。仅本机，不暴露外网。
- **依赖**：`axum` + `tokio`（Rust）。
- **启动**：Tauri `setup` 中 DB open 后启动（DB 就绪才能服务工具调用）；随 app 常驻（托盘隐藏时仍在运行）。
- **容器共享**：axum handler 通过 Tauri `State<DbPool>` 访问同一连接池。
- **暴露 tools**（MVP）：

  | tool | 入参 | 说明 |
  |---|---|---|
  | `create_task` | `name`(必填)、`link`(必填)、`branch?`、`week?`、`content?`、`type?`、`parent?`、`parent_id?` | 按 (week, taskNo) **upsert**（重导入刷新不重复）；复用 `link_parser` 解析任务号、分支默认=任务号；`content` 存 Markdown 正文；`type` = main/sub/bug；`parent`（父任务号）或 `parent_id` 挂到主任务下（同周内按 taskNo 解析）。返回行 id 便于链式建子任务。写后 `emit('db_changed')`。 |
  | `list_tasks` | `week?` | 列出某周顶层任务 + 缩进子任务/bug（默认本周），返回 `任务名 / 任务号 / 分支 / 类型 / 状态`。 |
  | `search` | `query`(必填) | 搜任务（命中 name/任务号/分支/**正文**）+ 笔记（标题/正文/标签），返回任务 + 笔记，带类型。 |

  后续可加：`update_task_status`、`create_note`、`list_notes`、`generate_weekly_report`。

#### 10.1.1 前置条件

1. 先启动 jilu（双击 exe 或 `npm run tauri dev`）。启动后控制台打印 `MCP Streamable HTTP Server listening on http://127.0.0.1:7431/mcp`。
2. **关窗不会退出**（见 §10.2），jilu 缩到系统托盘，MCP server 仍在线。只有在托盘菜单点「退出」才会真正停服务。
3. 设置页「集成」区显示 endpoint，可一键复制。

#### 10.1.2 接入到各类 AI 客户端

jilu 是 **HTTP 型 MCP server**（不是 stdio），客户端要支持 Streamable HTTP 传输。

**Claude Code**（命令行加，最简单）：

```bash
claude mcp add --transport http jilu http://127.0.0.1:7431/mcp
```

或手写 `~/.claude.json`（项目级放 `.mcp.json`）：

```json
{
  "mcpServers": {
    "jilu": { "type": "http", "url": "http://127.0.0.1:7431/mcp" }
  }
}
```

**Claude Desktop**：编辑 `claude_desktop_config.json`（Windows 在 `%APPDATA%\Claude\`）：

```json
{
  "mcpServers": {
    "jilu": { "type": "http", "url": "http://127.0.0.1:7431/mcp" }
  }
}
```

> Claude Desktop 对 HTTP transport 的支持取决于版本；若该版本只认 stdio，可写一个薄壳 stdio→HTTP 桥（后续按需补）。

**Cursor / 其它支持 Streamable HTTP 的客户端**：在 MCP 设置里新增一个 server，URL 填 `http://127.0.0.1:7431/mcp`，类型选 HTTP/Streamable。

#### 10.1.3 手动验证（curl）

发起 MCP `initialize` 握手，确认 server 在线：

```bash
curl -X POST http://127.0.0.1:7431/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"manual","version":"0.0.0"}}}'
```

预期返回 SSE 流，内含 `serverInfo: { name: "jilu", version: "1.0.0" }` 与 `capabilities: { tools }`。

> Streamable HTTP 是有状态会话：`initialize` 响应头会带 `Mcp-Session-Id`，后续 `notifications/initialized`、`tools/call` 请求需回带该 header。

调一个工具（创建任务）：

```bash
curl -X POST http://127.0.0.1:7431/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: <上面拿到的 session id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"create_task","arguments":{"name":"用户登录优化","link":"https://code.fastfish.com/browse/XXZX-29986"}}}'
```

预期返回 `已创建任务 #N：用户登录优化（XXZX-29986）于 2026-W27`，同时 jilu 界面该周任务列表实时多出这条。

#### 10.1.4 典型编排：Jira → jilu

agent 同时连两个 MCP：Jira MCP（读 issue）+ jilu MCP（写入）。提示词示例：

> 从 Jira 把本迭代（Sprint X）的 issue 拉出来，对每条调 jilu 的 `create_task`：name=issue 标题、link=issue 页 URL、week=本周。已存在的（按任务号）跳过。

agent 自行编排「读 Jira → 逐条 create_task → 汇总新建了哪些」，全程 jilu 不用手动开窗录入。

### 10.2 托盘常驻（关窗不退）

- **关闭即隐藏**：Tauri `WindowEvent::CloseRequested` 中 `api.prevent_close()` + `window.hide()`，不退出进程 → MCP server 保持在线。
- **托盘菜单**：「显示」（`window.show()` + `window.set_focus()`）+「退出」（`app.exit(0)` 真正退出）。
- **托盘图标**：复用应用图标。
- **设置页**：显示 MCP endpoint（`http://127.0.0.1:7431/mcp`）便于复制配置。