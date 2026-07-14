export interface JiraAttachment {
  filename: string;
  url: string;
  mime: string;
}

export interface JiraIssue {
  key: string;
  summary: string;
  issuetype: string;
  status: string;
  priority: string;
  assignee_name: string;
  assignee_email: string;
  created: string;
  updated: string;
  rendered_description: string; // HTML
  attachments: JiraAttachment[];
  /** 解析出的分支号（经办人是我的主/子任务号，否则回退主任务号） */
  branch: string;
  branch_reason: string;
}
