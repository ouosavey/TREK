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

/**
 * 高德地铁图 JS API 组件
 *
 * 官方文档：https://lbs.amap.com/api/subway-api/subway-summary
 *
 * 实现方式：使用 iframe 加载完整的 HTML 页面，严格遵循官方示例模式。
 * 地铁图 JS API 是 JSONP 风格，subway 全局函数在 cbk 回调内可用。
 * 使用 iframe 可以隔离全局变量，避免与主应用的 AMap JS API 冲突。
 */
export default function SubwayMapView({ onClose }: SubwayMapViewProps) {
  const amapKey = useSettingsStore(s => s.settings.amap_key || '')
  const amapSecurityCode = useSettingsStore(s => s.settings.amap_security_code || '')

  const [selectedAdcode, setSelectedAdcode] = useState<string>(SUBWAY_CITIES[0].adcode)
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string>('')

  const iframeRef = useRef<HTMLIFrameElement>(null)

  // ── 生成地铁图 HTML 内容（严格遵循官方示例）──────────────────────────
  function generateSubwayHtml(adcode: string): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<!--重要meta, 必须!-->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, shrink-to-fit=no"/>
<title>地铁图</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  #mysubway { width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="mysubway"></div>
<script type="text/javascript">
  // 安全密钥配置（如果有的话）
  ${amapSecurityCode ? `window._AMapSecurityConfig = { securityJsCode: '${amapSecurityCode}' };` : ''}

  // 开启 easy 模式，直接完成地铁图基本功能
  // adcode 参数指定城市
  window.cbk = function() {
    try {
      var mysubway = subway("mysubway", {
        adcode: "${adcode}",
        easy: 1
      });
      // 地铁图加载完成事件
      mysubway.event.on("subway.complete", function() {
        // 通知父窗口加载完成
        window.parent.postMessage({ type: 'subway_complete' }, '*');
      });
      mysubway.event.on("subway.fail", function() {
        window.parent.postMessage({ type: 'subway_fail' }, '*');
      });
      // 通知父窗口 subway 已就绪
      window.parent.postMessage({ type: 'subway_ready' }, '*');
    } catch (err) {
      window.parent.postMessage({ type: 'subway_error', message: String(err) }, '*');
    }
  };
</script>
<script type="text/javascript" src="https://webapi.amap.com/subway?v=1.0&key=${amapKey}&callback=cbk"></script>
</body>
</html>`
  }

  // ── 监听 iframe 的 postMessage 事件 ─────────────────────────────────
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== 'object') return
      const msg = e.data as { type: string; message?: string }
      if (msg.type === 'subway_ready' || msg.type === 'subway_complete') {
        setLoading(false)
        setErrorMsg('')
      } else if (msg.type === 'subway_fail') {
        setLoading(false)
        setErrorMsg('地铁图数据加载失败，该城市可能暂不支持')
      } else if (msg.type === 'subway_error') {
        setLoading(false)
        setErrorMsg('地铁图加载失败：' + (msg.message || '未知错误'))
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // ── 当城市切换时，重新加载 iframe ────────────────────────────────────
  useEffect(() => {
    if (!amapKey || !iframeRef.current) return

    setLoading(true)
    setErrorMsg('')

    const html = generateSubwayHtml(selectedAdcode)
    const iframe = iframeRef.current

    // 使用 srcdoc 加载 HTML 内容
    iframe.srcdoc = html

    // 超时兜底（15秒）
    const timeoutId = setTimeout(() => {
      setLoading(prev => {
        // 如果还在 loading，说明没有收到 subway_ready 消息
        return prev
      })
      setErrorMsg('地铁图加载超时，请检查网络或密钥配置')
      setLoading(false)
    }, 15000)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amapKey, selectedAdcode, amapSecurityCode])

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

      {/* ── 地铁图显示区域（iframe）──────────────────────────────────── */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <iframe
          ref={iframeRef}
          title="地铁图"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: errorMsg ? 'none' : 'block',
          }}
          sandbox="allow-scripts allow-same-origin allow-popups"
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
              请确认已配置高德 JS API 密钥（amap_key），且密钥已开通地铁图服务
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
