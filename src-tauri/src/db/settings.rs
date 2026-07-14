use rusqlite::params;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;

type DbPool = Pool<SqliteConnectionManager>;

/// 读取设置项；不存在返回 None
pub fn get_setting(pool: &DbPool, key: &str) -> Result<Option<String>, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?")?;
    let mut rows = stmt.query(params![key])?;
    match rows.next()? {
        Some(row) => Ok(Some(row.get(0)?)),
        None => Ok(None),
    }
}

/// 写入设置项（upsert）
pub fn set_setting(pool: &DbPool, key: &str, value: &str) -> Result<(), Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
        params![key, value, value],
    )?;
    Ok(())
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
    fn get_set_upsert() {
        let pool = tmp_pool();
        assert_eq!(get_setting(&pool, "theme_preset").unwrap(), None);
        set_setting(&pool, "theme_preset", "linearDark").unwrap();
        assert_eq!(
            get_setting(&pool, "theme_preset").unwrap(),
            Some("linearDark".into())
        );
        // upsert 覆盖
        set_setting(&pool, "theme_preset", "mintWhite").unwrap();
        assert_eq!(
            get_setting(&pool, "theme_preset").unwrap(),
            Some("mintWhite".into())
        );
    }
}
