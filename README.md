# 记录 — 本地笔记工具

一个 Windows 本地的轻量笔记工具，两大核心模块：**周任务管理** + **Markdown 笔记记录**。基于 Tauri 2 + React + SQLite 构建，数据完全离线存储于本机。

## 功能

### 周任务管理
- **任务层级**：主任务 / 子任务 / 缺陷，chevron 展开看子项
- **拖拽排序**：@dnd-kit/sortable + DragOverlay 拎起阴影反馈
- **状态切换**：开发中 → 已提测 → 已上线（Linear 风格 SVG 图标）
- **复制周任务**：选来源周 ‹› 翻、勾选、目标周已存在置灰
- **Jira 导入**：输任务号 → REST API 拉取 → turndown 转 markdown → 录入（经办人判断分支号）
- **周报生成**：纯文本列表格式（1. 任务名（任务号，类型，状态）），一键复制
- **全局搜索**：cmdk + Ctrl+P，搜任务（名称/任务号/分支/正文）+ 笔记（标题/正文/标签）

### Markdown 笔记
- **CodeMirror 6 编辑器**：行号、语法高亮、自动缩进
- **文件夹管理**：新建/删除/重命名文件夹，笔记可移动文件夹
- **预览/编辑/分屏**三模式切换，默认预览
- **防抖自动保存**：停笔 600ms 自动写库
- **Jira 附件图片**：凭据代理下载 → data URI 内嵌渲染

### Word/Excel 软件内预览
- **Word**：docx-preview 忠实渲染（颜色、表格、目录字段、页眉页脚）
- **Excel**：exceljs 自研渲染（颜色、删除线、边框、对齐、合并单元格）
- **目录导航**：左侧 TOC 侧栏（解析 document.xml + styles.xml 提取所有层级标题）
- **缩放**：底部缩放栏（50%–250%）
- **Tab 模式**：任务详情内开 tab 预览文件，不跳路由（正文常驻 → 滚动天然保留）
- **凭据代理**：Jira 访问令牌（Bearer）+ SVN 账号密码（Basic），忽略自签证书
- **缓存**：预览过的文件缓存到本地，按 url 记忆滚动位置 + 缩放
- **SVN 链接自动识别**：导入的 markdown 正文里裸 SVN 地址自动成链接 → 点击直接预览

### 主题与存储
- **5 套主题**：奶油白（默认）、冷灰白、薄荷白、粉白、线性深色
- **存储位置迁移**：jilu.json config + DB 复制 + 重启
- **系统托盘**：关窗隐藏（左键单击显示，右键菜单退出）

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Tauri 2 + React 18 + TypeScript |
| 样式 | Tailwind CSS（CSS 变量驱动主题） |
| 存储 | SQLite（rusqlite + r2d2 连接池） |
| 状态 | Zustand（UI state）+ TanStack Query（DB cache） |
| 编辑器 | CodeMirror 6（@uiw/react-codemirror） |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| Word 预览 | docx-preview + JSZip |
| Excel 预览 | exceljs（自研渲染器） |
| HTML→MD | turndown + turndown-plugin-gfm |
| HTTP 代理 | reqwest（danger_accept_invalid_certs） |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable |
| 搜索 | cmdk |
| 日志 | tauri-plugin-log |
| 图标 | lucide-react |

## 开发

```bash
# 安装依赖
npm install

# 开发模式（vite + tauri 热更新）
npm run tauri dev

# 打包（只产出 exe，不产出安装包）
npx tauri build --no-bundle
```

打包后 exe 在 `src-tauri/target/release/jilu.exe`，双击即可运行（需 WebView2 运行时，Win11 自带）。

## 项目结构

```
notebook/
├── src/                    # React 前端
│   ├── components/         # 组件（编辑器、表格、预览面板、侧栏等）
│   ├── pages/              # 路由页（周任务、笔记、设置、文件预览）
│   ├── hooks/              # TanStack Query hooks
│   ├── api/                # Tauri invoke 封装
│   ├── lib/                # 工具（主题、autolink、excel 渲染、stores）
│   ├── types/              # TypeScript 类型
│   └── styles/             # globals.css（主题 CSS 变量 + CodeMirror 覆盖）
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── commands/       # Tauri commands（IPC 接口）
│   │   ├── db/             # SQLite 层（schema、models、week_tasks、notes、folders 等）
│   │   ├── jira.rs         # Jira REST 拉取
│   │   ├── proxy.rs        # 凭据代理抓取
│   │   ├── config.rs       # jilu.json 读写
│   │   ├── tray.rs         # 系统托盘
│   │   └── link_parser.rs  # 任务号解析
│   ├── capabilities/       # Tauri 权限
│   └── icons/              # 应用图标
└── 设计文档-tauri.md        # 设计文档
```

## License

MIT
