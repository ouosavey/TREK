import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Loader2, List, ChevronDown, ChevronUp } from 'lucide-react'
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

// 容器 id（高德地铁图 API 的 subway() 第一个参数要求传入容器的 id 字符串，不是 DOM 元素）
const SUBWAY_CONTAINER_ID = 'subway-map-container'

/**
 * 高德地铁图 JS API 组件
 *
 * 官方文档：https://lbs.amap.com/api/subway-api/subway-summary
 * 参考手册：https://lbs.amap.com/api/subway-api/mobility-reference
 *
 * 关键点：
 * 1. subway 全局函数仅在 cbk 回调内可用，必须在 cbk 内创建实例。
 * 2. subway(id, opts) 的第一个参数是容器的 **id 字符串**（不是 DOM 元素）。
 * 3. 切换城市：保存 subwayFn，切换时 destroy 旧实例 + 重新创建（不重新加载脚本）。
 * 4. 地铁图定位在 Navbar + Tab 栏下方，不遮挡顶部菜单。
 * 5. 卸载时清理地铁图注入的全局 CSS，避免污染 tab 栏等页面元素。
 */
export default function SubwayMapView({ onClose }: SubwayMapViewProps) {
  const amapKey = useSettingsStore(s => s.settings.amap_key || '')
  const amapSecurityCode = useSettingsStore(s => s.settings.amap_security_code || '')

  const [selectedAdcode, setSelectedAdcode] = useState<string>(SUBWAY_CITIES[0].adcode)
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [lineList, setLineList] = useState<any[]>([])
  const [showLinePanel, setShowLinePanel] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const subwayRef = useRef<any>(null)
  const subwayFnRef = useRef<any>(null)        // 保存 subwayFn（用于切换城市时重新创建实例）
  const scriptRef = useRef<HTMLScriptElement | null>(null)
  const instanceReadyRef = useRef<boolean>(false)

  // ── 创建/重建地铁图实例的函数（可复用，用于首次创建和切换城市）─────────
  const createSubwayInstance = useCallback((adcode: string) => {
    if (!subwayFnRef.current || !containerRef.current) return

    // 销毁旧实例
    if (subwayRef.current) {
      try { subwayRef.current.destroy?.() } catch { /* 忽略 */ }
      subwayRef.current = null
    }

    // 清空容器
    containerRef.current.innerHTML = ''

    try {
      // 创建新实例：subway(id, opts)，第一个参数是容器的 id 字符串
      const subway = subwayFnRef.current(SUBWAY_CONTAINER_ID, {
        adcode: adcode,
        easy: 1,
      })
      subwayRef.current = subway

      // 地铁图加载完成事件
      subway.event.on('subway.complete', () => {
        setLoading(false)
        setErrorMsg('')
        // 获取线路列表（用于线路列表面板，帮助用户识别线路名称）
        try {
          subway.getLineList?.((lines: any[]) => {
            if (lines && Array.isArray(lines)) {
              setLineList(lines)
            }
          })
        } catch { /* 忽略 */ }
      })

      subway.event.on('subway.fail', () => {
        setErrorMsg('地铁图数据加载失败，该城市可能暂不支持')
        setLoading(false)
      })
    } catch (err) {
      console.error('[SubwayMapView] Failed to create subway instance:', err)
      setErrorMsg('地铁图加载失败：' + String(err))
      setLoading(false)
    }
  }, [])

  // ── 主 useEffect：加载脚本（只在 amapKey 变化时执行）──────────────────
  useEffect(() => {
    if (!amapKey || !containerRef.current) return

    // ── 保存全局状态（用于卸载时恢复，避免地铁图 CSS 污染 tab 栏）────────
    const viewportMeta = document.querySelector('meta[name="viewport"]')
    const originalViewport = viewportMeta?.getAttribute('content') || ''
    const originalBodyClass = document.body.className
    const originalBodyStyle = document.body.style.cssText
    // 记录挂载前已存在的 style 标签（用于卸载时识别新增的）
    const existingStyles = new Set<Element>(Array.from(document.head.querySelectorAll('style')))

    // 安全密钥配置
    if (amapSecurityCode) {
      ;(window as any)._AMapSecurityConfig = { securityJsCode: amapSecurityCode }
    }

    let destroyed = false
    let loadCompleted = false
    setLoading(true)
    setErrorMsg('')
    setLineList([])
    instanceReadyRef.current = false

    // 清理旧实例和旧脚本
    if (subwayRef.current) {
      try { subwayRef.current.destroy?.() } catch { /* 忽略 */ }
      subwayRef.current = null
    }
    if (scriptRef.current) {
      scriptRef.current.remove()
      scriptRef.current = null
    }
    try { delete (window as any).cbk } catch { (window as any).cbk = undefined }

    // ── 定义 cbk 回调：subway 全局函数仅在此回调内可用 ──────────────
    (window as any).cbk = function() {
      if (destroyed || !containerRef.current) return

      try {
        const subwayFn = (window as any).subway || (window as any).Subway
        if (!subwayFn || typeof subwayFn !== 'function') {
          console.error('[SubwayMapView] subway function not found in cbk callback')
          setErrorMsg('地铁图组件未就绪，请检查密钥是否已开通地铁图服务')
          loadCompleted = true
          setLoading(false)
          return
        }

        // 保存 subwayFn 到 ref（用于后续切换城市时重新创建实例）
        subwayFnRef.current = subwayFn

        // 创建实例
        createSubwayInstance(selectedAdcode)
        instanceReadyRef.current = true
      } catch (err) {
        if (destroyed) return
        console.error('[SubwayMapView] Failed to create subway instance:', err)
        loadCompleted = true
        setErrorMsg('地铁图加载失败：' + String(err))
        setLoading(false)
      }
    }

    // 加载地铁图脚本
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/subway?v=1.0&key=${encodeURIComponent(amapKey)}&callback=cbk`
    script.async = true
    scriptRef.current = script

    script.onerror = () => {
      if (destroyed) return
      console.error('[SubwayMapView] Script load error (network)')
      loadCompleted = true
      setErrorMsg('地铁图脚本加载失败，请检查网络连接')
      setLoading(false)
    }

    document.head.appendChild(script)

    // 超时兜底（15秒）
    const timeoutId = setTimeout(() => {
      if (destroyed) return
      if (!loadCompleted) {
        console.error('[SubwayMapView] Load timeout (15s)')
        loadCompleted = true
        setErrorMsg('地铁图加载超时，请检查网络或密钥配置')
        setLoading(false)
      }
    }, 15000)

    return () => {
      destroyed = true
      clearTimeout(timeoutId)
      try { delete (window as any).cbk } catch { (window as any).cbk = undefined }
      if (subwayRef.current) {
        try { subwayRef.current.destroy?.() } catch { /* 忽略 */ }
        subwayRef.current = null
      }
      if (scriptRef.current) {
        scriptRef.current.remove()
        scriptRef.current = null
      }
      instanceReadyRef.current = false
      subwayFnRef.current = null

      // ── 恢复全局状态，清理地铁图注入的 CSS（避免污染 tab 栏）──────────
      // 1. 恢复 viewport meta
      if (viewportMeta && originalViewport) {
        viewportMeta.setAttribute('content', originalViewport)
      }
      // 2. 恢复 body 的 className 和 style
      document.body.className = originalBodyClass
      document.body.style.cssText = originalBodyStyle
      // 3. 移除地铁图脚本注入的 style 标签
      const currentStyles = document.head.querySelectorAll('style')
      currentStyles.forEach(style => {
        if (!existingStyles.has(style)) {
          const text = style.textContent || ''
          // 只移除地铁图/高德相关的样式
          if (text.includes('amap') || text.includes('subway') || text.includes('BMap')) {
            style.remove()
          }
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amapKey, amapSecurityCode])

  // ── 副 useEffect：切换城市（用销毁重建，不重新加载脚本）──────────────
  useEffect(() => {
    // 只在实例已创建后才处理城市切换（首次挂载时跳过）
    if (!instanceReadyRef.current || !subwayFnRef.current) return
    setLoading(true)
    setLineList([])
    createSubwayInstance(selectedAdcode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAdcode])

  // ── 未配置 amap_key：显示提示信息 ──────────────────────────────────
  if (!amapKey) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 'calc(var(--nav-h) + 44px)', left: 0, right: 0, bottom: 0,
          zIndex: 2000,
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-system)',
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
        // 定位在 Navbar + Tab 栏下方，不遮挡顶部菜单和 tab 栏
        position: 'fixed',
        top: 'calc(var(--nav-h) + 44px)', left: 0, right: 0, bottom: 0,
        zIndex: 2000,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-system)',
      }}
    >
      {/* ── 顶部工具栏：城市选择器 + 线路列表按钮 + 关闭按钮 ─────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          borderBottom: '1px solid #f0f0f0',
          background: '#ffffff',
          flexShrink: 0,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
              minWidth: 100,
            }}
          >
            {SUBWAY_CITIES.map(city => (
              <option key={city.adcode} value={city.adcode}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* 线路列表按钮 */}
          {lineList.length > 0 && (
            <button
              onClick={() => setShowLinePanel(v => !v)}
              title="查看线路列表"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: showLinePanel ? '#f3f4f6' : '#ffffff',
                color: '#374151',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {showLinePanel ? <ChevronUp size={14} /> : <List size={14} />}
              <span>线路</span>
            </button>
          )}

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
      </div>

      {/* ── 线路列表面板（可折叠，帮助用户识别线路名称）────────────── */}
      {showLinePanel && lineList.length > 0 && (
        <div
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            borderBottom: '1px solid #f0f0f0',
            background: '#fafafa',
            padding: '8px 14px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            flexShrink: 0,
          }}
        >
          {lineList.map((line: any, idx: number) => {
            const name = line.name || line.lineName || line.title || String(line)
            const color = line.color || line.lineColor || '#3b82f6'
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  fontSize: 12,
                  color: '#374151',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                <span>{name}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 地铁图显示区域 ──────────────────────────────────────────── */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* 容器必须有 id，高德地铁图 API 的 subway(id, opts) 通过 id 查找此元素 */}
        <div id={SUBWAY_CONTAINER_ID} ref={containerRef} style={{ width: '100%', height: '100%' }} />

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
              3) 已更新到最新版本（v3.0.22-cn.35+）<br/>
              4) 清除浏览器缓存后重试（Ctrl+Shift+R）
            </div>
          </div>
        )}

        {/* 路线规划提示（右下角） */}
        {!loading && !errorMsg && (
          <div
            style={{
              position: 'absolute',
              right: 10,
              bottom: 10,
              padding: '6px 10px',
              borderRadius: 6,
              background: 'rgba(0, 0, 0, 0.6)',
              color: '#ffffff',
              fontSize: 11,
              pointerEvents: 'none',
              maxWidth: 200,
              textAlign: 'center',
            }}
          >
            点击站点设为起点/终点，查看路线规划
          </div>
        )}
      </div>
    </div>
  )
}
