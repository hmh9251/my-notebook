use base64::Engine;
use rusqlite::params;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use super::models::{CachedFile, CachedFileWithBytes};
use crate::proxy;

type DbPool = Pool<SqliteConnectionManager>;

fn now_str() -> String {
    chrono::Local::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn decode_name(url: &str) -> String {
    let last = url.split('?').next().unwrap_or(url).rsplit('/').next().unwrap_or(url);
    match percent_decode_rs(last) {
        Some(n) => n,
        None => last.to_string(),
    }
}

/// 简易 percent-decode（避免再引 crate）
fn percent_decode_rs(s: &str) -> Option<String> {
    if !s.contains('%') {
        return None;
    }
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    let mut found = false;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                out.push((h << 4) | l);
                i += 3;
                found = true;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    if !found {
        return None;
    }
    String::from_utf8(out).ok()
}

fn hex(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

/// 缓存并返回 b64：命中则读盘，未命中则下载+落盘+写清单
pub fn cache_file(
    pool: &DbPool,
    storage_dir: &str,
    url: &str,
) -> Result<CachedFileWithBytes, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    // 命中？
    let cached: Option<(String, String, String)> = conn
        .query_row(
            "SELECT path, ext, name FROM file_cache WHERE url = ?",
            params![url],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?)),
        )
        .ok();
    drop(conn);

    if let Some((path, ext, name)) = cached {
        if std::path::Path::new(&path).exists() {
            let bytes = std::fs::read(&path)?;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            return Ok(CachedFileWithBytes { url: url.to_string(), name, ext, b64 });
        }
        // 文件丢了，删清单重下
        let conn = pool.get()?;
        conn.execute("DELETE FROM file_cache WHERE url = ?", params![url])?;
    }

    // 下载
    let bytes = proxy::fetch_bytes(pool, url)?;
    let ext = proxy::ext_from_url(url);
    let name = decode_name(url);
    let mut h = DefaultHasher::new();
    url.hash(&mut h);
    let stem = format!("{:x}", h.finish());
    let fname = if ext.is_empty() { stem } else { format!("{stem}.{ext}") };
    let cache_dir = std::path::Path::new(storage_dir).join("cache");
    std::fs::create_dir_all(&cache_dir)?;
    let path = cache_dir.join(fname);
    std::fs::write(&path, &bytes)?;
    let now = now_str();
    let size = bytes.len() as i64;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO file_cache (url, name, path, ext, size, created_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(url) DO UPDATE SET name=excluded.name, path=excluded.path, ext=excluded.ext, size=excluded.size, created_at=excluded.created_at",
        params![url, &name, path.to_string_lossy(), &ext, size, &now],
    )?;

    Ok(CachedFileWithBytes { url: url.to_string(), name, ext, b64 })
}

/// 列出全部缓存（按时间倒序）
pub fn list_cached_files(pool: &DbPool) -> Result<Vec<CachedFile>, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT url, name, path, ext, size, created_at FROM file_cache ORDER BY created_at DESC LIMIT 30",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(CachedFile {
            url: r.get(0)?,
            name: r.get(1)?,
            path: r.get(2)?,
            ext: r.get(3)?,
            size: r.get(4)?,
            created_at: r.get(5)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// 删除一条缓存（清单 + 磁盘文件）
pub fn delete_cached_file(pool: &DbPool, url: &str) -> Result<(), Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let path: Option<String> = conn
        .query_row(
            "SELECT path FROM file_cache WHERE url = ?",
            params![url],
            |r| r.get(0),
        )
        .ok();
    conn.execute("DELETE FROM file_cache WHERE url = ?", params![url])?;
    drop(conn);
    if let Some(p) = path {
        let _ = std::fs::remove_file(p);
    }
    Ok(())
}

/// 清空全部预览缓存（清单 + 磁盘文件）
pub fn clear_all(pool: &DbPool) -> Result<u64, Box<dyn std::error::Error>> {
    let conn = pool.get()?;
    let paths: Vec<String> = {
        let mut stmt = conn.prepare("SELECT path FROM file_cache")?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        let mut v = Vec::new();
        for r in rows {
            v.push(r?);
        }
        v
    };
    let n = conn.execute("DELETE FROM file_cache", [])?;
    drop(conn);
    for p in paths {
        let _ = std::fs::remove_file(p);
    }
    Ok(n as u64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema;
    use r2d2::Pool;
    use r2d2_sqlite::SqliteConnectionManager;
    use std::sync::atomic::{AtomicU64, Ordering};
    static SEQ: AtomicU64 = AtomicU64::new(0);

    fn tmp_pool() -> DbPool {
        let n = SEQ.fetch_add(1, Ordering::SeqCst);
        let path = std::env::temp_dir().join(format!("jilu_fc_{}_{}.db", std::process::id(), n));
        let _ = std::fs::remove_file(&path);
        let manager = SqliteConnectionManager::file(&path);
        let pool = Pool::builder().max_size(2).build(manager).unwrap();
        schema::migrate(&pool.get().unwrap()).unwrap();
        pool
    }

    #[test]
    fn list_and_delete_cache() {
        let pool = tmp_pool();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO file_cache (url, name, path, ext, size, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            params!["u1", "a.xlsx", "/tmp/a.xlsx", "xlsx", 10, "2026-07-11"],
        ).unwrap();
        drop(conn);

        let list = list_cached_files(&pool).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "a.xlsx");

        delete_cached_file(&pool, "u1").unwrap();
        assert!(list_cached_files(&pool).unwrap().is_empty());
    }

    #[test]
    fn decode_name_percent() {
        assert_eq!(decode_name("https://x/PRD-%E6%A0%B8%E4%BB%B7.docx"), "PRD-核价.docx");
        assert_eq!(decode_name("https://x/SCM.xlsx"), "SCM.xlsx");
    }
}
