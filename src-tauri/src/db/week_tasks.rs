use chrono::{Datelike, Local, SecondsFormat};
use rusqlite::{params, OptionalExtension, Row};
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;

use super::models::*;
use super::weekly_report::iso_week_dates;

type DbPool = Pool<SqliteConnectionManager>;

fn now_str() -> String {
    Local::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

fn row_to_task(row: &Row) -> Result<WeekTask, rusqlite::Error> {
    Ok(WeekTask {
        id: row.get(0)?,
        name: row.get(1)?,
        link_url: row.get(2)?,
        task_no: row.get(3)?,
        branch: row.get(4)?,
        status: row.get(5)?,
        r#type: row.get(6)?,
        parent_id: row.get(7)?,
        content: row.get(8)?,
        week_key: row.get(9)?,
        sort_order: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

pub fn get_tasks_by_week(pool: &DbPool, week_key: &str) -> Result<Vec<WeekTask>, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare("SELECT * FROM week_tasks WHERE week_key = ? ORDER BY sort_order ASC")?;
    let rows = stmt.query_map(params![week_key], row_to_task)?;
    let mut tasks = Vec::new();
    for row in rows {
        tasks.push(row?);
    }
    Ok(tasks)
}

pub fn get_all_week_keys(pool: &DbPool) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare("SELECT DISTINCT week_key FROM week_tasks ORDER BY week_key DESC")?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    let mut keys = Vec::new();
    for row in rows {
        keys.push(row?);
    }
    Ok(keys)
}

/// 取单条任务
pub fn get_task_by_id(pool: &DbPool, id: i64) -> Result<Option<WeekTask>, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare("SELECT * FROM week_tasks WHERE id = ?")?;
    let mut rows = stmt.query(params![id])?;
    match rows.next()? {
        Some(row) => Ok(Some(row_to_task(row)?)),
        None => Ok(None),
    }
}

/// 取某主任务的子项（sub/bug）
pub fn get_task_children(pool: &DbPool, id: i64) -> Result<Vec<WeekTask>, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT * FROM week_tasks WHERE parent_id = ? ORDER BY sort_order ASC",
    )?;
    let rows = stmt.query_map(params![id], row_to_task)?;
    let mut tasks = Vec::new();
    for row in rows {
        tasks.push(row?);
    }
    Ok(tasks)
}

/// 取某周 parentId → 子项 分组（表格展开用，全周一次查）
pub fn get_week_task_children(
    pool: &DbPool,
    week_key: &str,
) -> Result<std::collections::HashMap<i64, Vec<WeekTask>>, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT * FROM week_tasks WHERE week_key = ? AND parent_id IS NOT NULL ORDER BY sort_order ASC",
    )?;
    let rows = stmt.query_map(params![week_key], row_to_task)?;
    let mut map: std::collections::HashMap<i64, Vec<WeekTask>> = std::collections::HashMap::new();
    for row in rows {
        let task = row?;
        if let Some(pid) = task.parent_id {
            map.entry(pid).or_default().push(task);
        }
    }
    Ok(map)
}

/// 批量重排：按 ordered_ids 顺序写入 sort_order
pub fn reorder_tasks(
    pool: &DbPool,
    _week_key: &str,
    ordered_ids: &[i64],
) -> Result<(), Box<dyn std::error::Error>> {
    let mut conn = pool.get()?;
    let now = now_str();
    let tx = conn.transaction()?;
    {
        let mut stmt = tx.prepare(
            "UPDATE week_tasks SET sort_order = ?, updated_at = ? WHERE id = ?",
        )?;
        for (idx, id) in ordered_ids.iter().enumerate() {
            stmt.execute(params![idx as i64, &now, id])?;
        }
    }
    tx.commit()?;
    Ok(())
}

pub fn create_task(pool: &DbPool, task: &NewTask) -> Result<WeekTask, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let now = now_str();
    let status = if task.status.is_empty() { "dev" } else { &task.status };
    let r#type = if task.r#type.is_empty() { "main" } else { &task.r#type };
    
    conn.execute(
        "INSERT INTO week_tasks (name, link_url, task_no, branch, status, type, parent_id, content, week_key, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            task.name,
            task.link_url,
            task.task_no,
            task.branch,
            status,
            r#type,
            task.parent_id,
            task.content,
            task.week_key,
            task.sort_order,
            now,
            now,
        ],
    )?;
    
    let id = conn.last_insert_rowid();
    
    Ok(WeekTask {
        id,
        name: task.name.clone(),
        link_url: task.link_url.clone(),
        task_no: task.task_no.clone(),
        branch: task.branch.clone(),
        status: status.to_string(),
        r#type: r#type.to_string(),
        parent_id: task.parent_id,
        content: task.content.clone(),
        week_key: task.week_key.clone(),
        sort_order: task.sort_order,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn update_task(pool: &DbPool, id: i64, task: &NewTask) -> Result<WeekTask, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let now = now_str();
    let status = if task.status.is_empty() { "dev" } else { &task.status };
    let r#type = if task.r#type.is_empty() { "main" } else { &task.r#type };
    
    conn.execute(
        "UPDATE week_tasks SET name = ?, link_url = ?, task_no = ?, branch = ?, status = ?, type = ?, parent_id = ?, content = ?, week_key = ?, sort_order = ?, updated_at = ? WHERE id = ?",
        params![
            task.name,
            task.link_url,
            task.task_no,
            task.branch,
            status,
            r#type,
            task.parent_id,
            task.content,
            task.week_key,
            task.sort_order,
            now,
            id,
        ],
    )?;
    
    let mut stmt = conn.prepare("SELECT * FROM week_tasks WHERE id = ?")?;
    let task = stmt.query_row(params![id], row_to_task)?;
    
    Ok(task)
}

pub fn update_task_status(pool: &DbPool, id: i64, status: &str) -> Result<WeekTask, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let now = now_str();
    
    conn.execute(
        "UPDATE week_tasks SET status = ?, updated_at = ? WHERE id = ?",
        params![status, now, id],
    )?;
    
    let mut stmt = conn.prepare("SELECT * FROM week_tasks WHERE id = ?")?;
    let task = stmt.query_row(params![id], row_to_task)?;
    
    Ok(task)
}

pub fn update_task_sort_order(pool: &DbPool, id: i64, sort_order: i64) -> Result<WeekTask, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let now = now_str();
    
    conn.execute(
        "UPDATE week_tasks SET sort_order = ?, updated_at = ? WHERE id = ?",
        params![sort_order, now, id],
    )?;
    
    let mut stmt = conn.prepare("SELECT * FROM week_tasks WHERE id = ?")?;
    let task = stmt.query_row(params![id], row_to_task)?;
    
    Ok(task)
}

pub fn delete_task(pool: &DbPool, id: i64) -> Result<(), Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    conn.execute("DELETE FROM week_tasks WHERE id = ?", params![id])?;
    Ok(())
}

/// 删除 created_at 早于 N 个月前的任务（RFC3339 同偏移可字典序比较）
pub fn delete_older_than(pool: &DbPool, months: i64) -> Result<u64, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let cutoff = chrono::Local::now() - chrono::Duration::days(months * 30);
    let cutoff_str = cutoff.to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
    let n = conn.execute(
        "DELETE FROM week_tasks WHERE created_at < ?",
        params![cutoff_str],
    )?;
    Ok(n as u64)
}

/// upsert：按 (week_key, task_no) 存在则更新元数据（保留 status/sort_order），否则新建（status=dev，sort_order 追加）。
/// 返回 (任务, created)。
pub fn upsert_task(
    pool: &DbPool,
    name: &str,
    link_url: &str,
    task_no: &str,
    branch: &str,
    type_: &str,
    content: &str,
    week_key: &str,
    parent_id: Option<i64>,
) -> Result<(WeekTask, bool), Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let now = now_str();

    let existing: Option<i64> = conn
        .query_row(
            "SELECT id FROM week_tasks WHERE week_key = ? AND task_no = ?",
            params![week_key, task_no],
            |r| r.get(0),
        )
        .optional()?;

    if let Some(id) = existing {
        conn.execute(
            "UPDATE week_tasks SET name = ?, link_url = ?, branch = ?, type = ?, content = ?, parent_id = ?, updated_at = ? WHERE id = ?",
            params![name, link_url, branch, type_, content, parent_id, now, id],
        )?;
        let mut stmt = conn.prepare("SELECT * FROM week_tasks WHERE id = ?")?;
        let t = stmt.query_row(params![id], row_to_task)?;
        Ok((t, false))
    } else {
        let max_order: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(sort_order), -1) FROM week_tasks WHERE week_key = ?",
                params![week_key],
                |r| r.get(0),
            )
            .unwrap_or(-1);
        let status = "dev";
        let effective_type = if type_.is_empty() { "main" } else { type_ };
        conn.execute(
            "INSERT INTO week_tasks (name, link_url, task_no, branch, status, type, parent_id, content, week_key, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                name, link_url, task_no, branch, status, effective_type, parent_id, content, week_key, max_order + 1, now, now,
            ],
        )?;
        let id = conn.last_insert_rowid();
        let mut stmt = conn.prepare("SELECT * FROM week_tasks WHERE id = ?")?;
        let t = stmt.query_row(params![id], row_to_task)?;
        Ok((t, true))
    }
}

/// 复制任务：把 from_week 中指定 ids 的任务复制到 to_week。
/// 同名/同链接/同任务号/同分支/同类型/同正文，状态重置为开发中；新 sort_order 追加到 to_week 末尾。
/// 父子关系：若父任务也在复制集中则映射到新 id，否则提升为顶层任务。
pub fn copy_week_tasks(
    pool: &DbPool,
    from_week: &str,
    to_week: &str,
    task_ids: &[i64],
) -> Result<u64, Box<dyn std::error::Error>> {
    if task_ids.is_empty() {
        return Ok(0);
    }
    let mut conn = pool.get()?;
    let now = now_str();

    // 占位符按 ids 数量生成
    let placeholders: Vec<String> = (0..task_ids.len()).map(|_| "?".to_string()).collect();
    let sql = format!(
        "SELECT * FROM week_tasks WHERE week_key = ? AND id IN ({})",
        placeholders.join(", ")
    );
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::with_capacity(task_ids.len() + 1);
    params_vec.push(Box::new(from_week.to_string()));
    for id in task_ids {
        params_vec.push(Box::new(*id));
    }
    let param_refs: Vec<&dyn rusqlite::ToSql> =
        params_vec.iter().map(|b| b.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(param_refs.as_slice(), row_to_task)?;
    let mut src: Vec<WeekTask> = rows.collect::<Result<Vec<_>, _>>()?;
    // 按旧 id 升序，保证父先于子插入
    src.sort_by_key(|t| t.id);
    drop(stmt);

    let tx = conn.transaction()?;

    // to_week 现有最大 sort_order
    let max_order: i64 = tx
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM week_tasks WHERE week_key = ?",
            params![to_week],
            |r| r.get(0),
        )
        .unwrap_or(-1);

    let mut id_map: std::collections::HashMap<i64, i64> = std::collections::HashMap::new();
    let mut next_order = max_order + 1;
    let mut copied: u64 = 0;

    for t in &src {
        // 父在复制集中 → 映射到新 id；否则提升为顶层
        let mapped_parent = t.parent_id.and_then(|pid| id_map.get(&pid).copied());
        tx.execute(
            "INSERT INTO week_tasks (name, link_url, task_no, branch, status, type, parent_id, content, week_key, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'dev', ?, ?, ?, ?, ?, ?, ?)",
            params![
                t.name,
                t.link_url,
                t.task_no,
                t.branch,
                t.r#type,
                mapped_parent,
                t.content,
                to_week,
                next_order,
                now,
                now,
            ],
        )?;
        let new_id = tx.last_insert_rowid();
        id_map.insert(t.id, new_id);
        next_order += 1;
        copied += 1;
    }

    tx.commit()?;
    Ok(copied)
}

/// 搜任务：命中 name / 任务号 / 分支 / 正文
pub fn search_tasks(pool: &DbPool, query: &str) -> Result<Vec<WeekTask>, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT * FROM week_tasks WHERE name LIKE ? OR task_no LIKE ? OR branch LIKE ? OR content LIKE ? ORDER BY updated_at DESC LIMIT 50",
    )?;
    let rows = stmt.query_map(params![&pattern, &pattern, &pattern, &pattern], row_to_task)?;
    let mut tasks = Vec::new();
    for row in rows {
        tasks.push(row?);
    }
    Ok(tasks)
}

/// 当前 ISO 周次 key
pub fn current_iso_week_key() -> String {
    let now = Local::now().date_naive();
    let iso = now.iso_week();
    format!("{}-W{:02}", iso.year(), iso.week())
}

/// 按同周任务号查任务 id（MCP parent 解析用）
pub fn find_task_id_by_no(
    pool: &DbPool,
    week_key: &str,
    task_no: &str,
) -> Result<Option<i64>, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let id: Option<i64> = conn
        .query_row(
            "SELECT id FROM week_tasks WHERE week_key = ? AND task_no = ?",
            params![week_key, task_no],
            |r| r.get(0),
        )
        .optional()?;
    Ok(id)
}

/// 最近周次：当前周（永远显示，即使无任务）+ 往回最多 4 个有任务的周次
pub fn get_recent_weeks(pool: &DbPool) -> Result<Vec<RecentWeek>, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let current = current_iso_week_key();

    // 有任务的周次（<= 当前），倒序，取够 5 个候选
    let mut stmt = conn.prepare(
        "SELECT week_key, COUNT(*) FROM week_tasks WHERE week_key <= ? GROUP BY week_key ORDER BY week_key DESC LIMIT 5",
    )?;
    let rows = stmt.query_map(params![&current], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    })?;
    let with_tasks: Vec<(String, i64)> = rows.filter_map(|r| r.ok()).collect();
    drop(stmt);

    // 往回（< 当前）有任务的前 4 个
    let mut weeks: Vec<(String, i64)> = with_tasks
        .into_iter()
        .filter(|(w, _)| w < &current)
        .take(4)
        .collect();

    // 当前周（无论有无任务）
    let cur_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM week_tasks WHERE week_key = ?",
            params![&current],
            |r| r.get(0),
        )
        .unwrap_or(0);
    weeks.push((current.clone(), cur_count));

    // 倒序
    weeks.sort_by(|a, b| b.0.cmp(&a.0));

    let result: Vec<RecentWeek> = weeks
        .into_iter()
        .map(|(week_key, count)| {
            let (start, end) = iso_week_dates(&week_key).unwrap_or_else(|| {
                let d = Local::now().date_naive();
                (d, d)
            });
            RecentWeek {
                week_key,
                count,
                start_date: start.format("%Y-%m-%d").to_string(),
                end_date: end.format("%Y-%m-%d").to_string(),
            }
        })
        .collect();
    Ok(result)
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema;
    use chrono::{Datelike, Local};
    use std::sync::atomic::{AtomicU64, Ordering};

    static SEQ: AtomicU64 = AtomicU64::new(0);

    fn tmp_pool() -> DbPool {
        let n = SEQ.fetch_add(1, Ordering::SeqCst);
        let path =
            std::env::temp_dir().join(format!("jilu_wt_test_{}_{}.db", std::process::id(), n));
        let _ = std::fs::remove_file(&path);
        let manager = SqliteConnectionManager::file(&path);
        let pool = Pool::builder().max_size(2).build(manager).unwrap();
        schema::migrate(&pool.get().unwrap()).unwrap();
        pool
    }

    fn new_task(week_key: &str, name: &str, task_no: &str) -> NewTask {
        NewTask {
            name: name.into(),
            link_url: format!("https://x/{task_no}"),
            task_no: task_no.into(),
            branch: task_no.into(),
            status: "dev".into(),
            r#type: "main".into(),
            parent_id: None,
            content: String::new(),
            week_key: week_key.into(),
            sort_order: 0,
        }
    }

    #[test]
    fn copy_week_tasks_resets_status_and_maps_parent() {
        let pool = tmp_pool();
        // 来源周：一个主任务 + 一个子任务
        let mut parent = new_task("2026-W27", "父任务", "P1");
        parent.status = "released".into();
        let p = create_task(&pool, &parent).unwrap();
        let mut child = new_task("2026-W27", "子任务", "C1");
        child.parent_id = Some(p.id);
        child.status = "testing".into();
        let c = create_task(&pool, &child).unwrap();

        // 复制两条到 W28
        let copied = copy_week_tasks(&pool, "2026-W27", "2026-W28", &[p.id, c.id]).unwrap();
        assert_eq!(copied, 2);

        let w28 = get_tasks_by_week(&pool, "2026-W28").unwrap();
        assert_eq!(w28.len(), 2);
        // 状态全部重置为 dev
        assert!(w28.iter().all(|t| t.status == "dev"));
        // 父子映射保持：子任务的 parent_id 指向新父任务 id
        let new_parent = w28.iter().find(|t| t.task_no == "P1").unwrap();
        let new_child = w28.iter().find(|t| t.task_no == "C1").unwrap();
        assert_eq!(new_child.parent_id, Some(new_parent.id));
        // 新父 id 与旧父不同
        assert_ne!(new_parent.id, p.id);
    }

    #[test]
    fn search_tasks_hits_all_fields() {
        let pool = tmp_pool();
        let mut a = new_task("2026-W27", "登录优化", "XXZX-1");
        a.content = "正文里埋个关键词 raretoken".into();
        create_task(&pool, &a).unwrap();
        let mut b = new_task("2026-W27", "其它", "ZZZ-9");
        b.branch = "feature/specialbranch".into();
        create_task(&pool, &b).unwrap();

        assert_eq!(search_tasks(&pool, "登录").unwrap().len(), 1);
        assert_eq!(search_tasks(&pool, "XXZX-1").unwrap().len(), 1);
        assert_eq!(search_tasks(&pool, "specialbranch").unwrap().len(), 1);
        assert_eq!(search_tasks(&pool, "raretoken").unwrap().len(), 1);
        assert_eq!(search_tasks(&pool, "不存在的词").unwrap().len(), 0);
    }

    #[test]
    fn recent_weeks_includes_current_and_counts() {
        let pool = tmp_pool();
        create_task(&pool, &new_task("2026-W27", "a", "T1")).unwrap();
        create_task(&pool, &new_task("2026-W27", "b", "T2")).unwrap();
        create_task(&pool, &new_task("2026-W28", "c", "T3")).unwrap();

        let weeks = get_recent_weeks(&pool).unwrap();
        // 当前周必在场
        let now = Local::now().date_naive().iso_week();
        let current = format!("{}-W{:02}", now.year(), now.week());
        assert!(weeks.iter().any(|w| w.week_key == current));
        // 插入的周计数正确
        let w27 = weeks.iter().find(|w| w.week_key == "2026-W27").unwrap();
        assert_eq!(w27.count, 2);
        let w28 = weeks.iter().find(|w| w.week_key == "2026-W28").unwrap();
        assert_eq!(w28.count, 1);
        // 日期范围非空
        assert!(!w27.start_date.is_empty());
    }
}
