use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use anyhow::{Result, Context};

use super::downloader::{mihomo_path, data_dir};

/// Global mihomo child process handle.
static MIHOMO_PROC: std::sync::OnceLock<Arc<Mutex<Option<Child>>>> =
    std::sync::OnceLock::new();

fn proc_lock() -> &'static Arc<Mutex<Option<Child>>> {
    MIHOMO_PROC.get_or_init(|| Arc::new(Mutex::new(None)))
}

/// Returns the path to the generated config file.
pub fn config_path() -> PathBuf {
    data_dir().join("config.yaml")
}

/// Write a minimal default config so mihomo can start.
pub fn ensure_default_config() -> Result<()> {
    let path = config_path();
    if path.exists() { return Ok(()); }

    let config = r#"mixed-port: 7890
allow-lan: false
bind-address: '*'
mode: rule
log-level: info
external-controller: 127.0.0.1:9090
secret: ""

dns:
  enable: true
  nameserver:
    - 8.8.8.8
    - 114.114.114.114

proxies: []

proxy-groups: []

rules:
  - MATCH,DIRECT
"#;
    std::fs::write(&path, config).context("写入默认配置失败")?;
    Ok(())
}

/// Start mihomo with the given config file.
pub fn start_mihomo() -> Result<()> {
    let exe  = mihomo_path();
    let conf = config_path();

    if !exe.exists() {
        anyhow::bail!("mihomo.exe 不存在，请先下载内核");
    }
    ensure_default_config()?;

    let mut lock = proc_lock().lock().unwrap();
    if lock.is_some() {
        return Ok(()); // already running
    }

    let child = Command::new(&exe)
        .arg("-f")
        .arg(&conf)
        .arg("-d")
        .arg(data_dir())
        .spawn()
        .context("启动 mihomo 失败")?;

    *lock = Some(child);
    Ok(())
}

/// Stop mihomo process.
pub fn stop_mihomo() -> Result<()> {
    let mut lock = proc_lock().lock().unwrap();
    if let Some(mut child) = lock.take() {
        child.kill().ok();
        child.wait().ok();
    }
    Ok(())
}

/// Returns true if mihomo is currently running.
pub fn is_running() -> bool {
    let mut lock = proc_lock().lock().unwrap();
    if let Some(child) = lock.as_mut() {
        // try_wait returns Ok(None) if still running
        match child.try_wait() {
            Ok(None) => true,
            _ => {
                *lock = None;
                false
            }
        }
    } else {
        false
    }
}
