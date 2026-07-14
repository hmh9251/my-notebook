//! MCP Streamable HTTP server（axum），与 Tauri 同进程共享 r2d2 连接池。
//! 监听 127.0.0.1:7431，路径 /mcp。写入后通过 app.emit("db_changed") 通知前端刷新。

use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::db::{self, DbPool};
use crate::link_parser;

#[derive(Clone)]
pub struct McpState {
    pool: DbPool,
    app: AppHandle,
    sessions: Arc<Mutex<HashSet<String>>>,
}

static SEQ: AtomicU64 = AtomicU64::new(1);

/// 构建 MCP router，由 setup 在 DB 就绪后启动。
pub fn router(pool: DbPool, app: AppHandle) -> Router {
    Router::new()
        .route(
            "/mcp",
            post(handle_post).get(handle_get).delete(handle_delete),
        )
        .with_state(McpState {
            pool,
            app,
            sessions: Arc::new(Mutex::new(HashSet::new())),
        })
}

/// GET：本 server 不向客户端推送 SSE，返回 406（spec 允许）。
async fn handle_get() -> Response {
    (StatusCode::NOT_ACCEPTABLE, "MCP server does not push SSE; use POST.").into_response()
}

/// DELETE：删除会话（lenient：仅日志）
async fn handle_delete(State(state): State<McpState>, headers: HeaderMap) -> Response {
    if let Some(sid) = headers.get("mcp-session-id").and_then(|v| v.to_str().ok()) {
        state.sessions.lock().unwrap().remove(sid);
    }
    StatusCode::OK.into_response()
}

async fn handle_post(
    State(state): State<McpState>,
    Json(req): Json<Value>,
) -> Response {
    let method = req.get("method").and_then(|v| v.as_str()).unwrap_or("");
    let id = req.get("id").cloned();

    // 通知（无 id 或 id 为 null）→ 202
    let is_notification = id.as_ref().map(|v| v.is_null()).unwrap_or(true);
    if is_notification {
        return StatusCode::ACCEPTED.into_response();
    }

    let id = id.unwrap_or(Value::Null);

    let (body, session_header): (Value, Option<String>) = match method {
        "initialize" => {
            let sid = format!("jilu-{}", SEQ.fetch_add(1, Ordering::SeqCst));
            state.sessions.lock().unwrap().insert(sid.clone());
            let b = json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "protocolVersion": "2025-06-18",
                    "serverInfo": { "name": "jilu", "version": "1.0.0" },
                    "capabilities": { "tools": {} }
                }
            });
            (b, Some(sid))
        }
        "tools/list" => (
            json!({ "jsonrpc": "2.0", "id": id, "result": { "tools": tool_list() } }),
            None,
        ),
        "tools/call" => {
            let params = req.get("params").cloned().unwrap_or(json!({}));
            (handle_tool_call(&state, &params, id), None)
        }
        other => (
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32601, "message": format!("unknown method: {other}") }
            }),
            None,
        ),
    };

    let mut headers = HeaderMap::new();
    headers.insert("content-type", "application/json".parse().unwrap());
    if let Some(sid) = session_header {
        if let Ok(hv) = sid.as_str().parse() {
            headers.insert("mcp-session-id", hv);
        }
    }
    (StatusCode::OK, headers, body.to_string()).into_response()
}

fn tool_list() -> Vec<Value> {
    vec![
        json!({
            "name": "create_task",
            "description": "创建或更新（按 week+taskNo upsert）一条周任务。link 自动解析任务号，分支默认=任务号，type=main/sub/bug，parent 传父任务号。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "任务名称（必填）" },
                    "link": { "type": "string", "description": "任务链接（必填），自动解析任务号" },
                    "branch": { "type": "string" },
                    "week": { "type": "string", "description": "ISO 周次 YYYY-Www，默认本周" },
                    "content": { "type": "string", "description": "Markdown 正文" },
                    "type": { "type": "string", "enum": ["main", "sub", "bug"] },
                    "parent": { "type": "string", "description": "父任务号（同周内解析）" },
                    "parent_id": { "type": "integer" }
                },
                "required": ["name", "link"]
            }
        }),
        json!({
            "name": "list_tasks",
            "description": "列出某周顶层任务及其子任务/缺陷（默认本周）。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "week": { "type": "string", "description": "ISO 周次，默认本周" }
                }
            }
        }),
        json!({
            "name": "list_notes",
            "description": "列出全部 Markdown 笔记（标题/标签/更新时间）。",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "create_note",
            "description": "新建一条 Markdown 笔记。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": { "type": "string" },
                    "content": { "type": "string", "description": "Markdown 正文" },
                    "tags": { "type": "string", "description": "逗号分隔" }
                },
                "required": ["title"]
            }
        }),
    ]
}

fn handle_tool_call(state: &McpState, params: &Value, id: Value) -> Value {
    let name = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let args = params.get("arguments").cloned().unwrap_or(json!({}));
    let (text, is_error) = match name {
        "create_task" => tool_create_task(state, &args),
        "list_tasks" => tool_list_tasks(state, &args),
        "list_notes" => tool_list_notes(state),
        "create_note" => tool_create_note(state, &args),
        other => (format!("unknown tool: {other}"), true),
    };
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": {
            "content": [{ "type": "text", "text": text }],
            "isError": is_error
        }
    })
}

fn tool_create_task(state: &McpState, args: &Value) -> (String, bool) {
    let name = match args.get("name").and_then(|v| v.as_str()) {
        Some(s) => s,
        None => return ("missing required 'name'".into(), true),
    };
    let link = match args.get("link").and_then(|v| v.as_str()) {
        Some(s) => s,
        None => return ("missing required 'link'".into(), true),
    };
    let task_no = link_parser::parse_task_no(link);
    let branch = args
        .get("branch")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(|| link_parser::default_branch(&task_no));
    let week = args
        .get("week")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(|| db::week_tasks::current_iso_week_key());
    let type_ = args.get("type").and_then(|v| v.as_str()).unwrap_or("main");
    let content = args.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let parent_id = if let Some(pid) = args.get("parent_id").and_then(|v| v.as_i64()) {
        Some(pid)
    } else if let Some(pno) = args.get("parent").and_then(|v| v.as_str()) {
        match db::week_tasks::find_task_id_by_no(&state.pool, &week, pno) {
            Ok(o) => o,
            Err(_) => None,
        }
    } else {
        None
    };

    match db::week_tasks::upsert_task(
        &state.pool, name, link, &task_no, &branch, type_, content, &week, parent_id,
    ) {
        Ok((t, created)) => {
            let _ = state.app.emit("db_changed", json!({ "kind": "task", "id": t.id }));
            (
                json!({
                    "id": t.id,
                    "week_key": t.week_key,
                    "task_no": t.task_no,
                    "branch": t.branch,
                    "type": t.r#type,
                    "action": if created { "created" } else { "updated" }
                })
                .to_string(),
                false,
            )
        }
        Err(e) => (format!("db error: {e}"), true),
    }
}

fn tool_list_tasks(state: &McpState, args: &Value) -> (String, bool) {
    let week = args
        .get("week")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(|| db::week_tasks::current_iso_week_key());
    match db::week_tasks::get_tasks_by_week(&state.pool, &week) {
        Ok(all) => {
            let children_map =
                db::week_tasks::get_week_task_children(&state.pool, &week).unwrap_or_default();
            let arr: Vec<Value> = all
                .iter()
                .filter(|t| t.parent_id.is_none())
                .map(|t| {
                    let kids = children_map.get(&t.id).cloned().unwrap_or_default();
                    json!({
                        "name": t.name,
                        "task_no": t.task_no,
                        "branch": t.branch,
                        "type": t.r#type,
                        "status": t.status,
                        "children": kids.iter().map(|c| json!({
                            "name": c.name, "task_no": c.task_no, "branch": c.branch,
                            "type": c.r#type, "status": c.status
                        })).collect::<Vec<_>>()
                    })
                })
                .collect();
            (json!({ "week": week, "tasks": arr }).to_string(), false)
        }
        Err(e) => (format!("db error: {e}"), true),
    }
}

fn tool_list_notes(state: &McpState) -> (String, bool) {
    match db::notes::get_notes(&state.pool, "all", None) {
        Ok(notes) => {
            let arr: Vec<Value> = notes
                .iter()
                .map(|n| {
                    json!({
                        "id": n.id,
                        "title": n.title,
                        "tags": n.tags,
                        "updated_at": n.updated_at
                    })
                })
                .collect();
            (json!({ "notes": arr }).to_string(), false)
        }
        Err(e) => (format!("db error: {e}"), true),
    }
}

fn tool_create_note(state: &McpState, args: &Value) -> (String, bool) {
    let title = match args.get("title").and_then(|v| v.as_str()) {
        Some(s) => s,
        None => return ("missing required 'title'".into(), true),
    };
    let content = args.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let tags = args.get("tags").and_then(|v| v.as_str()).map(String::from);
    match db::notes::create_note(&state.pool, title, None) {
        Ok(mut n) => {
            n.content = content.to_string();
            n.tags = tags;
            match db::notes::update_note(&state.pool, &n) {
                Ok(updated) => {
                    let _ = state.app.emit("db_changed", json!({ "kind": "note", "id": updated.id }));
                    (json!({ "id": updated.id, "title": updated.title }).to_string(), false)
                }
                Err(e) => (format!("db error: {e}"), true),
            }
        }
        Err(e) => (format!("db error: {e}"), true),
    }
}
