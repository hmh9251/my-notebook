import { invoke } from "@tauri-apps/api/core";
import type { JiraIssue } from "@/types/jira";

/** 按 Jira 任务号拉 issue（含渲染后描述 HTML + 附件） */
export async function fetchJiraIssue(taskNo: string): Promise<JiraIssue> {
  return invoke("fetch_jira_issue", { taskNo });
}
