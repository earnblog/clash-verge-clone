import { store }                            from './store.js'
import { initProxiesPage, testAllProxies }   from './pages/proxies.js'
import { initProfilesPage }                  from './pages/profiles.js'
import { initSettingsPage }                  from './pages/settings.js'
import { initLogsPage }                      from './pages/logs.js'
import { initTray }                          from './utils/tray.js'
import { invoke, listen }                    from './utils/bridge.js'
import { initKernelBanner }                  from './components/kernel-banner.js'

// ── Static data ───────────────────────────────────────────────────
const rules = [
  { type:'DOMAIN-SUFFIX',  payload:'google.com',     proxy:'全球代理', hits:'12.4k' },
  { type:'DOMAIN-SUFFIX',  payload:'openai.com',     proxy:'AI 服务',  hits:'3.2k'  },
  { type:'GEOIP',          payload:'CN',              proxy:'DIRECT',  hits:'89.1k' },
  { type:'IP-CIDR',        payload:'192.168.0.0/16',  proxy:'DIRECT',  hits:'224'   },
  { type:'DOMAIN-KEYWORD', payload:'youtube',         proxy:'流媒体',   hits:'8.7k'  },
  { type:'DOMAIN-SUFFIX',  payload:'netflix.com',     proxy:'流媒体',   hits:'5.1k'  },
  { type:'GEOIP',          payload:'US',              proxy:'全球代理', hits:'34.6k' },
  { type:'DOMAIN-SUFFIX',  payload:'github.com',      proxy:'全球代理', hits:'2.9k'  },
  { type:'DOMAIN-SUFFIX',  payload:'twitter.com',     proxy:'全球代理', hits:'6.8k'  },
  { type:'IP-CIDR',        payload:'10.0.0.0/8',      proxy:'DIRECT',  hits:'118'   },
]

// ── Page nav ──────────────────────────────────────────────────────
const PAGE_TITLES = {
  proxies:'代理', rules:'规则', connections:'连接',
  logs:'日志', profiles:'配置', settings:'设置',
}

window.switchPage = function(name) {
  document.querySelectorAll('.page').forEach(p =>
    p.classList.toggle('active', p.id === 'page-' + name))
  document.querySelectorAll('.nav-item[data-page]').forEach(n =>
    n.classList.toggle('active', n.dataset.page === name))
  document.getElementById('page-title').textContent = PAGE_TITLES[name] || name
  store.set('currentPage', name)
  if (name === 'connections') refreshConnections()
}

window.testAllProxies = testAllProxies

// ── Rules ─────────────────────────────────────────────────────────
function renderRules() {
  const list = document.getElementById('rules-list')
  if (!list) return
  list.innerHTML = ''
  rules.forEach(r => {
    const row = document.createElement('div')
    row.className = 'list-row'
    row.innerHTML = `
      <span class="rule-type ${ruleClass(r.type)}">${r.type}</span>
      <span class="rule-payload">${r.payload}</span>
      <span class="rule-proxy">${r.proxy}</span>
      <span class="rule-hits">${r.hits}</span>`
    list.appendChild(row)
  })
}
function ruleClass(t) {
  if (t.startsWith('DOMAIN')) return 'rt-domain'
  if (t.startsWith('IP'))     return 'rt-ip'
  if (t.startsWith('GEOIP'))  return 'rt-geoip'
  return 'rt-default'
}

// ── Connections (live from mihomo) ────────────────────────────────
async function refreshConnections() {
  let conns = []
  try { conns = await invoke('get_connections') } catch {}

  // Fallback demo data
  if (!conns || conns.length === 0) {
    conns = [
      { id:'1', metadata:{ host:'www.google.com', network:'tcp', destinationPort:'443' }, upload:1200,  download:46600, active:true  },
      { id:'2', metadata:{ host:'api.openai.com', network:'tcp', destinationPort:'443' }, upload:3400,  download:12300, active:true  },
      { id:'3', metadata:{ host:'github.com',     network:'tcp', destinationPort:'443' }, upload:22900, download:159000,active:true  },
      { id:'4', metadata:{ host:'cdn.jsdelivr.net',network:'tcp',destinationPort:'443' }, upload:200,   download:353000,active:false },
    ]
  }

  const list = document.getElementById('conn-list')
  if (!list) return
  list.innerHTML = ''
  conns.forEach(c => {
    const host = c.metadata?.host
      ? `${c.metadata.host}:${c.metadata.destinationPort || '?'}`
      : c.id
    const fmt = b => b < 1048576
      ? Math.round(b/1024) + ' KB'
      : (b/1048576).toFixed(1) + ' MB'
    const row = document.createElement('div')
    row.className = 'list-row'
    row.innerHTML = `
      <span class="conn-dot ${c.active !== false ? 'active' : 'closed'}"></span>
      <span class="conn-host">${host}</span>
      <span class="conn-chain">${c.metadata?.network || 'tcp'}</span>
      <div class="conn-traffic">↑ ${fmt(c.upload||0)}<br>↓ ${fmt(c.download||0)}</div>`
    list.appendChild(row)
  })
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-action="close-all-conn"]')) {
    invoke('close_all_connections').then(() => refreshConnections())
  }
})

// ── Titlebar ──────────────────────────────────────────────────────
function initTitlebar() {
  const sysBtn = document.getElementById('sys-proxy-btn')
  const tunBtn = document.getElementById('tun-btn')
  const sysDot = document.getElementById('sys-dot')
  const tunDot = document.getElementById('tun-dot')

  sysBtn.addEventListener('click', async () => {
    store.set('sysProxy', !store.sysProxy)
    sysDot.classList.toggle('on', store.sysProxy)
    if (store.sysProxy) {
      await invoke('enable_system_proxy', { port: 7890 })
    } else {
      await invoke('disable_system_proxy')
    }
  })

  tunBtn.addEventListener('click', () => {
    store.set('tunMode', !store.tunMode)
    tunDot.classList.toggle('on', store.tunMode)
  })

  // Sync initial sys proxy state
  invoke('get_system_proxy_status').then(on => {
    store.set('sysProxy', on)
    sysDot.classList.toggle('on', on)
  }).catch(() => {})

  // Window controls
  document.getElementById('btn-close').addEventListener('click', async () => {
    try { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().close() } catch {}
  })
  document.getElementById('btn-min').addEventListener('click', async () => {
    try { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().minimize() } catch {}
  })
  document.getElementById('btn-max').addEventListener('click', async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const w = getCurrentWindow()
      ;(await w.isMaximized()) ? w.unmaximize() : w.maximize()
    } catch {}
  })
}

function initModeTabs() {
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      store.set('proxyMode', tab.dataset.mode)
      await invoke('set_proxy_mode', { mode: tab.dataset.mode })
    })
  })
}

// ── Boot ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTitlebar()
  initModeTabs()
  initProxiesPage()
  initProfilesPage()
  initSettingsPage()
  initLogsPage()
  renderRules()
  refreshConnections()
  initKernelBanner()
  initTray()
})
