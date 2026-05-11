import { store } from '../store.js'

const settingsDef = [
  { key: 'autoStart',   label: '开机自启动',   icon: 'ti-rocket',       type: 'toggle', default: true  },
  { key: 'sysProxy',    label: '系统代理',     icon: 'ti-globe',         type: 'toggle', default: false },
  { key: 'tunMode',     label: 'TUN 模式',     icon: 'ti-shield-check',  type: 'toggle', default: false },
  { key: 'allowLan',    label: '允许局域网',   icon: 'ti-wifi',          type: 'toggle', default: false },
  { key: 'mixedPort',   label: '混合端口',     icon: 'ti-plug',          type: 'input',  default: '7890' },
  { key: 'ctrlPort',    label: '外部控制端口', icon: 'ti-api',           type: 'input',  default: '9090' },
  { key: 'logLevel',    label: '日志级别',     icon: 'ti-file-text',     type: 'select', default: 'info',
    options: ['debug','info','warning','error','silent'] },
  { key: 'language',    label: '语言',         icon: 'ti-language',      type: 'select', default: '简体中文',
    options: ['简体中文','English'] },
  { key: 'theme',       label: '主题',         icon: 'ti-palette',       type: 'select', default: '深色',
    options: ['深色','浅色','跟随系统'] },
]

// Load persisted settings
const savedSettings = JSON.parse(localStorage.getItem('cv_settings') || '{}')
export const appSettings = {}
settingsDef.forEach(s => {
  appSettings[s.key] = savedSettings[s.key] !== undefined ? savedSettings[s.key] : s.default
})

function saveSettings() {
  localStorage.setItem('cv_settings', JSON.stringify(appSettings))
}

export function initSettingsPage() {
  renderSettings()
}

export function renderSettings() {
  const list = document.getElementById('settings-list')
  if (!list) return
  list.innerHTML = ''

  settingsDef.forEach(s => {
    const row = document.createElement('div')
    row.className = 'list-row'

    let control = ''
    if (s.type === 'toggle') {
      const on = appSettings[s.key]
      control = `<div class="toggle ${on ? 'on' : ''}" data-key="${s.key}"></div>`
    } else if (s.type === 'input') {
      control = `<input class="settings-input" data-key="${s.key}" value="${appSettings[s.key]}" style="width:72px;text-align:right" />`
    } else if (s.type === 'select') {
      const opts = s.options.map(o =>
        `<option value="${o}" ${appSettings[s.key] === o ? 'selected' : ''}>${o}</option>`
      ).join('')
      control = `<select class="settings-select" data-key="${s.key}">${opts}</select>`
    }

    row.innerHTML = `
      <i class="ti ${s.icon} setting-icon"></i>
      <span class="setting-label">${s.label}</span>
      ${control}
    `

    // Events
    const toggle = row.querySelector('.toggle')
    if (toggle) {
      toggle.addEventListener('click', () => {
        appSettings[s.key] = !appSettings[s.key]
        toggle.classList.toggle('on', appSettings[s.key])
        saveSettings()
        // Sync to store for sysProxy / tunMode
        if (s.key === 'sysProxy') store.set('sysProxy', appSettings[s.key])
        if (s.key === 'tunMode')  store.set('tunMode',  appSettings[s.key])
      })
    }
    const input = row.querySelector('.settings-input')
    if (input) {
      input.addEventListener('change', () => {
        appSettings[s.key] = input.value
        saveSettings()
      })
    }
    const sel = row.querySelector('.settings-select')
    if (sel) {
      sel.addEventListener('change', () => {
        appSettings[s.key] = sel.value
        saveSettings()
      })
    }

    list.appendChild(row)
  })
}
