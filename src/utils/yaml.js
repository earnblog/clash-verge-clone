// ── Lightweight Clash config parser ─────────────────────────────
// Handles the subset of YAML used in Clash/mihomo configs.

/**
 * Very minimal YAML parser — enough for Clash config files.
 * For production, swap in js-yaml (npm i js-yaml).
 */
export function parseClashConfig(text) {
  const lines = text.split('\n')
  const config = {}
  let currentKey = null
  let currentList = null
  let currentObj = null
  let indent = 0

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue

    const leadingSpaces = raw.match(/^(\s*)/)[1].length

    // Top-level key: value
    if (leadingSpaces === 0) {
      const m = raw.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/)
      if (m) {
        currentKey  = m[1]
        const val   = m[2].trim()
        if (val === '' || val === '|' || val === '>') {
          config[currentKey] = []
          currentList = config[currentKey]
          currentObj  = null
        } else {
          config[currentKey] = parseScalar(val)
          currentList = null
          currentObj  = null
        }
      }
    } else if (leadingSpaces === 2) {
      // List item
      const listItem = raw.match(/^\s+-\s+(.*)$/)
      if (listItem && Array.isArray(currentList)) {
        const item = listItem[1].trim()
        if (item.includes(':')) {
          // Inline object  e.g. "- name: foo, type: bar"
          const obj = parseInlineObj(item)
          currentList.push(obj)
          currentObj = obj
        } else {
          currentList.push(parseScalar(item))
          currentObj = null
        }
      }
      // key: value inside top-level object
      const kv = raw.match(/^\s+([a-zA-Z0-9_-]+)\s*:\s*(.*)$/)
      if (kv && !listItem && currentObj === null) {
        if (typeof config[currentKey] !== 'object' || Array.isArray(config[currentKey])) {
          config[currentKey] = {}
        }
        config[currentKey][kv[1]] = parseScalar(kv[2].trim())
      }
    } else if (leadingSpaces >= 4 && currentObj) {
      // Key inside a list object
      const kv = raw.match(/^\s+([a-zA-Z0-9_-]+)\s*:\s*(.*)$/)
      if (kv) currentObj[kv[1]] = parseScalar(kv[2].trim())
    }
  }

  return config
}

function parseScalar(v) {
  if (v === 'true')  return true
  if (v === 'false') return false
  if (v === 'null' || v === '~') return null
  if (/^-?\d+$/.test(v))   return parseInt(v, 10)
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v)
  return v.replace(/^['"]|['"]$/g, '')
}

function parseInlineObj(str) {
  const obj = {}
  const parts = str.split(',')
  parts.forEach(p => {
    const kv = p.trim().match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/)
    if (kv) obj[kv[1].trim()] = parseScalar(kv[2].trim())
  })
  return obj
}

/**
 * Extract proxy groups and proxies from a parsed Clash config.
 */
export function extractProxies(config) {
  const proxies = config['proxies'] || config['Proxies'] || []
  const groups  = config['proxy-groups'] || config['proxy_groups'] || []

  return {
    proxies: proxies.map(p => ({
      name:   p.name  || p.Name  || 'Unknown',
      type:   p.type  || p.Type  || 'ss',
      server: p.server || '',
      port:   p.port   || 0,
    })),
    groups: groups.map(g => ({
      name:    g.name    || 'Group',
      type:    g.type    || 'select',
      proxies: g.proxies || [],
    })),
  }
}

/**
 * Detect if text is base64 and decode it.
 */
export function maybeBase64Decode(text) {
  text = text.trim()
  try {
    const decoded = atob(text)
    // If decoded is valid UTF-8 text with common Clash keywords, use it
    if (decoded.includes('proxies') || decoded.includes('proxy-groups') || decoded.includes('port:')) {
      return decoded
    }
  } catch {}
  return text
}

/**
 * Try to parse a subscription response into a Clash config object.
 * Handles: raw YAML, base64-encoded YAML, plain proxy list.
 */
export function parseSubscription(raw) {
  const text = maybeBase64Decode(raw)
  try {
    const cfg = parseClashConfig(text)
    if (cfg.proxies || cfg['proxy-groups']) return cfg
  } catch {}
  return null
}
