import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { X, Loader2, List, ChevronUp, MapPin } from 'lucide-react'
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

// 判断是否手机端（与项目 CSS 断点一致：768px）
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

/**
 * 高德地铁图 JS API 组件
 *
 * 官方文档：https://lbs.amap.com/api/subway-api/subway-summary
 * 参考手册：https://lbs.amap.com/api/subway-api/mobility-reference
 *
 * 实现方式：用 iframe 加载独立的 subway.html 页面，实现完全的 CSS 隔离。
 * 优点：
 * 1. 地铁图注入的 CSS 完全不影响父页面（解决 tab 栏变形问题）
 * 2. 城市切换在 iframe 内部处理（destroy + 重新创建实例），通过 postMessage 通信
 * 3. 线路列表通过 postMessage 传递到父页面，在工具栏下方显示
 *
 * 布局：
 * - 电脑端：top: calc(var(--nav-h) + 44px), bottom: 0（无底部导航栏）
 * - 手机端：top: calc(var(--nav-h) + 44px), bottom: var(--bottom-nav-h)（底部导航栏上方）
 */
export default function SubwayMapView({ onClose }: SubwayMapViewProps) {
  const amapKey = useSettingsStore(s => s.settings.amap_key || '')
  const amapSecurityCode = useSettingsStore(s => s.settings.amap_security_code || '')
  const isMobile = useIsMobile()

  const [selectedAdcode, setSelectedAdcode] = useState<string>(SUBWAY_CITIES[0].adcode)
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [lineList, setLineList] = useState<any[]>([])
  const [showLinePanel, setShowLinePanel] = useState<boolean>(false)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const iframeReadyRef = useRef<boolean>(false)

  // 构造 iframe src（只在 amapKey 变化时重新加载 iframe，不包含 selectedAdcode）
  // 首次加载的 adcode 通过 URL 参数传递，之后切换城市通过 postMessage
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      key: amapKey,
      securityCode: amapSecurityCode,
      adcode: selectedAdcode,
    })
    return `${import.meta.env.BASE_URL}subway.html?${params.toString()}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amapKey, amapSecurityCode])

  // ── 监听 iframe 的 postMessage 消息 ──────────────────────────────────
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data || typeof e.data.type !== 'string') return
      switch (e.data.type) {
        case 'subwayReady':
          iframeReadyRef.current = true
          break
        case 'subwayComplete':
          setLoading(false)
          setErrorMsg('')
          break
        case 'subwayLoading':
          setLoading(true)
          setLineList([])
          break
        case 'subwayFail':
        case 'subwayError':
        case 'subwayTimeout':
          setErrorMsg(e.data.msg || '地铁图加载失败')
          setLoading(false)
          break
        case 'subwayLineList':
          if (e.data.lines && Array.isArray(e.data.lines)) {
            setLineList(e.data.lines)
          }
          break
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // ── 城市切换：通过 postMessage 通知 iframe ───────────────────────────
  // 首次挂载时跳过（iframe 还没就绪），只在用户切换城市时触发
  useEffect(() => {
    if (!iframeReadyRef.current) return
    iframeRef.current?.contentWindow?.postMessage({
      type: 'switchCity',
      adcode: selectedAdcode,
    }, '*')
    setLoading(true)
    setLineList([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAdcode])

  // ── 点击线路项：高亮该线路 ───────────────────────────────────────────
  const handleLineClick = useCallback((line: any) => {
    const name = line.name || line.lineName || line.title
    if (!name || !iframeRef.current?.contentWindow) return
    iframeRef.current.contentWindow.postMessage({
      type: 'showLine',
      lineName: name,
    }, '*')
  }, [])

  // ── 未配置 amap_key：显示提示信息 ──────────────────────────────────
  if (!amapKey) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 'calc(var(--nav-h) + 44px)', left: 0, right: 0,
          bottom: 'var(--bottom-nav-h)',
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

  // 工具栏样式（手机端/电脑端适配）
  const toolbarPadding = isMobile ? '6px 10px' : '8px 14px'
  const toolbarFontSize = isMobile ? 12 : 13
  const selectMinWidth = isMobile ? 90 : 120
  const linePanelMaxHeight = isMobile ? 140 : 240
  const lineItemFontSize = isMobile ? 11 : 12

  return (
    <div
      style={{
        // 定位在 Navbar + Tab 栏下方，底部导航栏上方
        position: 'fixed',
        top: 'calc(var(--nav-h) + 44px)', left: 0, right: 0,
        bottom: 'var(--bottom-nav-h)',
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
          padding: toolbarPadding,
          borderBottom: '1px solid #f0f0f0',
          background: '#ffffff',
          flexShrink: 0,
          gap: 6,
        }}
      >
        {/* 左侧：城市选择器 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: toolbarFontSize, fontWeight: 600, color: '#111827' }}>城市</span>
          <select
            value={selectedAdcode}
            onChange={e => setSelectedAdcode(e.target.value)}
            style={{
              padding: isMobile ? '5px 8px' : '6px 10px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#ffffff',
              color: '#111827',
              fontSize: toolbarFontSize,
              outline: 'none',
              cursor: 'pointer',
              minWidth: selectMinWidth,
              maxWidth: isMobile ? 110 : 'none',
            }}
          >
            {SUBWAY_CITIES.map(city => (
              <option key={city.adcode} value={city.adcode}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        {/* 右侧：线路列表按钮 + 关闭按钮 */}
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
                padding: isMobile ? '5px 8px' : '6px 10px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: showLinePanel ? '#f3f4f6' : '#ffffff',
                color: '#374151',
                fontSize: toolbarFontSize,
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
              width: isMobile ? 28 : 32,
              height: isMobile ? 28 : 32,
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
            <X size={isMobile ? 16 : 18} />
          </button>
        </div>
      </div>

      {/* ── 线路列表面板（可折叠，帮助用户识别线路名称）────────────── */}
      {showLinePanel && lineList.length > 0 && (
        <div
          style={{
            maxHeight: linePanelMaxHeight,
            overflowY: 'auto',
            borderBottom: '1px solid #f0f0f0',
            background: '#fafafa',
            padding: isMobile ? '6px 10px' : '8px 14px',
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
                onClick={() => handleLineClick(line)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: isMobile ? '3px 6px' : '3px 8px',
                  borderRadius: 4,
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  fontSize: lineItemFontSize,
                  color: '#374151',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
              >
                <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                <span>{name}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 地铁图显示区域（iframe 隔离 CSS）────────────────────────── */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="地铁图"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          allowFullScreen
        />

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
              fontSize: isMobile ? 12 : 13,
              gap: 10,
              pointerEvents: 'none',
            }}
          >
            <Loader2 size={isMobile ? 24 : 28} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
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
              fontSize: isMobile ? 12 : 13,
              textAlign: 'center',
              padding: 20,
              gap: 12,
            }}
          >
            <div>{errorMsg}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>
              请确认：1) 已配置高德 JS API 密钥（amap_key）<br/>
              2) 密钥已开通地铁图服务<br/>
              3) 已更新到最新版本（v3.0.22-cn.37+）<br/>
              4) 清除浏览器缓存后重试（Ctrl+Shift+R）
            </div>
          </div>
        )}

        {/* 路线规划提示（右下角） */}
        {!loading && !errorMsg && (
          <div
            style={{
              position: 'absolute',
              right: isMobile ? 8 : 12,
              bottom: isMobile ? 8 : 12,
              padding: isMobile ? '5px 8px' : '6px 10px',
              borderRadius: 6,
              background: 'rgba(0, 0, 0, 0.6)',
              color: '#ffffff',
              fontSize: isMobile ? 10 : 11,
              pointerEvents: 'none',
              maxWidth: isMobile ? 160 : 220,
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <MapPin size={isMobile ? 10 : 12} style={{ flexShrink: 0 }} />
            <span>点击站点设为起终点，查看路线规划</span>
          </div>
        )}
      </div>
    </div>
  )
}
