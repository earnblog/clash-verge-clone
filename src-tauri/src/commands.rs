use tauri::{AppHandle, Emitter};
use serde::{Deserialize, Serialize};

use crate::core::{downloader, runner, api};
use crate::sysproxy;

// ── Download kernel ───────────────────────────────────────────────
#[tauri::command]
pub async fn check_kernel() -> Result<bool, String> {
    Ok(downloader::mihomo_exists())
}

#[tauri::command]
pub async fn download_kernel(app: AppHandle) -> Result<(), String> {
    let app2 = app.clone();
    downloader::download_mihomo(move |progress| {
        app2.emit("kernel-download-progress", progress).ok();
    })
    .await
    .map_err(|e| e.to_string())
}

// ── Core process ─────────────────────────────────────────────────
#[tauri::command]
pub async fn start_core() -> Result<(), String> {
    runner::start_mihomo().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_core() -> Result<(), String> {
    runner::stop_mihomo().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn core_running() -> bool {
    runner::is_running()
}

// ── System proxy ──────────────────────────────────────────────────
#[tauri::command]
pub fn enable_system_proxy(port: u16) -> Result<(), String> {
    sysproxy::enable(port).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn disable_system_proxy() -> Result<(), String> {
    sysproxy::disable().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_system_proxy_status() -> bool {
    sysproxy::is_enabled()
}

// ── Traffic ───────────────────────────────────────────────────────
#[derive(Serialize)]
pub struct TrafficData {
    pub up:   u64,
    pub down: u64,
}

#[tauri::command]
pub async fn get_traffic() -> Result<TrafficData, String> {
    let t = api::get_traffic().await.map_err(|e| e.to_string())?;
    Ok(TrafficData { up: t.up, down: t.down })
}

// ── Connections ───────────────────────────────────────────────────
#[tauri::command]
pub async fn get_connections() -> Result<Vec<api::Connection>, String> {
    api::get_connections().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_all_connections() -> Result<(), String> {
    api::close_all_connections().await.map_err(|e| e.to_string())
}

// ── Proxies ───────────────────────────────────────────────────────
#[tauri::command]
pub async fn get_proxies() -> Result<Vec<api::ProxyGroup>, String> {
    api::get_proxies().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn select_proxy(group: String, proxy: String) -> Result<(), String> {
    api::select_proxy(&group, &proxy).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_delay(proxy: String) -> Result<u64, String> {
    api::test_delay(&proxy, "https://www.gstatic.com/generate_204")
        .await
        .map_err(|e| e.to_string())
}

// ── Mode ──────────────────────────────────────────────────────────
#[tauri::command]
pub async fn set_proxy_mode(mode: String) -> Result<(), String> {
    api::set_mode(&mode).await.map_err(|e| e.to_string())
}

// ── Config path ───────────────────────────────────────────────────
#[tauri::command]
pub fn get_config_path() -> String {
    runner::config_path().to_string_lossy().to_string()
}

#[tauri::command]
pub fn write_config(content: String) -> Result<(), String> {
    std::fs::write(runner::config_path(), content)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_config() -> Result<String, String> {
    std::fs::read_to_string(runner::config_path())
        .map_err(|e| e.to_string())
}
