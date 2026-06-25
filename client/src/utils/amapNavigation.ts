/**
 * 高德地图导航工具
 *
 * 在 Capacitor 原生平台（APK）中，window.open('https://uri.amap.com/...') 会在 WebView 内部
 * 加载高德网页，网页中的 JS 唤起逻辑在 WebView 中不可靠（可能被其他 App 错误拦截）。
 *
 * 解决方案：原生平台直接使用 androidamap:// deep link scheme，通过 <a> 元素模拟点击触发
 * Android WebView 的 shouldOverrideUrlLoading，Capacitor 默认将非 http/https scheme 交给系统
 * Intent 处理，正确唤起高德地图 App。
 *
 * 浏览器（桌面/移动）仍使用 https://uri.amap.com/ URL，callnative=1 由网页尝试唤起 App。
 */

import { Capacitor } from '@capacitor/core'

/**
 * 打开高德地图导航
 * @param gcjLng 目的地经度（GCJ-02 坐标系）
 * @param gcjLat 目的地纬度（GCJ-02 坐标系）
 * @param name 目的地名称
 */
export function openAmapNavigation(gcjLng: number, gcjLat: number, name: string): void {
  const encodedName = encodeURIComponent(name || '目的地')

  if (Capacitor.isNativePlatform()) {
    // 原生平台（APK）：直接使用 deep link 唤起高德 App
    // androidamap:// scheme 由高德 App 注册，系统会正确找到并打开
    const deepLink = `androidamap://route/plan/?dlat=${gcjLat}&dlon=${gcjLng}&dname=${encodedName}&dev=0&t=0&source=TREK`
    openUrlViaAnchor(deepLink)
  } else {
    // 浏览器：使用高德 URI API，callnative=1 会尝试唤起高德 App
    const navUrl = `https://uri.amap.com/navigation?to=${gcjLng},${gcjLat},${encodedName}&mode=car&src=TREK&coordinate=gaode&callnative=1`
    window.open(navUrl, '_blank')
  }
}

/**
 * 生成高德导航 URL（用于 InfoWindow 等 HTML 上下文中的 <a href>）
 * 在原生平台返回 androidamap:// deep link，在浏览器返回 https URL
 */
export function getAmapNavUrl(gcjLng: number, gcjLat: number, name: string): string {
  const encodedName = encodeURIComponent(name || '目的地')
  if (Capacitor.isNativePlatform()) {
    return `androidamap://route/plan/?dlat=${gcjLat}&dlon=${gcjLng}&dname=${encodedName}&dev=0&t=0&source=TREK`
  }
  return `https://uri.amap.com/navigation?to=${gcjLng},${gcjLat},${encodedName}&mode=car&src=TREK&coordinate=gaode&callnative=1`
}

/**
 * 通过创建 <a> 元素并模拟点击来打开 URL
 * 在 Capacitor WebView 中，这会触发 shouldOverrideUrlLoading，
 * 对 custom scheme（如 androidamap://）会交给系统 Intent 处理
 */
function openUrlViaAnchor(url: string): void {
  const a = document.createElement('a')
  a.href = url
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => a.remove(), 100)
}
