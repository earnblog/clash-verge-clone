use anyhow::{Result, Context};

#[cfg(target_os = "windows")]
use winreg::{enums::*, RegKey};

const PROXY_KEY: &str =
    r"SOFTWARE\Microsoft\Windows\CurrentVersion\Internet Settings";

/// Enable system proxy pointing at 127.0.0.1:7890
pub fn enable(port: u16) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let key  = hkcu.open_subkey_with_flags(PROXY_KEY, KEY_SET_VALUE)
            .context("打开注册表键失败")?;
        key.set_value("ProxyEnable",  &1u32).context("写入 ProxyEnable 失败")?;
        key.set_value("ProxyServer",  &format!("127.0.0.1:{}", port))
            .context("写入 ProxyServer 失败")?;
        key.set_value("ProxyOverride",&"localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;192.168.*;<local>")
            .context("写入 ProxyOverride 失败")?;
        refresh_system_proxy();
    }
    #[cfg(not(target_os = "windows"))]
    { let _ = port; }
    Ok(())
}

/// Disable system proxy.
pub fn disable() -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let key  = hkcu.open_subkey_with_flags(PROXY_KEY, KEY_SET_VALUE)
            .context("打开注册表键失败")?;
        key.set_value("ProxyEnable", &0u32).context("写入 ProxyEnable 失败")?;
        refresh_system_proxy();
    }
    Ok(())
}

/// Notify Windows that internet settings have changed.
#[cfg(target_os = "windows")]
fn refresh_system_proxy() {
    use windows::Win32::Networking::WinInet::{
        InternetSetOptionW, INTERNET_OPTION_SETTINGS_CHANGED,
        INTERNET_OPTION_REFRESH,
    };
    unsafe {
        InternetSetOptionW(None, INTERNET_OPTION_SETTINGS_CHANGED, None, 0);
        InternetSetOptionW(None, INTERNET_OPTION_REFRESH,           None, 0);
    }
}

/// Returns whether system proxy is currently enabled.
pub fn is_enabled() -> bool {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = hkcu.open_subkey(PROXY_KEY) {
            let val: u32 = key.get_value("ProxyEnable").unwrap_or(0);
            return val == 1;
        }
    }
    false
}
