import { useEffect, useRef, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'

// ── 支持地铁图的城市列表（城市名 + 行政区划编码 adcode）──────────────────
const SUBWAY_CITIES = [
  { name: '北京', adcode: '110000' },
  { name: '上海', adcode: '310000' },
  { name: '广州', adcode: '440100' },
  { name: '深圳', adcode: '440300' },
  { name: '成都', adcode: '510100' },
  { name: '杭州', adcode: '330100' },
  { name: '武汉', adcode: '420100' },
  { name: '西安', adcode: '610100' },
  { name: '南京', adcode: '320100' },
  { name: '重庆', adcode: '500000' },
  { name: '天津', adcode: '120000' },
  { name: '苏州', adcode: '320500' },
  { name: '郑州', adcode: '410100' },
  { name: '大连', adcode: '210200' },
  { name: '长沙', adcode: '430100' },
  { name: '昆明', adcode: '530100' },
  { name: '宁波', adcode: '330200' },
  { name: '合肥', adcode: '340100' },
  { name: '青岛', adcode: '370200' },
  { name: '南昌', adcode: '360100' },
  { name: '福州', adcode: '350100' },
  { name: '东莞', adcode: '441900' },
  { name: '南宁', adcode: '450100' },
  { name: '长春', adcode: '220100' },
  { name: '贵阳', adcode: '520100' },
  { name: '无锡', adcode: '320200' },
  { name: '厦门', adcode: '350200' },
  { name: '石家庄', adcode: '130100' },
  { name: '太原', adcode: '140100' },
  { name: '乌鲁木齐', adcode: '650100' },
]

// ── 组件接口 ──────────────────────────────────────────────────────────
interface SubwayMapViewProps {
  onClose: () => void
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type SubwayInstance = any

// 全局脚本加载状态管理（避免重复加载）
let scriptLoadPromise: Promise<void> | null = null
let scriptLoaded = false

function loadSubwayScript(key: string): Promise<void> {
  if (scriptLoaded) return Promise.resolve()
  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/subway?v=1.0&key=${key}&callback=initSubway`
    script.async = true

    // 高德地铁图 JS 通过 callback 回调通知加载完成
    ;(window as any).initSubway = () => {
      scriptLoaded = true
      resolve()
    }

    script.onerror = () => {
      scriptLoadPromise = null
      reject(new Error('Failed to load subway script'))
    }

    // 超时兜底（10秒）
    setTimeout(() => {
      if (!scriptLoaded) {
        scriptLoadPromise = null
        reject(new Error('Subway script load timeout'))
      }
    }, 10000)

    document.head.appendChild(script)
  })

  return scriptLoadPromise
}

export default function SubwayMapView({ onClose }: SubwayMapViewProps) {
  const amapKey = useSettingsStore(s => s.settings.amap_key || '')
  const amapSecurityCode = useSettingsStore(s => s.settings.amap_security_code || '')

  const [selectedAdcode, setSelectedAdcode] = useState<string>(SUBWAY_CITIES[0].adcode)
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')

  const containerRef = useRef<HTMLDivElement>(null)
  const subwayRef = useRef<SubwayInstance | null>(null)

  useEffect(() => {
    if (!amapKey || !containerRef.current) return

    if (amapSecurityCode) {
      ;(window as any)._AMapSecurityConfig = { securityJsCode: amapSecurityCode }
    }

    let destroyed = false
    setLoading(true)
    setErrorMsg('')

    loadSubwayScript(amapKey)
      .then(() => {
        if (destroyed || !containerRef.current) return

        // 地铁图全局对象为 Subway（不是 AMap.Subway）
        const SubwayNS = (window as any).Subway
        if (!SubwayNS) {
          setErrorMsg('地铁图组件未就绪，请刷新重试')
          setLoading(false)
          return
        }

        try {
          // 清理旧实例
          if (subwayRef.current) {
            try { subwayRef.current.destroy?.() } catch { /* 忽略 */ }
            subwayRef.current = null
          }
          // 清空容器
          containerRef.current.innerHTML = ''

          const subway = new SubwayNS(containerRef.current, selectedAdcode, {
            easy: 1,
          })
          subwayRef.current = subway

          subway.event.on('subwayComplete', () => {
            if (destroyed) return
            setLoading(false)
          })

          subway.event.on('subwayFail', () => {
            if (destroyed) return
            setErrorMsg('地铁图数据加载失败，该城市可能暂不支持')
            setLoading(false)
          })
        } catch (err) {
          if (destroyed) return
          console.error('[SubwayMapView] Failed to create Subway instance:', err)
          setErrorMsg('地铁图加载失败，请检查密钥配置是否正确')
          setLoading(false)
        }
      })
      .catch((err: any) => {
        if (destroyed) return
        console.error('[SubwayMapView] Script load failed:', err)
        setErrorMsg('地铁图加载失败，请检查网络或密钥配置')
        setLoading(false)
      })

    return () => {
      destroyed = true
      if (subwayRef.current) {
        try { subwayRef.current.destroy?.() } catch { /* 忽略销毁异常 */ }
        subwayRef.current = null
      }
    }
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
        {loading && (
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
        {!loading && errorMsg && (
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              fontSize: 13,
              textAlign: 'center',
              padding: 20,
            }}
          >
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  )
}
