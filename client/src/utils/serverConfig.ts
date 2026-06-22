import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const SERVER_URL_KEY = 'trek_server_url'

/**
 * 获取当前运行环境的基础 URL
 * - Web 环境：返回空字符串（使用相对路径 /api）
 * - Capacitor 移动端：返回用户配置的服务器地址（如 https://nas.example.com）
 */
export function getBaseUrl(): string {
  // Web 环境使用相对路径
  if (!Capacitor.isNativePlatform()) {
    return ''
  }
  // 移动端：从内存缓存读取（同步），避免每次都异步读取
  return cachedServerUrl
}

// 内存缓存，避免异步读取导致首次请求失败
let cachedServerUrl = ''

/**
 * 异步初始化服务器地址（app 启动时调用）
 * 从 Preferences 读取已保存的服务器地址到内存缓存
 */
export async function initServerUrl(): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    return ''
  }
  try {
    const { value } = await Preferences.get({ key: SERVER_URL_KEY })
    cachedServerUrl = value || ''
    return cachedServerUrl
  } catch (err) {
    console.error('[serverConfig] Failed to read server URL:', err)
    return ''
  }
}

/**
 * 设置并保存服务器地址（用户在配置页面输入）
 */
export async function setServerUrl(url: string): Promise<void> {
  // 规范化：去掉末尾斜杠
  const normalized = url.replace(/\/+$/, '').trim()
  cachedServerUrl = normalized
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key: SERVER_URL_KEY, value: normalized })
  }
}

/**
 * 获取已保存的服务器地址（用于配置页面显示）
 */
export async function getSavedServerUrl(): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    return ''
  }
  const { value } = await Preferences.get({ key: SERVER_URL_KEY })
  return value || ''
}

/**
 * 是否已配置服务器地址（移动端）
 */
export function isServerUrlConfigured(): boolean {
  if (!Capacitor.isNativePlatform()) {
    return true // Web 环境总是已配置
  }
  return cachedServerUrl !== ''
}

/**
 * 获取完整的 API 基础 URL
 * - Web：/api
 * - 移动端：https://server.com/api
 */
export function getApiBaseUrl(): string {
  const base = getBaseUrl()
  return base ? `${base}/api` : '/api'
}

/**
 * 获取 origin（替代 window.location.origin）
 * - Web：window.location.origin
 * - 移动端：用户配置的服务器地址
 */
export function getOrigin(): string {
  if (!Capacitor.isNativePlatform()) {
    return window.location.origin
  }
  return cachedServerUrl || ''
}
