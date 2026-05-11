import { store } from '../store.js'

// ── Traffic Chart ────────────────────────────────────────────────
const N = 40
let chartCanvas = null

export function initProxiesPage() {
  chartCanvas = document.getElementById('traffic-canvas')
  drawChart()
  setInterval(tickTraffic, 1200)
  renderProxyGroups()
  store.on('change:proxyGroups', renderProxyGroups)
}

function tickTraffic() {
  const up = Math.random() * 800 + 50
  const dn = Math.random() * 2400 + 100
  store.upHistory.push(up); store.upHistory.shift()
  store.dnHistory.push(dn); store.dnHistory.shift()
  store.set('upSpeed', Math.round(up))
  store.set('dnSpeed', Math.round(dn))

  const upEl = document.getElementById('up-speed')
  const dnEl = document.getElementById('dn-speed')
  const chartUpEl = document.getElementById('chart-up-val')
  const chartDnEl = document.getElementById('chart-dn-val')
  if (upEl) upEl.innerHTML = store.upSpeed + '<small>KB/s</small>'
  if (dnEl) dnEl.innerHTML = store.dnSpeed + '<small>KB/s</small>'
  if (chartUpEl) chartUpEl.textContent = store.upSpeed + ' KB/s'
  if (chartDnEl) chartDnEl.textContent = store.dnSpeed + ' KB/s'
  drawChart()
}

function drawChart() {
  if (!chartCanvas) return
  const W = chartCanvas.offsetWidth || 600
  chartCanvas.width  = W
  chartCanvas.height = 80
  const ctx = chartCanvas.getContext('2d')
  const max = Math.max(...store.upHistory, ...store.dnHistory, 1)

  const drawLine = (data, stroke, fill) => {
    ctx.beginPath()
    ctx.strokeStyle = stroke
    ctx.lineWidth   = 1.5
    ctx.lineJoin    = 'round'
    data.forEach((v, i) => {
      const x = (i / (N - 1)) * W
      const y = 78 - (v / max) * 68
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.lineTo(W, 80); ctx.lineTo(0, 80); ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
  }
  drawLine(store.upHistory, '#4f9eff', 'rgba(79,158,255,0.08)')
  drawLine(store.dnHistory, '#2dd4a0', 'rgba(45,212,160,0.08)')
}

// ── Proxy Groups ─────────────────────────────────────────────────
const FALLBACK_GROUPS = [
  { name: '🌐 全球代理', type: 'Selector', current: '🇯🇵 东京 01',   delay: 32,  status: 'good'   },
  { name: '📺 流媒体',   type: 'URLTest',  current: '🇺🇸 洛杉矶 02', delay: 128, status: 'mid'    },
  { name: '🤖 AI 服务', type: 'Selector', current: '🇸🇬 新加坡 01', delay: 45,  status: 'good'   },
  { name: '🎮 游戏加速', type: 'URLTest',  current: '🇯🇵 东京 02',   delay: 28,  status: 'good'   },
  { name: '📦 下载直连', type: 'Direct',   current: 'DIRECT',        delay: 0,   status: 'direct' },
  { name: '🛡️ 广告拦截', type: 'Selector', current: 'REJECT',        delay: 0,   status: 'reject' },
]

let selectedProxy = 0

export function renderProxyGroups() {
  const grid   = document.getElementById('proxy-grid')
  if (!grid) return
  const groups = store.proxyGroups.length ? store.proxyGroups : FALLBACK_GROUPS
  grid.innerHTML = ''

  groups.forEach((p, i) => {
    const card = document.createElement('div')
    card.className = `proxy-card${i === selectedProxy ? ' selected' : ''}`
    const dc = { good: 'delay-good', mid: 'delay-mid', bad: 'delay-bad' }[p.status] || ''
    card.innerHTML = `
      ${i === selectedProxy ? '<span class="tick ti ti-check"></span>' : ''}
      <div class="proxy-name">${p.name}</div>
      <div class="proxy-type-badge ${badgeClass(p.type)}">${p.type}</div>
      <div class="proxy-delay ${dc}">${p.delay ? p.delay + ' ms' : '—'}</div>
      <div class="proxy-now">${p.current}</div>
    `
    card.addEventListener('click', () => { selectedProxy = i; renderProxyGroups() })
    grid.appendChild(card)
  })
}

function badgeClass(type) {
  return { Selector: 'badge-selector', URLTest: 'badge-urltest', Direct: 'badge-direct', Fallback: 'badge-fallback' }[type] || 'badge-selector'
}

export function testAllProxies() {
  const groups = store.proxyGroups.length ? store.proxyGroups : FALLBACK_GROUPS
  groups.forEach(p => {
    if (p.status !== 'direct' && p.status !== 'reject') {
      p.delay  = Math.floor(Math.random() * 200) + 10
      p.status = p.delay < 80 ? 'good' : p.delay < 150 ? 'mid' : 'bad'
    }
  })
  renderProxyGroups()
}
