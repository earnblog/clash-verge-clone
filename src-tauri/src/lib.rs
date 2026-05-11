mod core;
mod sysproxy;
mod commands;

use tauri::{Manager, Emitter};
use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_decorations(false).ok();

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;
                let has_kernel = core::downloader::mihomo_exists();
                app_handle.emit("kernel-status", has_kernel).ok();
                if has_kernel {
                    if let Err(e) = core::runner::start_mihomo() {
                        app_handle.emit("core-error", e.to_string()).ok();
                    } else {
                        app_handle.emit("core-started", true).ok();
                        let ah2 = app_handle.clone();
                        tauri::async_runtime::spawn(async move {
                            poll_traffic(ah2).await;
                        });
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                core::runner::stop_mihomo().ok();
                sysproxy::disable().ok();
            }
        })
        .invoke_handler(tauri::generate_handler![
            check_kernel,
            download_kernel,
            start_core,
            stop_core,
            core_running,
            enable_system_proxy,
            disable_system_proxy,
            get_system_proxy_status,
            get_traffic,
            get_connections,
            close_all_connections,
            get_proxies,
            select_proxy,
            test_delay,
            set_proxy_mode,
            get_config_path,
            write_config,
            read_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn poll_traffic(app: tauri::AppHandle) {
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        if !core::runner::is_running() { break; }
        if let Ok(t) = core::api::get_traffic().await {
            app.emit("traffic-update", serde_json::json!({
                "up": t.up, "down": t.down
            })).ok();
        }
    }
}
