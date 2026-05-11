import { store }             from '../store.js'
import { parseSubscription, extractProxies } from '../utils/yaml.js'

// ── Profiles Page ────────────────────────────────────────────────
export function initProfilesPage() {
  renderProfiles()
  store.on('change:profiles', renderProfiles)

  // "Add subscription" button
  document.getElementById('btn-add-profile').addEventListener('click', openAddModal)
}

export function renderProfiles() {
  const wrap = document.getElementById('profile-list')
  if (!wrap) return
  wrap.innerHTML = ''

  if (store.profiles.length === 0) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:48px 0;color:var(--text3)">
        <i class="ti ti-inbox" style="font-size:40px;display:block;margin-bottom:12px"></i>
        暂无订阅，点击右上角「新增订阅」添加
      </div>`
    return
  }

  store.profiles.forEach((p, i) => {
    const isActive = store.activeProfile === p.id
    const card = document.createElement('div')
    card.className = `profile-card${isActive ? ' active' : ''}`
    card.innerHTML = `
      <i class="ti ti-file-text" style="font-size:22px;color:${isActive ? 'var(--accent)' : 'var(--text2)'}"></i>
      <div style="flex:1;min-width:0">
        <div class="profile-name">
          ${p.name}
          ${isActive ? '<span class="tag">使用中</span>' : ''}
        </div>
        <div class="profile-meta">
          ${p.nodeCount ? p.nodeCount + ' 个节点 · ' : ''}更新于 ${p.updatedAt || '未知'}
        </div>
        ${p.url ? `<div class="profile-meta" style="color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px">${p.url}</div>` : ''}
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0">
        <button class="icon-btn" title="更新订阅" data-action="update" data-idx="${i}">
          <i class="ti ti-refresh"></i>
        </button>
        <button class="icon-btn" title="编辑" data-action="edit" data-idx="${i}">
          <i class="ti ti-edit"></i>
        </button>
        <button class="icon-btn danger" title="删除" data-action="delete" data-idx="${i}">
          <i class="ti ti-trash"></i>
        </button>
      </div>
    `
    card.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]')
      if (btn) {
        e.stopPropagation()
        const idx = parseInt(btn.dataset.idx)
        if (btn.dataset.action === 'delete') deleteProfile(idx)
        if (btn.dataset.action === 'update') updateProfile(idx)
        if (btn.dataset.action === 'edit')   openEditModal(idx)
        return
      }
      activateProfile(i)
    })
    wrap.appendChild(card)
  })
}

// ── Activate a profile ───────────────────────────────────────────
function activateProfile(idx) {
  const p = store.profiles[idx]
  if (!p) return
  store.set('activeProfile', p.id)
  store.saveProfiles()
  // Parse and inject proxy groups if config is cached
  if (p.configText) {
    applyConfig(p.configText)
  }
  renderProfiles()
  addLog('INF', `已切换配置：${p.name}`)
}

function applyConfig(text) {
  const cfg = parseSubscription(text)
  if (cfg) {
    const { proxies, groups } = extractProxies(cfg)
    const mappedGroups = groups.map(g => ({
      name:    g.name,
      type:    capitalize(g.type),
      current: g.proxies[0] || 'DIRECT',
      delay:   0,
      status:  'good',
    }))
    store.set('proxyGroups', mappedGroups)
    store.set('allProxies',  proxies)
    addLog('INF', `加载 ${proxies.length} 个节点，${groups.length} 个代理组`)
  }
}

// ── Delete ───────────────────────────────────────────────────────
function deleteProfile(idx) {
  if (!confirm('确定删除此订阅吗？')) return
  const p = store.profiles[idx]
  store.profiles.splice(idx, 1)
  if (store.activeProfile === p.id) store.set('activeProfile', null)
  store.saveProfiles()
  store.emit('change:profiles')
  addLog('INF', `已删除订阅：${p.name}`)
}

// ── Update / fetch subscription ──────────────────────────────────
export async function updateProfile(idx) {
  const p = store.profiles[idx]
  if (!p || !p.url) return
  addLog('INF', `正在更新订阅：${p.name}…`)

  try {
    // In Tauri, use the shell plugin or fetch with proxy.
    // In browser/dev mode, use a CORS proxy for demo.
    const res = await fetchWithFallback(p.url)
    p.configText = res
    p.updatedAt  = relativeNow()
    const cfg = parseSubscription(res)
    if (cfg) {
      const { proxies, groups } = extractProxies(cfg)
      p.nodeCount = proxies.length
    }
    store.saveProfiles()
    store.emit('change:profiles')
    if (store.activeProfile === p.id) applyConfig(res)
    addLog('INF', `订阅更新成功：${p.name}（${p.nodeCount || '?'} 节点）`)
  } catch (err) {
    addLog('ERR', `订阅更新失败：${err.message}`)
  }
}

async function fetchWithFallback(url) {
  // Try direct first (works in Tauri with proper permissions)
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return await r.text()
  } catch {
    // CORS proxy fallback for browser dev
    const proxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url)
    const r = await fetch(proxy, { signal: AbortSignal.timeout(15000) })
    if (!r.ok) throw new Error('代理请求失败 ' + r.status)
    return await r.text()
  }
}

// ── Add modal ────────────────────────────────────────────────────
function openAddModal() {
  showModal({
    title: '新增订阅',
    fields: [
      { id: 'modal-name', label: '名称',    placeholder: '我的机场', value: '' },
      { id: 'modal-url',  label: '订阅链接', placeholder: 'https://...', value: '' },
    ],
    confirmText: '导入',
    onConfirm: async (vals) => {
      if (!vals['modal-url'].trim()) { alert('请填写订阅链接'); return false }
      const p = {
        id:         Date.now().toString(),
        name:       vals['modal-name'].trim() || '新订阅',
        url:        vals['modal-url'].trim(),
        updatedAt:  '刚刚',
        nodeCount:  0,
        configText: '',
      }
      store.profiles.push(p)
      store.saveProfiles()
      store.emit('change:profiles')
      const idx = store.profiles.length - 1
      await updateProfile(idx)
      return true
    },
  })
}

function openEditModal(idx) {
  const p = store.profiles[idx]
  showModal({
    title: '编辑订阅',
    fields: [
      { id: 'modal-name', label: '名称',    placeholder: '我的机场', value: p.name },
      { id: 'modal-url',  label: '订阅链接', placeholder: 'https://...', value: p.url || '' },
    ],
    confirmText: '保存',
    onConfirm: (vals) => {
      p.name = vals['modal-name'].trim() || p.name
      p.url  = vals['modal-url'].trim()
      store.saveProfiles()
      store.emit('change:profiles')
      return true
    },
  })
}

// ── Modal component ──────────────────────────────────────────────
function showModal({ title, fields, confirmText, onConfirm }) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <i class="ti ti-x modal-close" style="cursor:pointer;font-size:18px;color:var(--text2)"></i>
      </div>
      <div class="modal-body">
        ${fields.map(f => `
          <div class="form-group">
            <label class="form-label">${f.label}</label>
            <input class="form-input" id="${f.id}" placeholder="${f.placeholder}" value="${f.value}" />
          </div>
        `).join('')}
      </div>
      <div class="modal-footer">
        <button class="btn-cancel">取消</button>
        <button class="btn-confirm">${confirmText}</button>
      </div>
    </div>
  `

  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('visible'))

  const close = () => {
    overlay.classList.remove('visible')
    setTimeout(() => overlay.remove(), 200)
  }

  overlay.querySelector('.modal-close').addEventListener('click', close)
  overlay.querySelector('.btn-cancel').addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  overlay.querySelector('.btn-confirm').addEventListener('click', async () => {
    const vals = {}
    fields.forEach(f => { vals[f.id] = document.getElementById(f.id).value })
    const ok = await onConfirm(vals)
    if (ok !== false) close()
  })
}

// ── Helpers ──────────────────────────────────────────────────────
function relativeNow() {
  return '刚刚'
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function addLog(level, msg) {
  store.logs.unshift({ level, msg, time: new Date().toTimeString().slice(0, 8) })
  if (store.logs.length > 200) store.logs.pop()
  store.emit('change:logs')
}
