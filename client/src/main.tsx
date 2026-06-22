import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { startConnectivityProbe } from './sync/connectivity'
import { Capacitor } from '@capacitor/core'
import { initServerUrl } from './utils/serverConfig'
import { refreshApiBaseUrl } from './api/client'

/**
 * 移动端启动流程：
 * 1. 先从 Preferences 读取已保存的服务器地址到内存缓存 (cachedServerUrl)
 * 2. 刷新 apiClient.defaults.baseURL（模块加载时 cachedServerUrl 为空，baseURL 是 /api）
 * 3. 再启动连接探测和渲染 App
 *
 * 如果不先初始化，startConnectivityProbe 和 App 的 useEffect 会用错误的
 * baseURL (/api → https://localhost/api) 发起请求，导致白屏循环。
 */
async function bootstrap() {
  if (Capacitor.isNativePlatform()) {
    try {
      await initServerUrl()
      refreshApiBaseUrl()
    } catch (err) {
      console.error('[bootstrap] Failed to init server URL:', err)
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
