//! 代理抓取：按域名匹配凭据，容忍自签证书（模拟 Firefox 行为）。
//! - code.fastfish.com（Jira）：访问令牌 → Bearer
//! - svn.fastfish.com：用户名/密码 → Basic
//! 无匹配则匿名。

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::time::Duration;

use base64::Engine;

use crate::db::settings;
use crate::db::DbPool;

enum Auth {
    None,
    Bearer(String),
    Basic(String, String),
}

/// 按域名匹配凭据
fn auth_for(pool: &DbPool, url: &str) -> Auth {
    let lower = url.to_lowercase();
    if lower.contains("svn.fastfish.com") {
        let u = settings::get_setting(pool, "svn_user").ok().flatten();
        let p = settings::get_setting(pool, "svn_pass").ok().flatten();
        match (u, p) {
            (Some(u), Some(p)) if !u.is_empty() && !p.is_empty() => Auth::Basic(u, p),
            _ => Auth::None,
        }
    } else if lower.contains("code.fastfish.com") {
        match settings::get_setting(pool, "jira_token").ok().flatten() {
            Some(t) if !t.is_empty() => Auth::Bearer(t),
            _ => Auth::None,
        }
    } else {
        Auth::None
    }
}

/// 客户端：容忍自签证书（Firefox 同款宽容），30s 超时
fn client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("构造 HTTP 客户端失败：{e}"))
}

/// 抓取 URL 字节（带认证）
pub fn fetch_bytes(pool: &DbPool, url: &str) -> Result<Vec<u8>, String> {
    let client = client()?;
    let mut req = client.get(url);
    match auth_for(pool, url) {
        Auth::Bearer(t) => req = req.bearer_auth(t),
        Auth::Basic(u, p) => req = req.basic_auth(&u, Some(&p)),
        Auth::None => {}
    }
    let resp = req.send().map_err(|e| format!("请求失败：{e}"))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("服务器返回 {status}（多半是认证失败或链接不对）"));
    }
    let bytes = resp
        .bytes()
        .map_err(|e| format!("读取响应失败：{e}"))?
        .to_vec();
    Ok(bytes)
}

/// 由 URL 扩展名推断 MIME
pub fn mime_from_url(url: &str) -> &'static str {
    let lower = url.to_lowercase();
    let path = lower.split('?').next().unwrap_or("");
    if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "image/jpeg"
    } else if path.ends_with(".gif") {
        "image/gif"
    } else if path.ends_with(".webp") {
        "image/webp"
    } else if path.ends_with(".svg") {
        "image/svg+xml"
    } else {
        "application/octet-stream"
    }
}

/// URL 末段扩展名（不含点）
pub fn ext_from_url(url: &str) -> String {
    let path = url.split('?').next().unwrap_or(url);
    match path.rsplit('/').next().and_then(|n| n.rsplit('.').next()) {
        Some(e) if e != path => e.to_lowercase(),
        _ => String::new(),
    }
}

/// data URI（图片内嵌渲染）
pub fn fetch_data_uri(pool: &DbPool, url: &str) -> Result<String, String> {
    let bytes = fetch_bytes(pool, url)?;
    let mime = mime_from_url(url);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}

/// 抓取文件字节 → base64（前端解析 xlsx/docx 预览）
pub fn fetch_file_b64(pool: &DbPool, url: &str) -> Result<String, String> {
    let bytes = fetch_bytes(pool, url)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

/// 下载到缓存目录，返回本地路径
pub fn download_to_cache(
    pool: &DbPool,
    storage_dir: &str,
    url: &str,
) -> Result<String, String> {
    let bytes = fetch_bytes(pool, url)?;
    let mut h = DefaultHasher::new();
    url.hash(&mut h);
    let stem = format!("{:x}", h.finish());
    let ext = ext_from_url(url);
    let name = if ext.is_empty() {
        stem
    } else {
        format!("{stem}.{ext}")
    };
    let cache_dir = std::path::Path::new(storage_dir).join("cache");
    std::fs::create_dir_all(&cache_dir).map_err(|e| format!("建缓存目录失败：{e}"))?;
    let path = cache_dir.join(name);
    std::fs::write(&path, &bytes).map_err(|e| format!("写文件失败：{e}"))?;
    Ok(path.to_string_lossy().to_string())
}
