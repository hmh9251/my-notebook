pub mod models;
pub mod schema;
pub mod week_tasks;
pub mod weekly_report;
pub mod notes;
pub mod settings;
pub mod file_cache;
pub mod folders;

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::path::Path;

pub type DbPool = Pool<SqliteConnectionManager>;

/// 全局共享的应用状态
pub struct AppState {
    pub pool: DbPool,
    pub storage_dir: String,
    /// jilu.json 所在目录（dev=current_dir, release=app_config_dir）
    pub config_dir: String,
}

/// 从指定目录打开/创建 SQLite 连接池
pub fn open_pool(db_dir: &Path) -> Result<DbPool, Box<dyn std::error::Error>> {
    std::fs::create_dir_all(db_dir)?;
    let db_path = db_dir.join("jilu.db");
    let manager = SqliteConnectionManager::file(&db_path);
    let pool = Pool::builder()
        .max_size(8)
        .build(manager)?;

    // 建表 + 迁移
    let conn = pool.get()?;
    schema::migrate(&conn)?;

    log::info!("SQLite opened at {}", db_path.display());
    Ok(pool)
}
