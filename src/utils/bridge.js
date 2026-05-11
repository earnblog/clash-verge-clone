// ── Tauri Bridge ─────────────────────────────────────────────────
// Wraps @tauri-apps/api/core invoke() with graceful browser fallback.

let _invoke = null
let _listen  = null

async function getInvoke() {
  if (_invoke) return _invoke
  try {
    const m = await import('@tauri-apps/api/core')
    _invoke = m.invoke
  } catch {
    // Browser / dev mode: return mock
    _invoke = async (cmd, args) => {
      console.log(`[bridge] invoke: ${cmd}`, args)
      return mockInvoke(cmd, args)
    }
  }
  return _invoke
}

async function getListen() {
  if (_listen) return _listen
  try {
    const m = await import('@tauri-apps/api/event')
    _listen = m.listen
  } catch {
    _listen = async () => () => {} // no-op unsubscribe
  }
  return _listen
}

export async function invoke(cmd, args = {}) {
  const fn_ = await getInvoke()
  return fn_(cmd, args)
}

export async function listen(event, handler) {
  const fn_ = await getListen()
  return fn_(event, e => handler(e.payload))
}

// ── Mock responses for browser dev ──────────────────────────────
function mockInvoke(cmd, args) {
  switch (cmd) {
    case 'check_kernel':         return false
    case 'core_running':         return false
    case 'get_system_proxy_status': return false
    case 'get_traffic':          return { up: 0, down: 0 }
    case 'get_connections':      return []
    case 'get_proxies':          return []
    case 'get_config_path':      return 'C:\\Users\\you\\AppData\\Roaming\\clash-verge-clone\\config.yaml'
    case 'read_config':          return defaultConfig()
    case 'start_core':           return null
    case 'stop_core':            return null
    case 'enable_system_proxy':  return null
    case 'disable_system_proxy': return null
    case 'set_proxy_mode':       return null
    case 'select_proxy':         return null
    case 'test_delay':           return Math.floor(Math.random() * 200) + 10
    case 'write_config':         return null
    case 'download_kernel':
      return new Promise(res => setTimeout(res, 2000))
    default:
      console.warn('[bridge] unknown command:', cmd)
      return null
  }
}

function defaultConfig() {
  return `mixed-port: 7890
allow-lan: false
mode: rule
log-level: info
external-controller: 127.0.0.1:9090
secret: ""

proxies: []
proxy-groups: []
rules:
  - MATCH,DIRECT
`
}
