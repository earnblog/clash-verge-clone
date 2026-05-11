use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};

const BASE: &str = "http://127.0.0.1:9090";

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap()
}

// ── Traffic ───────────────────────────────────────────────────────
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Traffic {
    pub up:   u64,
    pub down: u64,
}

pub async fn get_traffic() -> Result<Traffic> {
    let url = format!("{}/traffic", BASE);
    // mihomo exposes traffic as a streaming endpoint;
    // we call /memory for a quick snapshot instead.
    let url_snap = format!("{}/memory", BASE);
    let r = client().get(&url_snap).send().await
        .context("无法连接到 mihomo API")?;
    // Fallback: just return zeros if endpoint not ready
    if !r.status().is_success() {
        return Ok(Traffic { up: 0, down: 0 });
    }
    // mihomo /memory returns { inuse, oslimit }
    // We use /connections for actual traffic counters
    get_traffic_from_connections().await
}

async fn get_traffic_from_connections() -> Result<Traffic> {
    #[derive(Deserialize)]
    struct ConnResp {
        #[serde(rename = "downloadTotal")]
        download_total: Option<u64>,
        #[serde(rename = "uploadTotal")]
        upload_total:   Option<u64>,
    }
    let url = format!("{}/connections", BASE);
    let resp: ConnResp = client().get(&url).send().await
        .context("获取连接数据失败")?
        .json().await
        .context("解析连接数据失败")?;
    Ok(Traffic {
        up:   resp.upload_total.unwrap_or(0),
        down: resp.download_total.unwrap_or(0),
    })
}

// ── Connections ───────────────────────────────────────────────────
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Connection {
    pub id:       String,
    pub metadata: ConnMetadata,
    pub upload:   u64,
    pub download: u64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ConnMetadata {
    pub host:        Option<String>,
    pub network:     Option<String>,
    #[serde(rename = "destinationPort")]
    pub dst_port:    Option<String>,
    #[serde(rename = "sourcePort")]
    pub src_port:    Option<String>,
}

#[derive(Debug, Deserialize)]
struct ConnectionsResp {
    connections: Option<Vec<Connection>>,
}

pub async fn get_connections() -> Result<Vec<Connection>> {
    let url = format!("{}/connections", BASE);
    let resp: ConnectionsResp = client().get(&url).send().await
        .context("获取连接列表失败")?
        .json().await
        .context("解析连接列表失败")?;
    Ok(resp.connections.unwrap_or_default())
}

pub async fn close_all_connections() -> Result<()> {
    let url = format!("{}/connections", BASE);
    client().delete(&url).send().await
        .context("关闭连接失败")?;
    Ok(())
}

// ── Proxies ───────────────────────────────────────────────────────
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ProxyGroup {
    pub name:    String,
    #[serde(rename = "type")]
    pub kind:    String,
    pub now:     Option<String>,
    pub all:     Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct ProxiesResp {
    proxies: std::collections::HashMap<String, ProxyGroup>,
}

pub async fn get_proxies() -> Result<Vec<ProxyGroup>> {
    let url = format!("{}/proxies", BASE);
    let resp: ProxiesResp = client().get(&url).send().await
        .context("获取代理列表失败")?
        .json().await
        .context("解析代理列表失败")?;
    let mut groups: Vec<ProxyGroup> = resp.proxies.into_values().collect();
    groups.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(groups)
}

/// Switch selected proxy in a group.
pub async fn select_proxy(group: &str, proxy: &str) -> Result<()> {
    #[derive(Serialize)]
    struct Body<'a> { name: &'a str }
    let url = format!("{}/proxies/{}", BASE, urlencoding::encode(group));
    client().put(&url)
        .json(&Body { name: proxy })
        .send().await
        .context("切换代理失败")?;
    Ok(())
}

/// Test delay for a single proxy.
pub async fn test_delay(proxy: &str, test_url: &str) -> Result<u64> {
    #[derive(Deserialize)]
    struct DelayResp { delay: u64 }
    let url = format!(
        "{}/proxies/{}/delay?url={}&timeout=5000",
        BASE,
        urlencoding::encode(proxy),
        urlencoding::encode(test_url),
    );
    let resp: DelayResp = client().get(&url).send().await
        .context("延迟测试请求失败")?
        .json().await
        .context("解析延迟失败")?;
    Ok(resp.delay)
}

// ── Config / Mode ─────────────────────────────────────────────────
#[derive(Serialize)]
struct PatchConfig {
    mode: String,
}

pub async fn set_mode(mode: &str) -> Result<()> {
    let url = format!("{}/configs", BASE);
    client().patch(&url)
        .json(&PatchConfig { mode: mode.to_string() })
        .send().await
        .context("设置模式失败")?;
    Ok(())
}

// ── Logs (SSE) ────────────────────────────────────────────────────
/// Read a single log line from mihomo's log SSE stream.
/// In production you'd spawn a background task streaming this.
pub async fn read_log_line() -> Result<String> {
    // Placeholder — real impl uses EventSource / reqwest streaming
    Ok(String::new())
}
