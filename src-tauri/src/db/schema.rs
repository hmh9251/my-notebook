use chrono::{Datelike, NaiveDate};
use rusqlite::Connection;

/// 把旧的日期范围串（如 `2026-7-6-7-12`）转成 ISO 周次（如 `2026-W27`）。
/// 已是 ISO 周次或无法解析时返回 None。
fn to_iso_week_key(week_key: &str) -> Option<String> {
    // 已是 ISO 周次：YYYY-Www
    let bytes = week_key.as_bytes();
    if bytes.len() >= 8 && bytes[5] == b'W' {
        return None;
    }
    let parts: Vec<i64> = week_key.split('-').filter_map(|p| p.parse().ok()).collect();
    if parts.len() < 3 {
        return None;
    }
    let (y, m, d) = (parts[0] as i32, parts[1] as u32, parts[2] as u32);
    let date = NaiveDate::from_ymd_opt(y, m, d)?;
    let iso = date.iso_week();
    Some(format!("{}-W{:02}", iso.year(), iso.week()))
}

/// 把 DB 里残留的日期范围型 week_key 迁成 ISO 周次
fn migrate_week_keys(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    let mut stmt = conn.prepare("SELECT id, week_key FROM week_tasks")?;
    let rows: Vec<(i64, String)> = stmt
        .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);
    for (id, week_key) in rows {
        if let Some(iso) = to_iso_week_key(&week_key) {
            conn.execute(
                "UPDATE week_tasks SET week_key = ? WHERE id = ?",
                rusqlite::params![iso, id],
            )?;
        }
    }
    Ok(())
}

/// 建表 + 迁移
pub fn migrate(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    // week_tasks
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS week_tasks (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT    NOT NULL,
            link_url      TEXT    NOT NULL,
            task_no       TEXT    NOT NULL,
            branch        TEXT    NOT NULL,
            status        TEXT    NOT NULL DEFAULT 'dev',
            type          TEXT    NOT NULL DEFAULT 'main',
            parent_id     INTEGER,
            content       TEXT    NOT NULL DEFAULT '',
            week_key      TEXT    NOT NULL,
            sort_order    INTEGER NOT NULL DEFAULT 0,
            created_at    TEXT    NOT NULL,
            updated_at    TEXT    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_week_tasks_week ON week_tasks(week_key);
        CREATE INDEX IF NOT EXISTS idx_week_tasks_parent ON week_tasks(parent_id);",
    )?;

    // v2 迁移：旧库可能缺少 content / type / parent_id 列
    let cols = table_columns(conn, "week_tasks")?;
    if !cols.contains(&"content".to_string()) {
        conn.execute("ALTER TABLE week_tasks ADD COLUMN content TEXT NOT NULL DEFAULT ''", [])?;
    }
    if !cols.contains(&"type".to_string()) {
        conn.execute("ALTER TABLE week_tasks ADD COLUMN type TEXT NOT NULL DEFAULT 'main'", [])?;
    }
    if !cols.contains(&"parent_id".to_string()) {
        conn.execute("ALTER TABLE week_tasks ADD COLUMN parent_id INTEGER", [])?;
    }
    // 确保索引存在（迁移后补建）
    conn.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_week_tasks_week ON week_tasks(week_key);
         CREATE INDEX IF NOT EXISTS idx_week_tasks_parent ON week_tasks(parent_id);",
    )?;

    // notes
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS notes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT    NOT NULL,
            content     TEXT    NOT NULL,
            tags        TEXT,
            created_at  TEXT    NOT NULL,
            updated_at  TEXT    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);",
    )?;

    // settings
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT
        );",
    )?;

    // folders：笔记文件夹
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS folders (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL UNIQUE,
            created_at  TEXT    NOT NULL
        );",
    )?;
    // notes.folder_id（旧库可能没有）
    let n_cols = table_columns(conn, "notes")?;
    if !n_cols.contains(&"folder_id".to_string()) {
        conn.execute("ALTER TABLE notes ADD COLUMN folder_id INTEGER", [])?;
    }

    // file_cache：预览过的文件缓存清单（url 为主键）
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS file_cache (
            url         TEXT PRIMARY KEY,
            name        TEXT    NOT NULL,
            path        TEXT    NOT NULL,
            ext         TEXT    NOT NULL,
            size        INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT    NOT NULL
        );",
    )?;

    // v3 迁移：把日期范围型 week_key 统一成 ISO 周次（YYYY-Www）
    migrate_week_keys(conn)?;

    Ok(())
}

/// 查询表的列名
fn table_columns(conn: &Connection, table: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let rows = stmt.query_map([], |row| {
        let name: String = row.get(1)?;
        Ok(name)
    })?;
    let mut cols = Vec::new();
    for row in rows {
        cols.push(row?);
    }
    Ok(cols)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iso_week_known_values() {
        // 2026-01-01 是周四 → 属于 2026-W01
        assert_eq!(to_iso_week_key("2026-1-1-1-4").as_deref(), Some("2026-W01"));
        // 2026-01-05（周一）→ W02
        assert_eq!(to_iso_week_key("2026-1-5-1-11").as_deref(), Some("2026-W02"));
        // 2026-07-06（周一）→ W28
        assert_eq!(to_iso_week_key("2026-7-6-7-12").as_deref(), Some("2026-W28"));
        // 跨年：2025-12-29（周一）属 2026-W01
        assert_eq!(to_iso_week_key("2025-12-29-2026-1-4").as_deref(), Some("2026-W01"));
    }

    #[test]
    fn already_iso_is_none() {
        assert_eq!(to_iso_week_key("2026-W27"), None);
        assert_eq!(to_iso_week_key("2026-W01"), None);
    }

    #[test]
    fn garbage_is_none() {
        assert_eq!(to_iso_week_key(""), None);
        assert_eq!(to_iso_week_key("abc"), None);
    }
}
