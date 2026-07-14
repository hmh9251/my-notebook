use chrono::{Local, SecondsFormat};
use rusqlite::params;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;

use super::models::Folder;

type DbPool = Pool<SqliteConnectionManager>;

fn now_str() -> String {
    Local::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

/// 列出全部文件夹（含笔记计数）
pub fn list_folders(pool: &DbPool) -> Result<Vec<Folder>, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT f.id, f.name, COUNT(n.id) FROM folders f
         LEFT JOIN notes n ON n.folder_id = f.id
         GROUP BY f.id ORDER BY f.id ASC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Folder {
            id: r.get(0)?,
            name: r.get::<_, String>(1)?,
            count: r.get(2)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// 未分类笔记数
pub fn uncat_count(pool: &DbPool) -> Result<i64, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notes WHERE folder_id IS NULL",
        [],
        |r| r.get(0),
    )?;
    Ok(n)
}

pub fn create_folder(pool: &DbPool, name: &str) -> Result<i64, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let now = now_str();
    conn.execute(
        "INSERT INTO folders (name, created_at) VALUES (?, ?)",
        params![name.trim(), now],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn rename_folder(
    pool: &DbPool,
    id: i64,
    name: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    conn.execute(
        "UPDATE folders SET name = ? WHERE id = ?",
        params![name.trim(), id],
    )?;
    Ok(())
}

/// 删除文件夹：其下笔记归为未分类（folder_id=NULL），再删文件夹行
pub fn delete_folder(pool: &DbPool, id: i64) -> Result<(), Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    conn.execute("UPDATE notes SET folder_id = NULL WHERE folder_id = ?", params![id])?;
    conn.execute("DELETE FROM folders WHERE id = ?", params![id])?;
    Ok(())
}
