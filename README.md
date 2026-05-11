# Clash Verge Clone

用 **Tauri 2 + Vite + 原生 JS** 构建的代理客户端，集成 mihomo 真实代理核心。

---

## 环境要求

| 工具 | 安装地址 |
|------|---------|
| Node.js ≥ 18 | https://nodejs.org |
| Rust stable | https://rustup.rs |
| VS C++ Build Tools | Visual Studio Installer → "使用C++的桌面开发" |

---

## 快速开始

```bash
npm install
npm run tauri dev      # 开发模式
npm run tauri build    # 打包 .exe
```

---

## 架构总览

```
前端 (Vite + JS)
  │
  ├── src/utils/bridge.js     ←→  Tauri invoke()
  │                                   │
  └── src/components/               Rust 后端
      kernel-banner.js           ├── core/downloader.rs  自动下载 mihomo
                                 ├── core/runner.rs       启动/停止进程
                                 ├── core/api.rs          REST API 客户端
                                 ├── sysproxy/mod.rs      Windows 注册表代理
                                 └── commands.rs          所有 invoke 命令
                                          │
                                     mihomo.exe
                                    (127.0.0.1:7890)
```

---

## 功能列表

### 第一阶段 ✅
- 深色主题 6 页面 UI
- 实时流量图表
- 代理组卡片 + 测速
- 订阅导入 / 解析 / 持久化
- 系统托盘菜单
- 日志 / 设置持久化

### 第二阶段 ✅
- **自动检测并下载 mihomo 内核**（顶部 banner 提示 + 进度条）
- **自动启动 mihomo 进程**（app 启动时）
- **真实流量数据**（通过 mihomo REST API 每秒轮询）
- **Windows 系统代理**（写注册表 + 即时生效）
- **真实连接列表**（mihomo `/connections` API）
- **代理切换**（invoke `select_proxy` → mihomo API）
- **模式切换**（规则/全局/直连 → mihomo API `PATCH /configs`）
- **延迟测试**（invoke `test_delay`）
- **退出时清理**（关闭 mihomo + 取消系统代理）

---

## 目录结构

```
src/
  main.js                # 入口
  store.js               # 全局状态
  style.css
  pages/
    proxies.js           # 代理页 + 流量图
    profiles.js          # 订阅管理
    settings.js          # 设置持久化
    logs.js              # 实时日志
  utils/
    bridge.js            # Tauri invoke 封装（含浏览器 mock）
    yaml.js              # Clash 配置解析
    tray.js              # 系统托盘
  components/
    kernel-banner.js     # 内核状态 banner

src-tauri/src/
  lib.rs                 # Tauri 入口 + 生命周期
  commands.rs            # 所有 invoke 命令
  core/
    mod.rs
    downloader.rs        # 下载 mihomo
    runner.rs            # 进程管理
    api.rs               # mihomo REST API
  sysproxy/
    mod.rs               # Windows 注册表系统代理
```

---

## 第三阶段计划

- [ ] 订阅用 Rust reqwest 拉取（无 CORS 限制）
- [ ] TUN 模式（需要管理员权限）
- [ ] mihomo 日志 SSE 实时流
- [ ] 节点列表页（所有单节点 + 延迟测试）
- [ ] 配置文件编辑器（带语法高亮）
- [ ] 自动更新订阅（定时任务）
