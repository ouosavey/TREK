import { useEffect, useRef, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'

// ── 支持地铁图的城市列表（城市名 + 行政区划编码 adcode）──────────────────
// 注意：高德地铁图 API 的 adcode 是 4 位（如北京 1100），不是 6 位
const SUBWAY_CITIES = [
  { name: '北京', adcode: '1100' },
  { name: '上海', adcode: '3100' },
  { name: '广州', adcode: '4401' },
  { name: '深圳', adcode: '4403' },
  { name: '成都', adcode: '5101' },
  { name: '杭州', adcode: '3301' },
  { name: '武汉', adcode: '4201' },
  { name: '西安', adcode: '6101' },
  { name: '南京', adcode: '3201' },
  { name: '重庆', adcode: '5000' },
  { name: '天津', adcode: '1200' },
  { name: '苏州', adcode: '3205' },
  { name: '郑州', adcode: '4101' },
  { name: '大连', adcode: '2102' },
  { name: '长沙', adcode: '4301' },
  { name: '昆明', adcode: '5301' },
  { name: '宁波', adcode: '3302' },
  { name: '合肥', adcode: '3401' },
  { name: '青岛', adcode: '3702' },
  { name: '南昌', adcode: '3601' },
  { name: '福州', adcode: '3501' },
  { name: '东莞', adcode: '4419' },
  { name: '南宁', adcode: '4501' },
  { name: '长春', adcode: '2201' },
  { name: '贵阳', adcode: '5201' },
  { name: '无锡', adcode: '3202' },
  { name: '厦门', adcode: '3502' },
  { name: '石家庄', adcode: '1301' },
  { name: '太原', adcode: '1401' },
  { name: '乌鲁木齐', adcode: '6501' },
]

// ── 组件接口 ──────────────────────────────────────────────────────────
interface SubwayMapViewProps {
  onClose: () => void
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 高德地铁图 JS API 组件
 *
 * 官方文档：https://lbs.amap.com/api/subway-api/subway-summary
 *
 * 实现方式：直接在主文档中加载地铁图脚本（不用 iframe，避免 sandbox 和 frameSrc CSP 问题）。
 * 关键点：subway 全局函数仅在 cbk 回调内可用，必须在 cbk 内创建实例。
 */
export default function SubwayMapView({ onClose }: SubwayMapViewProps) {
  const amapKey = useSettingsStore(s => s.settings.amap_key || '')
  const amapSecurityCode = useSettingsStore(s => s.settings.amap_security_code || '')

  const [selectedAdcode, setSelectedAdcode] = useState<string>(SUBWAY_CITIES[0].adcode)
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string>('')

  const containerRef = useRef<HTMLDivElement>(null)
  const subwayRef = useRef<any>(null)
  const scriptRef = useRef<HTMLScriptElement | null>(null)

  useEffect(() => {
    if (!amapKey || !containerRef.current) return

    // 安全密钥配置
    if (amapSecurityCode) {
      ;(window as any)._AMapSecurityConfig = { securityJsCode: amapSecurityCode }
    }

    let destroyed = false
    setLoading(true)
    setErrorMsg('')

    // 清理旧实例和旧脚本
    if (subwayRef.current) {
      try { subwayRef.current.destroy?.() } catch { /* 忽略 */ }
      subwayRef.current = null
    }
    if (scriptRef.current) {
      scriptRef.current.remove()
      scriptRef.current = null
    }
    // 清理旧的 cbk
    try { delete (window as any).cbk } catch { (window as any).cbk = undefined }

    // ── 定义 cbk 回调：subway 全局函数仅在此回调内可用 ──────────────
    // 脚本加载完成后会调用 window.cbk()，此时 subway 函数已定义
    (window as any).cbk = function() {
      if (destroyed || !containerRef.current) return

      try {
        // subway 是全局函数（不是 window.subway 属性，而是脚本内定义的全局函数）
        // 在 cbk 回调内可以直接调用
        const subwayFn = (window as any).subway || (window as any).Subway
        if (!subwayFn || typeof subwayFn !== 'function') {
          console.error('[SubwayMapView] subway function not found in cbk callback')
          setErrorMsg('地铁图组件未就绪，请检查密钥是否已开通地铁图服务')
          setLoading(false)
          return
        }

        // 清空容器
        containerRef.current.innerHTML = ''

        // 创建地铁图实例：subway(container, { adcode, easy: 1 })
        const subway = subwayFn(containerRef.current, {
          adcode: selectedAdcode,
          easy: 1,
        })
        subwayRef.current = subway

        // 地铁图加载完成事件（事件名是 "subway.complete"，带点）
        subway.event.on('subway.complete', () => {
          if (destroyed) return
          setLoading(false)
          setErrorMsg('')
        })

        subway.event.on('subway.fail', () => {
          if (destroyed) return
          setErrorMsg('地铁图数据加载失败，该城市可能暂不支持')
          setLoading(false)
        })
      } catch (err) {
        if (destroyed) return
        console.error('[SubwayMapView] Failed to create subway instance:', err)
        setErrorMsg('地铁图加载失败：' + String(err))
        setLoading(false)
      }
    }

    // ── 加载地铁图脚本 ──────────────────────────────────────────────
    // 脚本 URL：https://webapi.amap.com/subway?v=1.0&key=xxx&callback=cbk
    // 加载完成后会调用 window.cbk()
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/subway?v=1.0&key=${encodeURIComponent(amapKey)}&callback=cbk`
    script.async = true
    scriptRef.current = script

    script.onerror = () => {
      if (destroyed) return
      console.error('[SubwayMapView] Script load error (network)')
      setErrorMsg('地铁图脚本加载失败，请检查网络连接')
      setLoading(false)
    }

    document.head.appendChild(script)

    // ── 超时兜底（15秒）────────────────────────────────────────────
    const timeoutId = setTimeout(() => {
      if (destroyed) return
      if (loading) {
        console.error('[SubwayMapView] Load timeout (15s)')
        setErrorMsg('地铁图加载超时，请检查网络或密钥配置')
        setLoading(false)
      }
    }, 15000)

    return () => {
      destroyed = true
      clearTimeout(timeoutId)
      // 清理 cbk 回调
      try { delete (window as any).cbk } catch { (window as any).cbk = undefined }
      // 清理地铁图实例
      if (subwayRef.current) {
        try { subwayRef.current.destroy?.() } catch { /* 忽略 */ }
        subwayRef.current = null
      }
      // 移除脚本
      if (scriptRef.current) {
        scriptRef.current.remove()
        scriptRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amapKey, amapSecurityCode, selectedAdcode])

  // ── 未配置 amap_key：显示提示信息 ──────────────────────────────────
  if (!amapKey) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 2000,
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 8 }}>
          未配置高德地图密钥（amap_key）
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 24 }}>
          请前往 设置 → 地图 → 高德地图 进行配置
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '8px 20px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            background: '#ffffff',
            color: '#374151',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          关闭
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 2000,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
      }}
    >
      {/* ── 顶部工具栏：城市选择器 + 关闭按钮 ───────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid #f0f0f0',
          background: '#ffffff',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>城市</span>
          <select
            value={selectedAdcode}
            onChange={e => setSelectedAdcode(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#ffffff',
              color: '#111827',
              fontSize: 13,
              outline: 'none',
              cursor: 'pointer',
              minWidth: 120,
            }}
          >
            {SUBWAY_CITIES.map(city => (
              <option key={city.adcode} value={city.adcode}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onClose}
          title="关闭"
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <X size={18} />
        </button>
      </div>

      {/* ── 地铁图显示区域 ──────────────────────────────────────────── */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* 加载中遮罩 */}
        {loading && !errorMsg && (
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.85)',
              color: '#6b7280',
              fontSize: 13,
              gap: 10,
              pointerEvents: 'none',
            }}
          >
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
            <span>正在加载地铁图…</span>
          </div>
        )}

        {/* 加载错误提示 */}
        {errorMsg && (
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              fontSize: 13,
              textAlign: 'center',
              padding: 20,
              gap: 12,
            }}
          >
            <div>{errorMsg}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>
              请确认：1) 已配置高德 JS API 密钥（amap_key）<br/>
              2) 密钥已开通地铁图服务<br/>
              3) 已更新到最新版本（v3.0.22-cn.33+）<br/>
              4) 清除浏览器缓存后重试（Ctrl+Shift+R）
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
