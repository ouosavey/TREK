import { getApiBaseUrl, getBaseUrl } from '../utils/serverConfig'

/**
 * 将相对路径 URL 转换为完整 URL（移动端需要拼接服务器地址）
 * Capacitor WebView origin 是 https://localhost，相对路径会解析到错误地址
 */
function toFullUrl(url: string): string {
  if (!url) return url
  // 已是绝对 URL，不需要处理
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url
  }
  // 移动端：拼接服务器地址
  const base = getBaseUrl()
  if (base) {
    return `${base}${url}`
  }
  return url
}

export async function getAuthUrl(url: string, purpose: 'download'): Promise<string> {
  if (!url) return url
  try {
    const resp = await fetch(`${getApiBaseUrl()}/auth/resource-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ purpose }),
    })
    if (!resp.ok) return toFullUrl(url)
    const { token } = await resp.json()
    return toFullUrl(`${url}${url.includes('?') ? '&' : '?'}token=${token}`)
  } catch {
    return toFullUrl(url)
  }
}

// ── Blob-based image fetching (Safari-safe, no ephemeral tokens needed) ────

const MAX_CONCURRENT = 6
let active = 0
const queue: Array<() => void> = []

function dequeue() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    active++
    queue.shift()!()
  }
}

export function clearImageQueue() {
  queue.length = 0
}

export async function fetchImageAsBlob(url: string): Promise<string> {
  if (!url) return ''
  const fullUrl = toFullUrl(url)
  return new Promise<string>((resolve) => {
    const run = async () => {
      try {
        const resp = await fetch(fullUrl, { credentials: 'include' })
        if (!resp.ok) { resolve(''); return }
        const blob = await resp.blob()
        resolve(URL.createObjectURL(blob))
      } catch {
        resolve('')
      } finally {
        active--
        dequeue()
      }
    }
    if (active < MAX_CONCURRENT) {
      active++
      run()
    } else {
      queue.push(run)
    }
  })
}
