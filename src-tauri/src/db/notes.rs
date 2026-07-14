use chrono::{Local, SecondsFormat};
use rusqlite::{params, Row};
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;

use super::models::Note;

type DbPool = Pool<SqliteConnectionManager>;

fn now_str() -> String {
    Local::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

fn row_to_note(row: &Row) -> Result<Note, rusqlite::Error> {
    Ok(Note {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        tags: row.get(3)?,
        folder_id: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

const SELECT_ALL: &str =
    "SELECT id, title, content, tags, folder_id, created_at, updated_at FROM notes";

/// 全部笔记，按更新时间倒序；filter: "all"=全部 / "folder"=某文件夹(folder_id) / "uncat"=未分类
pub fn get_notes(
    pool: &DbPool,
    filter: &str,
    folder_id: Option<i64>,
) -> Result<Vec<Note>, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let mut notes = Vec::new();
    match filter {
        "folder" => {
            let mut stmt = conn.prepare(&format!(
                "{SELECT_ALL} WHERE folder_id = ? ORDER BY updated_at DESC"
            ))?;
            let rows = stmt.query_map(params![folder_id], row_to_note)?;
            for r in rows {
                notes.push(r?);
            }
        }
        "uncat" => {
            let mut stmt = conn.prepare(&format!(
                "{SELECT_ALL} WHERE folder_id IS NULL ORDER BY updated_at DESC"
            ))?;
            let rows = stmt.query_map([], row_to_note)?;
            for r in rows {
                notes.push(r?);
            }
        }
        _ => {
            let mut stmt = conn.prepare(&format!("{SELECT_ALL} ORDER BY updated_at DESC"))?;
            let rows = stmt.query_map([], row_to_note)?;
            for r in rows {
                notes.push(r?);
            }
        }
    }
    Ok(notes)
}

pub fn get_note_by_id(pool: &DbPool, id: i64) -> Result<Option<Note>, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(&format!("{SELECT_ALL} WHERE id = ?"))?;
    let mut rows = stmt.query(params![id])?;
    match rows.next()? {
        Some(row) => Ok(Some(row_to_note(row)?)),
        None => Ok(None),
    }
}

/// 新建笔记，可选归入文件夹
pub fn create_note(
    pool: &DbPool,
    title: &str,
    folder_id: Option<i64>,
) -> Result<Note, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let now = now_str();
    conn.execute(
        "INSERT INTO notes (title, content, tags, folder_id, created_at, updated_at) VALUES (?, '', NULL, ?, ?, ?)",
        params![title, folder_id, now, now],
    )?;
    let id = conn.last_insert_rowid();
    Ok(Note {
        id,
        title: title.to_string(),
        content: String::new(),
        tags: None,
        folder_id,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// 更新笔记（title/content/tags/folder_id），刷新 updated_at
pub fn update_note(pool: &DbPool, note: &Note) -> Result<Note, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let now = now_str();
    conn.execute(
        "UPDATE notes SET title = ?, content = ?, tags = ?, folder_id = ?, updated_at = ? WHERE id = ?",
        params![note.title, note.content, note.tags, note.folder_id, now, note.id],
    )?;
    drop(conn);
    get_note_by_id(pool, note.id)?
        .ok_or_else(|| format!("note {} not found after update", note.id).into())
}

/// 移动笔记到文件夹（None = 未分类）
pub fn move_note(
    pool: &DbPool,
    id: i64,
    folder_id: Option<i64>,
) -> Result<(), Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let now = now_str();
    conn.execute(
        "UPDATE notes SET folder_id = ?, updated_at = ? WHERE id = ?",
        params![folder_id, now, id],
    )?;
    Ok(())
}

pub fn delete_note(pool: &DbPool, id: i64) -> Result<(), Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    conn.execute("DELETE FROM notes WHERE id = ?", params![id])?;
    Ok(())
}

pub fn search_notes(pool: &DbPool, query: &str) -> Result<Vec<Note>, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(&format!(
        "{SELECT_ALL} WHERE title LIKE ? OR content LIKE ? OR COALESCE(tags, '') LIKE ? ORDER BY updated_at DESC LIMIT 50"
    ))?;
    let rows = stmt.query_map(params![&pattern, &pattern, &pattern], row_to_note)?;
    let mut notes = Vec::new();
    for r in rows {
        notes.push(r?);
    }
    Ok(notes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema;
    use std::sync::atomic::{AtomicU64, Ordering};

    static SEQ: AtomicU64 = AtomicU64::new(0);

    fn tmp_pool() -> DbPool {
        let n = SEQ.fetch_add(1, Ordering::SeqCst);
        let path =
            std::env::temp_dir().join(format!("jilu_set_test_{}_{}.db", std::process::id(), n));
        let _ = std::fs::remove_file(&path);
        let manager = SqliteConnectionManager::file(&path);
        let pool = Pool::builder().max_size(2).build(manager).unwrap();
        schema::migrate(&pool.get().unwrap()).unwrap();
        pool
    }

    #[test]
    fn create_update_roundtrip() {
        let pool = tmp_pool();
        let mut note = create_note(&pool, "第一条", None).unwrap();
        assert_eq!(note.title, "第一条");
        assert!(note.folder_id.is_none());

        note.content = "# Hello\n\nworld".into();
        note.tags = Some("rust, 笔记".into());
        let updated = update_note(&pool, &note).unwrap();
        assert_eq!(updated.content, "# Hello\n\nworld");
        assert_eq!(updated.tags.as_deref(), Some("rust, 笔记"));

        let fetched = get_note_by_id(&pool, note.id).unwrap().unwrap();
        assert_eq!(fetched.title, "第一条");
    }

    #[test]
    fn move_to_folder() {
        let pool = tmp_pool();
        let n = create_note(&pool, "n1", None).unwrap();
        move_note(&pool, n.id, Some(5)).unwrap();
        let fetched = get_note_by_id(&pool, n.id).unwrap().unwrap();
        assert_eq!(fetched.folder_id, Some(5));
        // uncat 过滤能查到 folder_id IS NULL 的
        let in_uncat = get_notes(&pool, "uncat", None).unwrap();
        assert!(in_uncat.iter().all(|x| x.folder_id.is_none()));
    }
}
