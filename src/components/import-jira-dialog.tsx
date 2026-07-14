import { useState } from "react";
import { toast } from "sonner";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { Modal } from "@/components/ui/modal";
import { fetchJiraIssue } from "@/api/jira";
import { useUpsertTask } from "@/hooks/useWeekTasks";
import { formatWeekRange } from "@/lib/utils/week-key";
import { autolinkBareUrls } from "@/lib/autolink";
import type { JiraIssue } from "@/types/jira";
import type { NewTask } from "@/types/week_task";

interface ImportJiraDialogProps {
  open: boolean;
  onClose: () => void;
  weekKey: string;
}

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
td.use(gfm);
// 强制把所有 <table> 转成 markdown 表格（gfm 只转带 <th> 的；Jira 表格常只有 td）
td.addRule("table", {
  filter: "table" as unknown as TurndownService.Filter,
  replacement: ((_content: string, node: HTMLElement) => {
    const rows = Array.from(node.querySelectorAll("tr"));
    if (rows.length === 0) return "";
    const toCells = (tr: Element) =>
      Array.from(tr.querySelectorAll("td,th")).map((c) =>
        td.turndown((c as HTMLElement).innerHTML).replace(/\n/g, " ").trim(),
      );
    const header = toCells(rows[0]);
    const body = rows.slice(1).map(toCells);
    const ncols = header.length || body[0]?.length || 0;
    if (ncols === 0) return "";
    const pad = (r: string[]) => {
      while (r.length < ncols) r.push("");
      return r;
    };
    let md = `| ${pad(header).join(" | ")} |\n| ${Array(ncols).fill("---").join(" | ")} |\n`;
    for (const r of body) md += `| ${pad(r).join(" | ")} |\n`;
    return `\n\n${md.trim()}\n\n`;
  }) as TurndownService.ReplacementFunction,
});

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** 把 Jira issue 拼成和现有导入格式一致的 markdown 正文 */
function buildContent(issue: JiraIssue): string {
  // 渲染描述里的相对图绝对化，便于凭据代理识别
  const html = (issue.rendered_description || "").replace(
    /(\bsrc=["'])(\/[^"']+)/g,
    "$1https://code.fastfish.com$2",
  );
  const desc = autolinkBareUrls(td.turndown(html).trim());
  const assignee = issue.assignee_name
    ? `${issue.assignee_name}${issue.assignee_email ? `（${issue.assignee_email}）` : ""}`
    : "未指派";

  const parts = [
    `# Jira 任务：${issue.key}`,
    "",
    "| 字段 | 内容 |",
    "|---|---|",
    `| 任务号 | ${issue.key} |`,
    `| 标题 | ${esc(issue.summary)} |`,
    `| 类型 | ${esc(issue.issuetype)} |`,
    `| 状态 | ${esc(issue.status)} |`,
    `| 优先级 | ${esc(issue.priority) || "无"} |`,
    `| 指派人 | ${esc(assignee)} |`,
    `| 创建时间 | ${esc(issue.created)} |`,
    `| 更新时间 | ${esc(issue.updated)} |`,
    `| Jira 链接 | [${issue.key}](https://code.fastfish.com/browse/${issue.key}) |`,
    "",
    "## 需求描述",
    "",
    desc || "（无描述）",
  ];
  if (issue.attachments.length > 0) {
    parts.push("", "## 附件图片", "");
    issue.attachments.forEach((a, i) => {
      parts.push(`### ${i + 1}. ${a.filename}`, `![${a.filename}](${a.url})`, "");
    });
  }
  return parts.join("\n");
}

/** 输入 Jira 任务号 → 拉取 → 转 markdown → upsert 到当前周 */
export function ImportJiraDialog({ open, onClose, weekKey }: ImportJiraDialogProps) {
  const [taskNo, setTaskNo] = useState("");
  const [busy, setBusy] = useState(false);
  const upsert = useUpsertTask(weekKey);

  const handleImport = async () => {
    const no = taskNo.trim();
    if (!no) return;
    setBusy(true);
    try {
      const issue = await fetchJiraIssue(no);
      if (!issue.key) throw new Error("Jira 没返回该任务，检查任务号/令牌");
      const task: NewTask = {
        name: issue.summary || no,
        link_url: `https://code.fastfish.com/browse/${issue.key}`,
        task_no: issue.key,
        branch: issue.branch,
        status: "dev",
        type: "main",
        parent_id: null,
        content: buildContent(issue),
        week_key: weekKey,
        sort_order: 0,
      };
      await upsert.mutateAsync(task);
      setTaskNo("");
      onClose();
    } catch (e) {
      toast.error(`导入失败：${e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="从 Jira 导入任务"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-md border border-input px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={busy || !taskNo.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "导入中…" : "导入到本周"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Jira 任务号
          </label>
          <input
            value={taskNo}
            autoFocus
            onChange={(e) => setTaskNo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) void handleImport();
            }}
            placeholder="如 XXZX-26586"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          拉取后自动转成 markdown（描述/表格/附件图）导入到当前周{" "}
          <span className="font-mono">{weekKey}</span>（{formatWeekRange(weekKey)}），
          统一建为本周主任务、状态开发中。重复导入同任务号会刷新不重复。
        </p>
      </div>
    </Modal>
  );
}
