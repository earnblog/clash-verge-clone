// ── System Tray (Tauri v2) ───────────────────────────────────────
import { store } from '../store.js'

let trayInited = false

export async function initTray() {
  if (trayInited) return
  try {
    const { TrayIcon, menu: { Menu, MenuItem } } = await import('@tauri-apps/api/tray')

    const toggleProxy = await MenuItem.new({
      id:   'toggle_proxy',
      text: store.sysProxy ? '✓ 系统代理 (开启)' : '系统代理 (关闭)',
      action: () => {
        store.set('sysProxy', !store.sysProxy)
        updateTrayMenu()
      },
    })

    const separator = await MenuItem.new({ id: 'sep', text: '---' })

    const modeRule = await MenuItem.new({
      id: 'mode_rule', text: store.proxyMode === 'rule' ? '✓ 规则模式' : '规则模式',
      action: () => { store.set('proxyMode', 'rule'); updateTrayMenu() },
    })
    const modeGlobal = await MenuItem.new({
      id: 'mode_global', text: store.proxyMode === 'global' ? '✓ 全局模式' : '全局模式',
      action: () => { store.set('proxyMode', 'global'); updateTrayMenu() },
    })
    const modeDirect = await MenuItem.new({
      id: 'mode_direct', text: store.proxyMode === 'direct' ? '✓ 直连模式' : '直连模式',
      action: () => { store.set('proxyMode', 'direct'); updateTrayMenu() },
    })

    const sep2 = await MenuItem.new({ id: 'sep2', text: '---' })

    const quit = await MenuItem.new({
      id: 'quit', text: '退出',
      action: async () => {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        await getCurrentWindow().close()
      },
    })

    const trayMenu = await Menu.new({
      items: [toggleProxy, separator, modeRule, modeGlobal, modeDirect, sep2, quit],
    })

    await TrayIcon.new({
      id:      'main',
      menu:    trayMenu,
      tooltip: 'Clash Verge Clone',
    })

    trayInited = true
    console.log('[tray] initialized')
  } catch (e) {
    // Running in browser / Tauri not available
    console.log('[tray] not available in browser mode')
  }
}

async function updateTrayMenu() {
  // Recreate tray to reflect new state (simplest approach)
  trayInited = false
  await initTray()
}
