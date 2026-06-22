import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { getSavedServerUrl, setServerUrl } from '../utils/serverConfig'
import { refreshApiBaseUrl } from '../api/client'

interface ServerConfigScreenProps {
  onConfigured: () => void
}

/**
 * 服务器地址配置页面（仅移动端显示）
 * 首次启动或服务器地址未配置时显示
 */
export default function ServerConfigScreen({ onConfigured }: ServerConfigScreenProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    getSavedServerUrl().then(saved => {
      if (saved) setUrl(saved)
    })
  }, [])

  const handleSave = async () => {
    setError('')
    const trimmed = url.trim().replace(/\/+$/, '')
    if (!trimmed) {
      setError('请输入服务器地址')
      return
    }
    if (!/^https?:\/\/.+/.test(trimmed)) {
      setError('地址必须以 http:// 或 https:// 开头')
      return
    }

    setTesting(true)
    try {
      // 测试服务器连通性
      const resp = await fetch(`${trimmed}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      })
      if (!resp.ok) {
        throw new Error(`服务器返回 ${resp.status}`)
      }
      // 保存服务器地址
      await setServerUrl(trimmed)
      refreshApiBaseUrl()
      onConfigured()
    } catch (err) {
      setError(`无法连接到服务器：${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-600 mb-4">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">TREK</h1>
          <p className="text-slate-400 mt-2">旅行规划助手</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              服务器地址
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-nas-domain.com"
              className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none placeholder-slate-500"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="text-xs text-slate-500 mt-2">
              输入你部署 TREK 的服务器地址（含 http:// 或 https://）
            </p>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={testing || loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {testing ? '正在连接...' : '连接服务器'}
          </button>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          TREK v3.0.22 · Capacitor 移动端
        </p>
      </div>
    </div>
  )
}

/**
 * 检查是否需要显示服务器配置页面（仅移动端）
 */
export function shouldShowServerConfig(): boolean {
  return Capacitor.isNativePlatform()
}
