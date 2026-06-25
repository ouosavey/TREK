import { Capacitor } from '@capacitor/core'

/**
 * 判断是否为原生/移动端环境。
 * - Capacitor 原生平台（APK）：返回 true
 * - 鸿蒙/Android/iOS 浏览器（通过 userAgent 识别）：返回 true
 * 两种检测方式取并集，与 PlaceInspector 中已验证可用的逻辑一致。
 */
function isNativeOrMobile(): boolean {
  if (Capacitor.isNativePlatform()) return true
  if (typeof navigator !== 'undefined' && /Mobi|Android|HarmonyOS/i.test(navigator.userAgent)) {
    return true
  }
  return false
}

/**
 * 打开高德地图导航（统一入口）
 *
 * - 原生/移动端：优先使用 androidamap:// deep link 直接唤起高德 App；
 *   1.5 秒后若仍停留在当前页（高德 App 未安装），回退到 web URL。
 *   （与 PlaceInspector 中的逻辑一致，在鸿蒙 6.1 / Android 上已验证可用）
 * - Web 端（桌面浏览器）：使用 https://uri.amap.com/ URL，callnative=1 会尝试唤起 App
 *
 * @param lat GCJ-02 纬度（高德坐标系）
 * @param lng GCJ-02 经度（高德坐标系）
 * @param name 目的地名称
 */
export function openAmapNavigation(lat: number, lng: number, name?: string): void {
  const encodedName = encodeURIComponent(name || '目的地')

  if (isNativeOrMobile()) {
    // 原生/移动端：优先 deep link 唤起高德 App
    const deepLink = `androidamap://route/plan/?dlat=${lat}&dlon=${lng}&dname=${encodedName}&dev=0&t=0&source=TREK`
    const webUrl = `https://uri.amap.com/navigation?to=${lng},${lat},${encodedName}&mode=car&src=TREK&coordinate=gaode&callnative=1`
    const start = Date.now()
    window.open(deepLink, '_blank')
    // 若 deep link 未跳转（App 未安装），回退到 web URL
    setTimeout(() => {
      if (!document.hidden && Date.now() - start < 2000) {
        window.open(webUrl, '_blank')
      }
    }, 1500)
  } else {
    // Web 端：使用 web URL
    const webUrl = `https://uri.amap.com/navigation?to=${lng},${lat},${encodedName}&mode=car&src=TREK&coordinate=gaode&callnative=1`
    window.open(webUrl, '_blank')
  }
}

/**
 * 打开高德地图多途经点导航（用于"按天整条路线导航"场景）。
 *
 * - 原生/移动端：使用 androidamap://route/plan/?...&via= 多点 deep link 唤起高德 App
 * - Web 端：使用 https://uri.amap.com/navigation?from=&to=&via= web URL
 *
 * @param waypoints 途经点数组，每个元素为 {lng, lat, name}，坐标必须是 GCJ-02（高德坐标系）
 *                  至少需要 2 个点（起点 + 终点）
 */
export function openAmapMultiRouteNavigation(
  waypoints: { lng: number; lat: number; name?: string }[]
): void {
  const valid = waypoints.filter(p => p && Number.isFinite(p.lng) && Number.isFinite(p.lat))
  if (valid.length === 0) return

  if (valid.length === 1) {
    openAmapNavigation(valid[0].lat, valid[0].lng, valid[0].name)
    return
  }

  if (isNativeOrMobile()) {
    // 原生/移动端：androidamap:// deep link 多点导航
    // 参数说明：slat/slng 起点，dlat/dlon 终点，via 中间点（分号分隔的 dlat,dlon;dlat,dlon）
    const origin = valid[0]
    const dest = valid[valid.length - 1]
    const viaPoints = valid.slice(1, -1)
    const viaStr = viaPoints.map(p => `${p.lat},${p.lng}`).join(';')
    const deepLink = `androidamap://route/plan/?slat=${origin.lat}&slon=${origin.lng}&sname=${encodeURIComponent(origin.name || '起点')}&dlat=${dest.lat}&dlon=${dest.lng}&dname=${encodeURIComponent(dest.name || '终点')}${viaStr ? `&via=${viaStr}` : ''}&dev=0&t=0&source=TREK`
    const start = Date.now()
    window.open(deepLink, '_blank')
    setTimeout(() => {
      if (!document.hidden && Date.now() - start < 2000) {
        const originCoord = `${valid[0].lng},${valid[0].lat}`
        const destCoord = `${valid[valid.length - 1].lng},${valid[valid.length - 1].lat}`
        const viaCoord = valid.slice(1, -1).map(p => `${p.lng},${p.lat}`).join(';')
        const webUrl = `https://uri.amap.com/navigation?from=${originCoord}&to=${destCoord}${viaCoord ? '&via=' + viaCoord : ''}&mode=car&src=TREK&coordinate=gaode&callnative=1`
        window.open(webUrl, '_blank')
      }
    }, 1500)
  } else {
    // Web 端：web URL 多点导航
    const originCoord = `${valid[0].lng},${valid[0].lat}`
    const destCoord = `${valid[valid.length - 1].lng},${valid[valid.length - 1].lat}`
    const viaCoord = valid.slice(1, -1).map(p => `${p.lng},${p.lat}`).join(';')
    const webUrl = `https://uri.amap.com/navigation?from=${originCoord}&to=${destCoord}${viaCoord ? '&via=' + viaCoord : ''}&mode=car&src=TREK&coordinate=gaode&callnative=1`
    window.open(webUrl, '_blank')
  }
}
