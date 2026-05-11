// ── Central State Store ──────────────────────────────────────────
export const store = {
  // App state
  currentPage: 'proxies',
  sysProxy: false,
  tunMode: false,
  proxyMode: 'rule', // rule | global | direct

  // Profiles / subscriptions
  profiles: JSON.parse(localStorage.getItem('cv_profiles') || '[]'),
  activeProfile: localStorage.getItem('cv_active_profile') || null,

  // Proxy groups parsed from active config
  proxyGroups: [],
  allProxies: [],
  selectedGroups: {}, // groupName → selectedProxy

  // Traffic (live)
  upSpeed: 0,
  dnSpeed: 0,
  totalUp: 0,
  totalDn: 0,
  activeConns: 0,

  // Traffic history for chart
  upHistory:  Array(40).fill(0),
  dnHistory:  Array(40).fill(0),

  // Connections
  connections: [],

  // Log entries
  logs: [],

  // Listeners
  _listeners: {},

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(fn)
  },

  emit(event, data) {
    ;(this._listeners[event] || []).forEach(fn => fn(data))
  },

  set(key, value) {
    this[key] = value
    this.emit('change:' + key, value)
    this.emit('change', { key, value })
  },

  saveProfiles() {
    localStorage.setItem('cv_profiles', JSON.stringify(this.profiles))
    localStorage.setItem('cv_active_profile', this.activeProfile || '')
  },
}
