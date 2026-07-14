//! Jira REST：按任务号拉 issue（用 jira_token Bearer 认证，复用 proxy 的 fetch_bytes）

use serde_json::Value;

use crate::db::DbPool;

const JIRA_BASE: &str = "https://code.fastfish.com";

#[derive(Debug, Clone, serde::Serialize)]
pub struct JiraAttachment {
    pub filename: String,
    pub url: String,
    pub mime: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct JiraIssue {
    pub key: String,
    pub summary: String,
    pub issuetype: String,
    pub status: String,
    pub priority: String,
    pub assignee_name: String,
    pub assignee_email: String,
    pub created: String,
    pub updated: String,
    pub rendered_description: String,
    pub attachments: Vec<JiraAttachment>,
    /// 解析出的分支号：经办人是「我」的主任务号/子任务号，否则回退主任务号
    pub branch: String,
    /// 解析说明（前端可 toast 提示）
    pub branch_reason: String,
}

fn s(v: &Value, path: &[&str]) -> String {
    let mut cur = v;
    for p in path {
        match cur.get(p) {
            Some(n) => cur = n,
            None => return String::new(),
        }
    }
    cur.as_str().unwrap_or("").to_string()
}

struct Myself {
    email: String,
    key: String,
    name: String,
    display: String,
}

fn fetch_json(pool: &DbPool, path: &str) -> Result<Value, String> {
    let url = format!("{JIRA_BASE}{path}");
    let bytes = crate::proxy::fetch_bytes(pool, &url)?;
    serde_json::from_slice(&bytes).map_err(|e| format!("解析 Jira 响应失败：{e}"))
}

fn fetch_myself(pool: &DbPool) -> Result<Myself, String> {
    let v = fetch_json(pool, "/rest/api/2/myself")?;
    Ok(Myself {
        email: s(&v, &["emailAddress"]),
        key: s(&v, &["key"]),
        name: s(&v, &["name"]),
        display: s(&v, &["displayName"]),
    })
}

/// 经办人是不是当前用户（按 email / key / name / displayName 任一匹配）
fn is_me(assignee: &Value, me: &Myself) -> bool {
    let email = s(assignee, &["emailAddress"]);
    let key = s(assignee, &["key"]);
    let name = s(assignee, &["name"]);
    let display = s(assignee, &["displayName"]);
    (!email.is_empty() && email == me.email)
        || (!key.is_empty() && key == me.key)
        || (!name.is_empty() && name == me.name)
        || (!display.is_empty() && display == me.display)
}

/// 解析分支号：主任务经办人是我 → 主任务号；否则找经办人是我的子任务 → 子任务号；都没有 → 主任务号
fn resolve_branch(pool: &DbPool, key: &str, main_assignee: &Value, fields: &Value) -> (String, String) {
    // 默认回退主任务号
    let fallback = (key.to_string(), "未识别到经办人是你，分支号用主任务号".to_string());

    let me = match fetch_myself(pool) {
        Ok(m) => m,
        Err(e) => return (key.to_string(), format!("拿不到当前用户（{e}），分支号用主任务号")),
    };

    // 1) 主任务经办人是我
    if is_me(main_assignee, &me) {
        return (
            key.to_string(),
            format!("主任务经办人是你（{}），分支号用主任务号", me.display),
        );
    }

    // 2) 子任务经办人是我
    if let Some(subs) = fields["subtasks"].as_array() {
        for sub in subs.iter().take(30) {
            let subkey = s(sub, &["key"]);
            if subkey.is_empty() {
                continue;
            }
            // 子任务 stub 里经办人可能为空，单独拉一次
            let sub_assignee = match fetch_json(pool, &format!("/rest/api/2/issue/{subkey}?fields=assignee")) {
                Ok(v) => v["fields"]["assignee"].clone(),
                Err(_) => Value::Null,
            };
            if is_me(&sub_assignee, &me) {
                let reason = format!(
                    "子任务 {subkey} 经办人是你（{}），分支号用子任务号",
                    me.display
                );
                return (subkey, reason);
            }
        }
    }

    fallback
}

/// 按 Jira 任务号拉取 issue（含 renderedFields 渲染后的描述 HTML + 附件列表）
pub fn fetch_issue(pool: &DbPool, task_no: &str) -> Result<JiraIssue, String> {
    let key = task_no.trim().to_string();
    let v = fetch_json(pool, &format!("/rest/api/2/issue/{key}?expand=renderedFields"))?;

    let fields = &v["fields"];
    let assignee = &fields["assignee"];

    let mut attachments = Vec::new();
    if let Some(arr) = fields["attachment"].as_array() {
        for a in arr {
            let mime = s(a, &["mimeType"]);
            if mime.starts_with("image/") {
                attachments.push(JiraAttachment {
                    filename: s(a, &["filename"]),
                    url: s(a, &["content"]),
                    mime,
                });
            }
        }
    }

    let (branch, branch_reason) = resolve_branch(pool, &key, assignee, fields);

    Ok(JiraIssue {
        key: s(&v, &["key"]),
        summary: s(fields, &["summary"]),
        issuetype: s(fields, &["issuetype", "name"]),
        status: s(fields, &["status", "name"]),
        priority: s(fields, &["priority", "name"]),
        assignee_name: s(assignee, &["displayName"]),
        assignee_email: s(assignee, &["emailAddress"]),
        created: s(fields, &["created"]),
        updated: s(fields, &["updated"]),
        rendered_description: s(&v, &["renderedFields", "description"]),
        attachments,
        branch,
        branch_reason,
    })
}
