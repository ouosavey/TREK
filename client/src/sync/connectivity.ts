import { getApiBaseUrl, isServerUrlConfigured } from '../utils/serverConfig'

const PROBE_INTERVAL_MS = 30_000
const PROBE_TIMEOUT_MS = 1_500

let reachable = true
const listeners = new Set<(v: boolean) => void>()

function setReachable(v: boolean): void {
  if (reachable === v) return
  reachable = v
  listeners.forEach(fn => fn(v))
}

async function probe(): Promise<void> {
  if (!navigator.onLine) { setReachable(false); return }
  // 移动端：服务器地址未配置时跳过探测（首次启动未配置服务器地址）
  if (!isServerUrlConfigured()) { setReachable(false); return }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS)
    // 移动端使用配置的服务器地址（getApiBaseUrl 返回 https://server/api）
    const res = await fetch(`${getApiBaseUrl()}/health`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal: ctrl.signal,
    })
    clearTimeout(t)
    // /api/health returns JSON. CF Access / Pangolin will either return HTML
    // (Pangolin 200 auth wall) or trigger a cross-origin redirect that throws
    // below. Both proxy-auth scenarios resolve to reachable = false.
    const ct = res.headers.get('content-type') || ''
    setReachable(res.ok && ct.includes('application/json'))
  } catch {
    setReachable(false)
  }
}

export function startConnectivityProbe(): void {
  probe()
  setInterval(probe, PROBE_INTERVAL_MS)
  window.addEventListener('online', probe)
  window.addEventListener('offline', () => setReachable(false))
}

export function isReachable(): boolean { return reachable }
export function probeNow(): Promise<void> { return probe() }
export function onChange(fn: (v: boolean) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
