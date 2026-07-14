use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct JiluConfig {
    pub storage_path: Option<String>,
}

/// 读取 jilu.json 配置文件
/// 如果不存在，返回默认配置（storage_path = None → 使用 app_config_dir）
fn read_config(config_dir: &Path) -> JiluConfig {
    let config_file = config_dir.join("jilu.json");
    match std::fs::read_to_string(&config_file) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => JiluConfig::default(),
    }
}

/// 获取 DB 存储目录
/// 1. 读 app_config_dir/jilu.json
/// 2. 如果有 storagePath → 用它
/// 3. 否则用 app_config_dir 本身
pub fn get_storage_dir(app_config_dir: &Path) -> PathBuf {
    let config = read_config(app_config_dir);
    match config.storage_path {
        Some(ref p) if !p.is_empty() => PathBuf::from(p),
        _ => app_config_dir.to_path_buf(),
    }
}

/// 解析实际存储目录：读 config_base/jilu.json 的 storage_path，无则用 default。
/// config_base 在 dev = current_dir，release = app_config_dir。
pub fn resolve_storage_dir(config_base: &Path, default: &Path) -> PathBuf {
    let config = read_config(config_base);
    match config.storage_path.as_ref().filter(|s| !s.is_empty()) {
        Some(p) => PathBuf::from(p),
        None => default.to_path_buf(),
    }
}

/// 写入新的存储路径到 jilu.json
pub fn set_storage_dir(app_config_dir: &Path, new_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let config = JiluConfig {
        storage_path: Some(new_dir.to_string_lossy().to_string()),
    };
    let config_file = app_config_dir.join("jilu.json");
    std::fs::create_dir_all(app_config_dir)?;
    let json = serde_json::to_string_pretty(&config)?;
    std::fs::write(&config_file, json)?;
    log::info!("Storage path updated: {}", new_dir.display());
    Ok(())
}
