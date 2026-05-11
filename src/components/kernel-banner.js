import { invoke, listen } from '../utils/bridge.js'
import { store }           from '../store.js'

// ── Kernel status banner ─────────────────────────────────────────
// Shows a download prompt if mihomo is not installed,
// or a "starting…" indicator while the core boots.

export async function initKernelBanner() {
  const banner = document.getElementById('kernel-banner')
  if (!banner) return

  // Listen for events from Rust
  await listen('kernel-status',  onKernelStatus)
  await listen('core-started',   onCoreStarted)
  await listen('core-error',     onCoreError)
  await listen('kernel-download-progress', onDownloadProgress)
  await listen('traffic-update', onTrafficUpdate)

  // Check immediately
  try {
    const has = await invoke('check_kernel')
    onKernelStatus(has)
  } catch {
    banner.style.display = 'none'
  }
}

function onKernelStatus(hasKernel) {
  const banner = document.getElementById('kernel-banner')
  if (!banner) return

  if (hasKernel) {
    showBanner('info', '内核已就绪，正在启动…', null)
  } else {
    showBanner('warn',
      '未检测到 mihomo 内核',
      { label: '立即下载', action: downloadKernel }
    )
  }
}

function onCoreStarted() {
  hideBanner()
  store.set('coreRunning', true)
  syncCoreUI(true)
  addLog('INF', 'mihomo 核心已启动 (127.0.0.1:7890)')

  // Fetch real proxy groups
  refreshProxies()
}

function onCoreError(msg) {
  showBanner('error', '核心启动失败：' + msg, {
    label: '重试', action: async () => {
      await invoke('start_core')
    }
  })
  addLog('ERR', '核心启动失败：' + msg)
}

let _lastUp = 0, _lastDn = 0
function onTrafficUpdate(data) {
  // data = { up: totalBytes, down: totalBytes }
  const upSpeed = Math.max(0, data.up   - _lastUp)
  const dnSpeed = Math.max(0, data.down - _lastDn)
  _lastUp = data.up
  _lastDn = data.down

  const fmt = b => b < 1024 * 1024
    ? Math.round(b / 1024) + ' KB/s'
    : (b / 1024 / 1024).toFixed(1) + ' MB/s'

  const upEl = document.getElementById('up-speed')
  const dnEl = document.getElementById('dn-speed')
  const chartUp = document.getElementById('chart-up-val')
  const chartDn = document.getElementById('chart-dn-val')
  if (upEl) upEl.innerHTML = fmt(upSpeed)
  if (dnEl) dnEl.innerHTML = fmt(dnSpeed)
  if (chartUp) chartUp.textContent = fmt(upSpeed)
  if (chartDn) chartDn.textContent = fmt(dnSpeed)

  // Push to chart history
  store.upHistory.push(upSpeed); store.upHistory.shift()
  store.dnHistory.push(dnSpeed); store.dnHistory.shift()
}

async function downloadKernel() {
  showBanner('progress', '正在下载 mihomo 内核…', null, 0)
  try {
    await invoke('download_kernel')
    showBanner('info', '下载完成，正在启动…', null)
    await invoke('start_core')
  } catch (e) {
    showBanner('error', '下载失败：' + e, { label: '重试', action: downloadKernel })
  }
}

function onDownloadProgress(p) {
  const pct = Math.round(p * 100)
  const bar = document.getElementById('banner-progress-bar')
  const lbl = document.getElementById('banner-msg')
  if (bar) bar.style.width = pct + '%'
  if (lbl) lbl.textContent = `正在下载 mihomo 内核… ${pct}%`
}

// ── UI helpers ────────────────────────────────────────────────────
function showBanner(type, msg, btn, progress) {
  const banner = document.getElementById('kernel-banner')
  if (!banner) return
  const colors = { info: 'var(--accent)', warn: 'var(--amber)', error: 'var(--red)', progress: 'var(--accent)' }
  const color  = colors[type] || 'var(--accent)'

  banner.style.display = 'flex'
  banner.innerHTML = `
    <i class="ti ti-${type === 'error' ? 'alert-circle' : type === 'warn' ? 'alert-triangle' : 'info-circle'}"
       style="font-size:16px;color:${color};flex-shrink:0"></i>
    <span id="banner-msg" style="flex:1;font-size:12px;color:var(--text2)">${msg}</span>
    ${progress !== undefined ? `
      <div style="width:140px;height:4px;background:var(--bg4);border-radius:2px;flex-shrink:0">
        <div id="banner-progress-bar" style="height:4px;background:${color};border-radius:2px;width:${progress}%;transition:width .3s"></div>
      </div>` : ''}
    ${btn ? `<button class="banner-btn" id="banner-action" style="font-size:12px;padding:4px 12px;border-radius:6px;border:0.5px solid ${color};color:${color};background:transparent;cursor:pointer">${btn.label}</button>` : ''}
  `
  if (btn) {
    document.getElementById('banner-action').addEventListener('click', btn.action)
  }
}

function hideBanner() {
  const b = document.getElementById('kernel-banner')
  if (b) b.style.display = 'none'
}

// ── Sync titlebar sys-proxy dot ──────────────────────────────────
function syncCoreUI(running) {
  const dot = document.getElementById('sys-dot')
  if (dot) dot.classList.toggle('on', running)
}

// ── Refresh proxy groups from mihomo API ─────────────────────────
async function refreshProxies() {
  try {
    const groups = await invoke('get_proxies')
    const mapped = groups
      .filter(g => ['Selector','URLTest','Fallback','LoadBalance'].includes(g.type) || g.kind)
      .map(g => ({
        name:    g.name,
        type:    g.type || g.kind || 'Selector',
        current: g.now || g.all?.[0] || 'DIRECT',
        delay:   0,
        status:  'good',
      }))
    if (mapped.length > 0) {
      store.set('proxyGroups', mapped)
    }
  } catch {}
}

function addLog(level, msg) {
  store.logs.unshift({ level, msg, time: new Date().toTimeString().slice(0, 8) })
  if (store.logs.length > 200) store.logs.pop()
  store.emit('change:logs')
}
