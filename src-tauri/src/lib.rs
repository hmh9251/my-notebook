pub mod commands;
pub mod config;
pub mod db;
pub mod jira;
pub mod link_parser;
pub mod proxy;
pub mod tray;

use std::path::PathBuf;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // config_base：dev=current_dir，release=app_config_dir（appSupportDir）
            let (config_base, webview_data_dir) = if cfg!(debug_assertions) {
                let base = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
                (base.clone(), base.join("data").join("webview2"))
            } else {
                let app_config_dir = app
                    .path()
                    .app_config_dir()
                    .expect("failed to get app config dir");
                (app_config_dir.clone(), app_config_dir.join("webview2"))
            };
            std::fs::create_dir_all(&config_base).ok();

            // 存储目录：读 config_base/jilu.json，无则 default（dev=data/，release=app_config_dir）
            let default_storage = if cfg!(debug_assertions) {
                config_base.join("data")
            } else {
                config_base.clone()
            };
            let storage_dir = config::resolve_storage_dir(&config_base, &default_storage);
            std::fs::create_dir_all(&storage_dir).ok();

            // 日志（开发模式用 Stdout，避免 AppData 沙箱限制）
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .clear_targets()
                        .target(tauri_plugin_log::Target::new(
                            tauri_plugin_log::TargetKind::Stdout,
                        ))
                        .build(),
                )?;
            }

            // 打开 SQLite 连接池
            let pool = db::open_pool(&storage_dir).map_err(|e| {
                log::error!("Failed to open database: {}", e);
                e
            })?;
            // 管理 AppState（pool + storage_dir + config_dir）为 Tauri State
            app.manage(db::AppState {
                pool,
                storage_dir: storage_dir.to_string_lossy().to_string(),
                config_dir: config_base.to_string_lossy().to_string(),
            });

            // 创建无框窗口（指定 WebView2 数据目录，避免 AppData 沙箱限制）
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("记录 — 本地笔记工具")
                .inner_size(1200.0, 800.0)
                .min_inner_size(800.0, 600.0)
                .decorations(false)
                .center()
                .data_directory(webview_data_dir)
                .build()?;

            // 系统托盘（关窗隐藏到托盘）
            if let Err(e) = tray::build_tray(app.handle()) {
                log::warn!("Failed to build tray: {}", e);
            }

            log::info!("jilu started, DB at {}/jilu.db", storage_dir.display());

            Ok(())
        })
        .on_window_event(|window, event| {
            // 关窗拦截：隐藏到托盘，不退出进程
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_storage_path,
            commands::log_frontend,
            commands::db_health,
            commands::get_setting,
            commands::set_setting,
            commands::open_in_explorer,
            commands::change_storage_path,
            commands::proxy_image,
            commands::download_to_cache,
            commands::cache_file,
            commands::list_cached_files,
            commands::delete_cached_file,
            commands::clear_file_cache,
            commands::delete_old_tasks,
            commands::fetch_jira_issue,
            commands::upsert_task,
            commands::get_tasks_by_week,
            commands::get_all_week_keys,
            commands::get_task_by_id,
            commands::get_task_children,
            commands::get_week_task_children,
            commands::reorder_tasks,
            commands::copy_week_tasks,
            commands::search_tasks,
            commands::get_recent_weeks,
            commands::search,
            commands::create_task,
            commands::update_task,
            commands::update_task_status,
            commands::update_task_sort_order,
            commands::delete_task,
            commands::generate_weekly_report,
            commands::get_notes,
            commands::get_note_by_id,
            commands::create_note,
            commands::update_note,
            commands::move_note,
            commands::delete_note,
            commands::get_folders,
            commands::get_uncat_count,
            commands::create_folder,
            commands::rename_folder,
            commands::delete_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running jilu");
}
