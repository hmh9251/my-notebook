import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { autolinkBareUrls } from "@/lib/autolink";
import { formatDateTime } from "@/lib/utils/format";
import type { JiraIssue } from "@/types/jira";

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

/** 把 Jira issue 拼成 markdown 正文（描述/表格/附件图 + 字段表） */
export function buildContent(issue: JiraIssue): string {
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
    `| 创建时间 | ${esc(formatDateTime(issue.created))} |`,
    `| 更新时间 | ${esc(formatDateTime(issue.updated))} |`,
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
