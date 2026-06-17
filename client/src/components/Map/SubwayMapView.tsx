import { useEffect, useRef, useState } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'
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

// ── AMap 命名空间类型简写（loader 注入的全局对象）─────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
type AMapNS = any
type SubwayInstance = any

export default function SubwayMapView({ onClose }: SubwayMapViewProps) {
  // 从设置 store 获取高德密钥与安全密钥
  const amapKey = useSettingsStore(s => s.settings.amap_key || '')
  const amapSecurityCode = useSettingsStore(s => s.settings.amap_security_code || '')

  // 默认选择第一个城市（北京）
  const [selectedAdcode, setSelectedAdcode] = useState<string>(SUBWAY_CITIES[0].adcode)
  // 加载状态：true 表示正在加载地铁图
  const [loading, setLoading] = useState<boolean>(false)
  // 加载错误信息（如有）
  const [errorMsg, setErrorMsg] = useState<string>('')

  // 地铁图容器 DOM 引用
  const containerRef = useRef<HTMLDivElement>(null)
  // 当前地铁图实例引用（用于卸载时清理）
  const subwayRef = useRef<SubwayInstance | null>(null)
  // AMap 命名空间引用（用于卸载时清理）
  const AMapRef = useRef<AMapNS | null>(null)

  // ── 加载地铁图的核心 effect：依赖 amapKey 与 selectedAdcode ──────────
  useEffect(() => {
    if (!amapKey || !containerRef.current) return

    if (amapSecurityCode) {
      ;(window as any)._AMapSecurityConfig = { securityJsCode: amapSecurityCode }
    }

    let destroyed = false
    setLoading(true)
    setErrorMsg('')

    AMapLoader.load({
      key: amapKey,
      version: '2.0',
      plugins: [],
    })
      .then((AMap: AMapNS) => {
        if (destroyed || !containerRef.current) return
        AMapRef.current = AMap

        // Load Subway plugin separately
        AMap.plugin('AMap.Subway', () => {
          if (destroyed || !containerRef.current) return

          try {
            const subway = new AMap.Subway(containerRef.current, selectedAdcode, {
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

            subway.event.on('subwayClick', (_ev: any) => {
              // 点击站点时的回调占位
            })
          } catch (err) {
            if (destroyed) return
            console.error('[SubwayMapView] Failed to create Subway instance:', err)
            setErrorMsg('地铁图加载失败，请检查密钥配置是否正确')
            setLoading(false)
          }
        })

        // Timeout fallback: if subway doesn't load in 10 seconds, show error
        const timeout = setTimeout(() => {
          if (destroyed) return
          if (subwayRef.current) return // already loaded
          setLoading(false)
          setErrorMsg('地铁图加载超时，请检查网络连接')
        }, 10000)
        // Store timeout for cleanup
        ;(containerRef.current as any).__subwayTimeout = timeout
      })
      .catch((err: any) => {
        if (destroyed) return
        console.error('[SubwayMapView] AMap load failed:', err)
        setErrorMsg('地铁图加载失败，请检查网络或密钥配置')
        setLoading(false)
      })

    return () => {
      destroyed = true
      if (containerRef.current && (containerRef.current as any).__subwayTimeout) {
        clearTimeout((containerRef.current as any).__subwayTimeout)
      }
      if (subwayRef.current) {
        try { subwayRef.current.destroy?.() } catch { /* 忽略销毁异常 */ }
        subwayRef.current = null
      }
      AMapRef.current = null
    }
  }, [amapKey, amapSecurityCode, selectedAdcode])

  // ── 未配置 amap_key：显示提示信息 ──────────────────────────────────
  if (!amapKey) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
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
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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

        {/* 加载中遮罩：显示 loading 动画 */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
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
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
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
