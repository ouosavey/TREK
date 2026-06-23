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

/**
 * 将相对路径的资源 URL 转换为完整 URL
 * - Web：原样返回（相对路径在浏览器中自动解析）
 * - 移动端：拼接服务器地址（如 /uploads/x.jpg → https://server/uploads/x.jpg）
 *
 * 用于 img src、background-image 等静态资源路径。
 * 已是绝对 URL（http/https/data）的不处理。
 *
 * 注意：后端存储格式不统一：
 * - Trip cover_image: /uploads/covers/xxx.jpg（完整路径）
 * - Journey cover_image（直接上传）: journey/xxx.jpg（相对路径，无 /uploads/ 前缀）
 * - Journey cover_image（继承自 Trip）: covers/xxx.jpg（相对路径，无 /uploads/ 前缀）
 * 此函数会自动补全 /uploads/ 前缀。
 */
export function getAssetUrl(path: string | null | undefined): string {
  if (!path) return ''
  // 已是绝对 URL 或 data URL，不需要处理
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }
  // 归一化路径：如果路径不以 / 开头，且不是 /api/ 开头，补全 /uploads/ 前缀
  // 后端 Journey cover_image 存储为 "journey/xxx.jpg" 或 "covers/xxx.jpg"，需要补全为 "/uploads/journey/xxx.jpg"
  let normalized = path
  if (!normalized.startsWith('/')) {
    // 不以 / 开头的相对路径，补全 /uploads/ 前缀
    normalized = `/uploads/${normalized}`
  }
  // Capacitor 移动端：拼接服务器地址
  if (Capacitor.isNativePlatform() && cachedServerUrl) {
    return `${cachedServerUrl}${normalized}`
  }
  // Web：原样返回归一化后的路径
  return normalized
}
