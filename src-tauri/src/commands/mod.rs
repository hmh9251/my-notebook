use crate::config;
use crate::db;
use tauri::State;

#[tauri::command]
pub fn get_storage_path(state: State<db::AppState>) -> String {
    state.storage_dir.clone()
}

/// 前端日志桥：把 JS 端的错误/诊断打到 Rust stdout，便于无 GUI 时排查
#[tauri::command]
pub fn log_frontend(level: String, msg: String) {
    match level.as_str() {
        "error" => log::error!("[frontend] {}", msg),
        "warn" => log::warn!("[frontend] {}", msg),
        _ => log::info!("[frontend] {}", msg),
    }
}

#[tauri::command]
pub fn db_health(state: State<db::AppState>) -> Result<String, String> {
    let conn = state
        .pool
        .get()
        .map_err(|e| format!("DB pool error: {}", e))?;

    let count: i64 = conn
        .query_row(
            "SELECT count(*) FROM sqlite_master WHERE type='table'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("DB query error: {}", e))?;

    Ok(format!("OK: {} tables", count))
}

/// 用凭据代理下载图片 → data URI（markdown img 内嵌渲染）
#[tauri::command]
pub async fn proxy_image(state: State<'_, db::AppState>, url: String) -> Result<String, String> {
    // 阻塞 IO 丢到 spawn_blocking，避免卡 runtime
    let pool = state.pool.clone();
    tauri::async_runtime::spawn_blocking(move || crate::proxy::fetch_data_uri(&pool, &url))
        .await
        .map_err(|e| format!("任务失败：{e}"))?
}

/// 用凭据下载 SVN/文件到缓存，返回本地路径
#[tauri::command]
pub async fn download_to_cache(
    state: State<'_, db::AppState>,
    url: String,
) -> Result<String, String> {
    let pool = state.pool.clone();
    let storage_dir = state.storage_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::proxy::download_to_cache(&pool, &storage_dir, &url)
    })
    .await
    .map_err(|e| format!("任务失败：{e}"))?
}

/// 按 Jira 任务号拉取 issue（REST + renderedFields，前端转 markdown 后导入）
#[tauri::command]
pub async fn fetch_jira_issue(
    state: State<'_, db::AppState>,
    task_no: String,
) -> Result<crate::jira::JiraIssue, String> {
    let pool = state.pool.clone();
    let inner = tauri::async_runtime::spawn_blocking(move || {
        crate::jira::fetch_issue(&pool, &task_no).map_err(|e| format!("{e}"))
    })
    .await
    .map_err(|e| format!("任务失败：{e}"))?;
    inner
}

/// upsert 任务（按 week+taskNo）：存在则更新元数据，不存在则新建
#[tauri::command]
pub fn upsert_task(state: State<db::AppState>, task: db::models::NewTask) -> Result<db::models::WeekTask, String> {
    db::week_tasks::upsert_task(
        &state.pool,
        &task.name,
        &task.link_url,
        &task.task_no,
        &task.branch,
        &task.r#type,
        &task.content,
        &task.week_key,
        task.parent_id,
    )
    .map(|(t, _)| t)
    .map_err(|e| format!("Failed to upsert task: {}", e))
}

// ── 文件缓存（主内容区预览 + 侧栏最近预览）──

/// 缓存文件并返回 base64（命中读盘、未命中下载落盘）
#[tauri::command]
pub async fn cache_file(
    state: State<'_, db::AppState>,
    url: String,
) -> Result<db::models::CachedFileWithBytes, String> {
    let pool = state.pool.clone();
    let storage_dir = state.storage_dir.clone();
    let inner = tauri::async_runtime::spawn_blocking(move || {
        db::file_cache::cache_file(&pool, &storage_dir, &url).map_err(|e| format!("{e}"))
    })
    .await
    .map_err(|e| format!("任务失败：{e}"))?;
    inner
}

#[tauri::command]
pub fn list_cached_files(state: State<db::AppState>) -> Result<Vec<db::models::CachedFile>, String> {
    db::file_cache::list_cached_files(&state.pool).map_err(|e| format!("读取缓存失败：{e}"))
}

#[tauri::command]
pub fn delete_cached_file(state: State<db::AppState>, url: String) -> Result<(), String> {
    db::file_cache::delete_cached_file(&state.pool, &url).map_err(|e| format!("删除失败：{e}"))
}

/// 清空全部预览缓存
#[tauri::command]
pub fn clear_file_cache(state: State<db::AppState>) -> Result<u64, String> {
    db::file_cache::clear_all(&state.pool).map_err(|e| format!("清空失败：{e}"))
}

/// 删除 N 个月前的任务
#[tauri::command]
pub fn delete_old_tasks(state: State<db::AppState>, months: i64) -> Result<u64, String> {
    db::week_tasks::delete_older_than(&state.pool, months).map_err(|e| format!("删除失败：{e}"))
}

// ── 设置（键值对，theme_preset 等）──

#[tauri::command]
pub fn get_setting(state: State<db::AppState>, key: String) -> Result<Option<String>, String> {
    db::settings::get_setting(&state.pool, &key)
        .map_err(|e| format!("Failed to get setting: {}", e))
}

#[tauri::command]
pub fn set_setting(state: State<db::AppState>, key: String, value: String) -> Result<(), String> {
    db::settings::set_setting(&state.pool, &key, &value)
        .map_err(|e| format!("Failed to set setting: {}", e))
}

// ── 存储位置 ──

/// 在资源管理器中打开路径（跨平台）
#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    let mut cmd = std::process::Command::new(
        match std::env::consts::OS {
            "windows" => "explorer.exe",
            "macos" => "open",
            _ => "xdg-open",
        },
    );
    cmd.arg(&path);
    cmd.spawn().map_err(|e| format!("打开失败：{}", e))?;
    Ok(())
}

/// 迁移 DB：复制到新目录 → 写 jilu.json → 重启
#[tauri::command]
pub fn change_storage_path(
    app: tauri::AppHandle,
    state: State<db::AppState>,
    new_dir: String,
) -> Result<(), String> {
    let new_dir_path = std::path::PathBuf::from(&new_dir);
    std::fs::create_dir_all(&new_dir_path).map_err(|e| format!("无法创建目录：{}", e))?;

    let old_db = std::path::PathBuf::from(&state.storage_dir).join("jilu.db");
    let new_db = new_dir_path.join("jilu.db");

    // 复制旧库到新位置（若已存在同名，先移除）
    if new_db.exists() {
        let _ = std::fs::remove_file(&new_db);
    }
    std::fs::copy(&old_db, &new_db).map_err(|e| format!("复制数据库失败：{}", e))?;

    // 写 config（jilu.json）
    config::set_storage_dir(std::path::Path::new(&state.config_dir), &new_dir_path)
        .map_err(|e| format!("写入配置失败：{}", e))?;

    // 尝试删旧库（忽略失败：Windows 下可能被占用）
    let _ = std::fs::remove_file(&old_db);

    log::info!("Storage migrated to {}, restarting…", new_dir);
    app.restart();
}

#[tauri::command]
pub fn get_tasks_by_week(state: State<db::AppState>, week_key: String) -> Result<Vec<db::models::WeekTask>, String> {
    db::week_tasks::get_tasks_by_week(&state.pool, &week_key)
        .map_err(|e| format!("Failed to get tasks: {}", e))
}

#[tauri::command]
pub fn get_all_week_keys(state: State<db::AppState>) -> Result<Vec<String>, String> {
    db::week_tasks::get_all_week_keys(&state.pool)
        .map_err(|e| format!("Failed to get week keys: {}", e))
}

#[tauri::command]
pub fn get_task_by_id(state: State<db::AppState>, id: i64) -> Result<Option<db::models::WeekTask>, String> {
    db::week_tasks::get_task_by_id(&state.pool, id)
        .map_err(|e| format!("Failed to get task: {}", e))
}

#[tauri::command]
pub fn get_task_children(state: State<db::AppState>, id: i64) -> Result<Vec<db::models::WeekTask>, String> {
    db::week_tasks::get_task_children(&state.pool, id)
        .map_err(|e| format!("Failed to get task children: {}", e))
}

#[tauri::command]
pub fn get_week_task_children(state: State<db::AppState>, week_key: String) -> Result<std::collections::HashMap<i64, Vec<db::models::WeekTask>>, String> {
    db::week_tasks::get_week_task_children(&state.pool, &week_key)
        .map_err(|e| format!("Failed to get week task children: {}", e))
}

#[tauri::command]
pub fn reorder_tasks(state: State<db::AppState>, week_key: String, ordered_ids: Vec<i64>) -> Result<(), String> {
    db::week_tasks::reorder_tasks(&state.pool, &week_key, &ordered_ids)
        .map_err(|e| format!("Failed to reorder tasks: {}", e))
}

#[tauri::command]
pub fn search_tasks(state: State<db::AppState>, query: String) -> Result<Vec<db::models::WeekTask>, String> {
    db::week_tasks::search_tasks(&state.pool, &query)
        .map_err(|e| format!("Failed to search tasks: {}", e))
}

#[tauri::command]
pub fn get_recent_weeks(state: State<db::AppState>) -> Result<Vec<db::models::RecentWeek>, String> {
    db::week_tasks::get_recent_weeks(&state.pool)
        .map_err(|e| format!("Failed to get recent weeks: {}", e))
}

/// 统一搜索：任务 + 笔记，最多 50 条
#[tauri::command]
pub fn search(state: State<db::AppState>, query: String) -> Result<Vec<db::models::SearchResult>, String> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(Vec::new());
    }
    let tasks = db::week_tasks::search_tasks(&state.pool, q)
        .map_err(|e| format!("Failed to search tasks: {}", e))?;
    let notes = db::notes::search_notes(&state.pool, q)
        .map_err(|e| format!("Failed to search notes: {}", e))?;

    let mut results: Vec<db::models::SearchResult> = Vec::new();
    for t in tasks.iter().take(25) {
        results.push(db::models::SearchResult::Task {
            id: t.id,
            name: t.name.clone(),
            task_no: t.task_no.clone(),
            week_key: t.week_key.clone(),
        });
    }
    for n in notes.iter().take(25) {
        let preview: String = n.content.chars().take(80).collect();
        results.push(db::models::SearchResult::Note {
            id: n.id,
            title: n.title.clone(),
            preview,
        });
    }
    Ok(results)
}

#[tauri::command]
pub fn create_task(state: State<db::AppState>, task: db::models::NewTask) -> Result<db::models::WeekTask, String> {
    db::week_tasks::create_task(&state.pool, &task)
        .map_err(|e| format!("Failed to create task: {}", e))
}

#[tauri::command]
pub fn update_task(state: State<db::AppState>, id: i64, task: db::models::NewTask) -> Result<db::models::WeekTask, String> {
    db::week_tasks::update_task(&state.pool, id, &task)
        .map_err(|e| format!("Failed to update task: {}", e))
}

#[tauri::command]
pub fn update_task_status(state: State<db::AppState>, id: i64, status: String) -> Result<db::models::WeekTask, String> {
    db::week_tasks::update_task_status(&state.pool, id, &status)
        .map_err(|e| format!("Failed to update task status: {}", e))
}

#[tauri::command]
pub fn update_task_sort_order(state: State<db::AppState>, id: i64, sort_order: i64) -> Result<db::models::WeekTask, String> {
    db::week_tasks::update_task_sort_order(&state.pool, id, sort_order)
        .map_err(|e| format!("Failed to update task sort: {}", e))
}

#[tauri::command]
pub fn delete_task(state: State<db::AppState>, id: i64) -> Result<(), String> {
    db::week_tasks::delete_task(&state.pool, id)
        .map_err(|e| format!("Failed to delete task: {}", e))
}

/// 复制任务：from_week 的指定 ids → to_week（状态重置开发中）
#[tauri::command]
pub fn copy_week_tasks(
    state: State<db::AppState>,
    from_week: String,
    to_week: String,
    task_ids: Vec<i64>,
) -> Result<u64, String> {
    db::week_tasks::copy_week_tasks(&state.pool, &from_week, &to_week, &task_ids)
        .map_err(|e| format!("Failed to copy week tasks: {}", e))
}

#[tauri::command]
pub fn generate_weekly_report(state: State<db::AppState>, week_key: String) -> Result<String, String> {
    db::weekly_report::generate_weekly_report(&state.pool, &week_key)
        .map_err(|e| format!("Failed to generate report: {}", e))
}

// ── 笔记 commands ──

#[tauri::command]
pub fn get_notes(
    state: State<db::AppState>,
    filter: String,
    folder_id: Option<i64>,
) -> Result<Vec<db::models::Note>, String> {
    db::notes::get_notes(&state.pool, &filter, folder_id)
        .map_err(|e| format!("Failed to get notes: {}", e))
}

#[tauri::command]
pub fn get_note_by_id(state: State<db::AppState>, id: i64) -> Result<Option<db::models::Note>, String> {
    db::notes::get_note_by_id(&state.pool, id)
        .map_err(|e| format!("Failed to get note: {}", e))
}

#[tauri::command]
pub fn create_note(
    state: State<db::AppState>,
    title: String,
    folder_id: Option<i64>,
) -> Result<db::models::Note, String> {
    db::notes::create_note(&state.pool, &title, folder_id)
        .map_err(|e| format!("Failed to create note: {}", e))
}

#[tauri::command]
pub fn update_note(state: State<db::AppState>, note: db::models::Note) -> Result<db::models::Note, String> {
    db::notes::update_note(&state.pool, &note)
        .map_err(|e| format!("Failed to update note: {}", e))
}

#[tauri::command]
pub fn move_note(
    state: State<db::AppState>,
    id: i64,
    folder_id: Option<i64>,
) -> Result<(), String> {
    db::notes::move_note(&state.pool, id, folder_id)
        .map_err(|e| format!("Failed to move note: {}", e))
}

#[tauri::command]
pub fn delete_note(state: State<db::AppState>, id: i64) -> Result<(), String> {
    db::notes::delete_note(&state.pool, id)
        .map_err(|e| format!("Failed to delete note: {}", e))
}

// ── 文件夹 commands ──

#[tauri::command]
pub fn get_folders(state: State<db::AppState>) -> Result<Vec<db::models::Folder>, String> {
    db::folders::list_folders(&state.pool).map_err(|e| format!("Failed to get folders: {}", e))
}

#[tauri::command]
pub fn get_uncat_count(state: State<db::AppState>) -> Result<i64, String> {
    db::folders::uncat_count(&state.pool).map_err(|e| format!("Failed to get uncat count: {}", e))
}

#[tauri::command]
pub fn create_folder(state: State<db::AppState>, name: String) -> Result<i64, String> {
    db::folders::create_folder(&state.pool, &name).map_err(|e| format!("Failed to create folder: {}", e))
}

#[tauri::command]
pub fn rename_folder(state: State<db::AppState>, id: i64, name: String) -> Result<(), String> {
    db::folders::rename_folder(&state.pool, id, &name).map_err(|e| format!("Failed to rename folder: {}", e))
}

#[tauri::command]
pub fn delete_folder(state: State<db::AppState>, id: i64) -> Result<(), String> {
    db::folders::delete_folder(&state.pool, id).map_err(|e| format!("Failed to delete folder: {}", e))
}