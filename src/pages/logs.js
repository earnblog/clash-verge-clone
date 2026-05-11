import { store } from '../store.js'

const SAMPLE_MSGS = [
  'MATCH DOMAIN-SUFFIX google.com → 全球代理',
  'MATCH GEOIP CN → DIRECT',
  'DNS resolved: api.openai.com → 104.18.6.0',
  'TCP connect: github.com:443',
  'DIRECT connect: 192.168.1.1:80',
  'MATCH DOMAIN-KEYWORD youtube → 流媒体',
  'REJECT: ad.doubleclick.net',
  'UDP associate: 8.8.8.8:53',
  'TLS handshake complete: twitter.com',
  'MATCH IP-CIDR 192.168.0.0/16 → DIRECT',
]

export function initLogsPage() {
  // Seed with some sample logs
  if (store.logs.length === 0) seedLogs()
  renderLogs()
  store.on('change:logs', renderLogs)

  document.getElementById('btn-clear-logs').addEventListener('click', () => {
    store.logs = []
    store.emit('change:logs')
  })

  document.getElementById('btn-refresh-logs').addEventListener('click', () => {
    seedLogs()
    renderLogs()
  })

  // Keep adding fake logs every 3s
  setInterval(addFakeLog, 3000)
}

function seedLogs() {
  const levels = ['INF','INF','INF','WRN','ERR','DBG']
  for (let i = 19; i >= 0; i--) {
    const lv  = levels[Math.floor(Math.random() * levels.length)]
    const msg = SAMPLE_MSGS[Math.floor(Math.random() * SAMPLE_MSGS.length)]
    const t   = new Date(); t.setSeconds(t.getSeconds() - i * 4)
    store.logs.push({ level: lv, msg, time: t.toTimeString().slice(0, 8) })
  }
}

function addFakeLog() {
  const levels = ['INF','INF','WRN','ERR']
  const lv  = levels[Math.floor(Math.random() * levels.length)]
  const msg = SAMPLE_MSGS[Math.floor(Math.random() * SAMPLE_MSGS.length)]
  store.logs.unshift({ level: lv, msg, time: new Date().toTimeString().slice(0, 8) })
  if (store.logs.length > 200) store.logs.pop()
  store.emit('change:logs')
}

export function renderLogs() {
  const box = document.getElementById('log-box')
  if (!box) return
  const html = store.logs.slice(0, 80).map(l =>
    `<div><span class="log-ts">${l.time}</span> <span class="log-${l.level.toLowerCase()}">[${l.level}]</span> ${escHtml(l.msg)}</div>`
  ).join('')
  box.innerHTML = html
  box.scrollTop = 0
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
