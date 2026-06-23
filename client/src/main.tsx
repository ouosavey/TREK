import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { startConnectivityProbe } from './sync/connectivity'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { initServerUrl } from './utils/serverConfig'
import { refreshApiBaseUrl } from './api/client'

/**
 * 根据系统深色模式设置状态栏样式
 * - 深色模式：深色背景 + 浅色文字
 * - 浅色模式：浅色背景 + 深色文字
 */
function applyStatusBarStyle(isDark: boolean) {
  StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {})
  // 设置状态栏背景色（与 App 主题色一致）
  StatusBar.setBackgroundColor({ color: isDark ? '#09090b' : '#ffffff' }).catch(() => {})
}

/**
 * 移动端启动流程：
 * 1. 先从 Preferences 读取已保存的服务器地址到内存缓存 (cachedServerUrl)
 * 2. 刷新 apiClient.defaults.baseURL（模块加载时 cachedServerUrl 为空，baseURL 是 /api）
 * 3. 配置状态栏：不覆盖 WebView，根据深色模式设置颜色
 * 4. 监听系统深色模式变化，动态更新状态栏样式
 * 5. 再启动连接探测和渲染 App
 */
async function bootstrap() {
  if (Capacitor.isNativePlatform()) {
    try {
      await initServerUrl()
      refreshApiBaseUrl()
    } catch (err) {
      console.error('[bootstrap] Failed to init server URL:', err)
    }
    // 配置状态栏：不覆盖 WebView，内容自动在状态栏下方开始
    try {
      await StatusBar.setOverlaysWebView({ overlay: false })
      // 根据当前系统深色模式设置状态栏样式
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyStatusBarStyle(mq.matches)
      // 监听系统深色模式变化
      mq.addEventListener('change', (e) => applyStatusBarStyle(e.matches))
    } catch (err) {
      console.error('[bootstrap] Failed to configure status bar:', err)
    }
  }
  startConnectivityProbe()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
}

bootstrap()
