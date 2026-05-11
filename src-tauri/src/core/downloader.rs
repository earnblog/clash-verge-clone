use std::path::PathBuf;
use std::fs;
use anyhow::{Result, Context};

const MIHOMO_VERSION: &str = "v1.18.8";
const MIHOMO_BASE_URL: &str = "https://github.com/MetaCubeX/mihomo/releases/download";

/// Returns the path where mihomo.exe should live.
pub fn mihomo_path() -> PathBuf {
    let dir = data_dir();
    dir.join("mihomo.exe")
}

/// App data directory: %APPDATA%\clash-verge-clone
pub fn data_dir() -> PathBuf {
    let base = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("clash-verge-clone");
    fs::create_dir_all(&dir).ok();
    dir
}

/// Returns true if mihomo.exe already exists.
pub fn mihomo_exists() -> bool {
    mihomo_path().exists()
}

/// Download mihomo Windows amd64 binary.
/// Reports progress via the provided callback (0.0 – 1.0).
pub async fn download_mihomo<F>(on_progress: F) -> Result<()>
where
    F: Fn(f64) + Send + 'static,
{
    let filename = format!("mihomo-windows-amd64-{}.zip", MIHOMO_VERSION);
    let url = format!("{}/{}/{}", MIHOMO_BASE_URL, MIHOMO_VERSION, filename);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()?;

    let resp = client.get(&url)
        .send().await
        .context("请求 mihomo 下载链接失败")?;

    let total = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut bytes_vec: Vec<u8> = Vec::with_capacity(total as usize);

    let mut stream = resp;
    use futures_util::StreamExt;
    let mut byte_stream = stream.bytes_stream();

    while let Some(chunk) = byte_stream.next().await {
        let chunk = chunk.context("下载中断")?;
        bytes_vec.extend_from_slice(&chunk);
        downloaded += chunk.len() as u64;
        if total > 0 {
            on_progress(downloaded as f64 / total as f64);
        }
    }

    // Unzip and extract mihomo.exe
    extract_mihomo_from_zip(&bytes_vec)?;
    on_progress(1.0);
    Ok(())
}

fn extract_mihomo_from_zip(data: &[u8]) -> Result<()> {
    use std::io::Cursor;
    let cursor = Cursor::new(data);
    let mut zip = zip::ZipArchive::new(cursor).context("解压失败")?;

    for i in 0..zip.len() {
        let mut file = zip.by_index(i)?;
        let name = file.name().to_string();
        if name.ends_with(".exe") || name == "mihomo" || name.contains("mihomo") {
            let dest = mihomo_path();
            let mut out = fs::File::create(&dest)
                .context("创建 mihomo.exe 失败")?;
            std::io::copy(&mut file, &mut out)?;
            // Set executable on Unix (no-op on Windows)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&dest, fs::Permissions::from_mode(0o755))?;
            }
            return Ok(());
        }
    }
    anyhow::bail!("zip 中未找到 mihomo 可执行文件")
}
