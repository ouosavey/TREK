import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Loader2, List, ChevronUp, MapPin } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'

// ── 支持地铁图的城市列表（城市名 + 行政区划编码 adcode）──────────────────
const SUBWAY_CITIES = [
  { name: '北京', adcode: '1100' }, { name: '上海', adcode: '3100' },
  { name: '广州', adcode: '4401' }, { name: '深圳', adcode: '4403' },
  { name: '成都', adcode: '5101' }, { name: '杭州', adcode: '3301' },
  { name: '武汉', adcode: '4201' }, { name: '西安', adcode: '6101' },
  { name: '南京', adcode: '3201' }, { name: '重庆', adcode: '5000' },
  { name: '天津', adcode: '1200' }, { name: '苏州', adcode: '3205' },
  { name: '郑州', adcode: '4101' }, { name: '大连', adcode: '2102' },
  { name: '长沙', adcode: '4301' }, { name: '昆明', adcode: '5301' },
  { name: '宁波', adcode: '3302' }, { name: '合肥', adcode: '3401' },
  { name: '青岛', adcode: '3702' }, { name: '南昌', adcode: '3601' },
  { name: '福州', adcode: '3501' }, { name: '东莞', adcode: '4419' },
  { name: '南宁', adcode: '4501' }, { name: '长春', adcode: '2201' },
  { name: '贵阳', adcode: '5201' }, { name: '无锡', adcode: '3202' },
  { name: '厦门', adcode: '3502' }, { name: '石家庄', adcode: '1301' },
  { name: '太原', adcode: '1401' }, { name: '乌鲁木齐', adcode: '6501' },
]

interface SubwayMapViewProps { onClose: () => void }

/* eslint-disable @typescript-eslint/no-explicit-any */

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
 * 实现方式：用 iframe 加载 Blob URL（内嵌 HTML 内容）。
 *
 * 为什么用 Blob URL：
 * - 不走网络请求 → PWA Service Worker 无法拦截（SW 只拦截 HTTP 请求）
 * - 不用 srcdoc → 避免 srcdoc 内嵌 JS 的语法错误难以调试
 * - CSS 完全隔离 → 地铁图注入的 CSS 不影响父页面 tab 栏
 * - frameSrc 已允许 blob: → CSP 不会阻止
 * - Blob 文档内添加 upgrade-insecure-requests → 地铁图 API 的 HTTP 请求自动升级为 HTTPS
 *
 * 通信：通过 postMessage 与父页面双向通信
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
  const blobUrlRef = useRef<string>('')

  // ── 创建 Blob URL（只在 amapKey 变化时重建）────────────────────────
  useEffect(() => {
    if (!amapKey) return

    // 清理旧的 blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = ''
    }

    // 安全地嵌入参数（用 JSON.stringify 转义特殊字符）
    const safeKey = JSON.stringify(amapKey)
    const safeAdcode = JSON.stringify(selectedAdcode)
    const secConfig = amapSecurityCode
      ? `window._AMapSecurityConfig = { securityJsCode: ${JSON.stringify(amapSecurityCode)} };`
      : ''

    // 构造完整的 HTML 文档（注意：JS 语法必须正确，括号必须匹配）
    const html = [
      '<!DOCTYPE html>',
      '<html lang="zh-CN"><head>',
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,minimum-scale=1.0,shrink-to-fit=no">',
      '<title>地铁图</title>',
      '<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">',
      '<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#fff}#sc{width:100%;height:100%}</style>',
      '</head><body><div id="sc"></div>',
      '<script>',
      '(function(){',
      'var key=' + safeKey + ';',
      secConfig,
      'var adcode=' + safeAdcode + ';',
      'var si=null,sf=null,cr=false,tid=null;',
      '',
      'function ci(a){',
      '  if(!sf) return;',
      '  cr=false;',
      '  if(si){ try{si.destroy()}catch(e){} si=null }',
      '  document.getElementById("sc").innerHTML="";',
      '  try{',
      '    console.log("[subway] creating instance adcode:",a);',
      '    si=sf("sc",{adcode:a,easy:1});',
      '    si.event.on("subway.complete",function(){',
      '      console.log("[subway] complete");',
      '      cr=true; if(tid){clearTimeout(tid);tid=null}',
      '      parent.postMessage({type:"subwayComplete"},"*");',
      '      try{',
      '        si.getLineList(function(l){',
      '          if(l&&Array.isArray(l)){ parent.postMessage({type:"subwayLineList",lines:l},"*"); }',
      '        });',
      '      }catch(e){}',
      '    });',
      '    si.event.on("subway.fail",function(){',
      '      if(tid){clearTimeout(tid);tid=null}',
      '      parent.postMessage({type:"subwayFail",msg:"地铁图数据加载失败，该城市可能暂不支持"},"*");',
      '    });',
      '  }catch(err){',
      '    if(tid){clearTimeout(tid);tid=null}',
      '    parent.postMessage({type:"subwayError",msg:"地铁图加载失败："+String(err)},"*");',
      '  }',
      '  if(tid){clearTimeout(tid)}',
      '  tid=setTimeout(function(){',
      '    if(!cr){ parent.postMessage({type:"subwayTimeout",msg:"地铁图加载超时，请检查网络或密钥配置"},"*"); }',
      '  },10000);',
      '}',
      '',
      'window.cbk=function(){',
      '  console.log("[subway] cbk invoked");',
      '  try{ sf=window.subway||window.Subway }catch(e){ sf=null }',
      '  if(!sf||typeof sf!=="function"){',
      '    parent.postMessage({type:"subwayError",msg:"地铁图组件未就绪，请检查密钥是否已开通地铁图服务"},"*");',
      '    return;',
      '  }',
      '  parent.postMessage({type:"subwayReady"},"*");',
      '  ci(adcode);',
      '};',
      '',
      'var s=document.createElement("script");',
      's.src="https://webapi.amap.com/subway?v=1.0&key="+encodeURIComponent(key)+"&callback=cbk";',
      's.async=true;',
      's.onerror=function(){ parent.postMessage({type:"subwayError",msg:"地铁图脚本加载失败，请检查网络连接"},"*"); };',
      'document.head.appendChild(s);',
      '',
      'window.addEventListener("message",function(e){',
      '  if(!e.data||typeof e.data.type!=="string") return;',
      '  if(e.data.type==="switchCity"){',
      '    adcode=e.data.adcode;',
      '    parent.postMessage({type:"subwayLoading"},"*");',
      '    ci(adcode);',
      '  } else if(e.data.type==="showLine"&&si&&e.data.lineName){',
      '    try{',
      '      si.showLine(e.data.lineName);',
      '      var c=si.getSelectedLineCenter&&si.getSelectedLineCenter();',
      '      if(c){ si.setCenter&&si.setCenter(c); }',
      '    }catch(e){}',
      '  }',
      '});',
      '',
      'setTimeout(function(){',
      '  if(!sf){ parent.postMessage({type:"subwayTimeout",msg:"地铁图加载超时，请检查网络或密钥配置"},"*"); }',
      '},15000);',
      '',
      '})();',
      '</script></body></html>',
    ].join('\n')

    const blob = new Blob([html], { type: 'text/html' })
    blobUrlRef.current = URL.createObjectURL(blob)

    // 重置状态
    setLoading(true)
    setErrorMsg('')
    setLineList([])
    iframeReadyRef.current = false

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = ''
      }
    }
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
    iframeRef.current.contentWindow.postMessage({ type: 'showLine', lineName: name }, '*')
  }, [])

  // ── 未配置 amap_key ──────────────────────────────────────────────────
  if (!amapKey) {
    return (
      <div style={{
        position: 'fixed', top: 'calc(var(--nav-h) + 44px)', left: 0, right: 0,
        bottom: 'var(--bottom-nav-h)', zIndex: 2000, background: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'var(--font-system)',
      }}>
        <div style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 8 }}>
          未配置高德地图密钥（amap_key）
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 24 }}>
          请前往 设置 → 地图 → 高德地图 进行配置
        </div>
        <button onClick={onClose} style={{
          padding: '8px 20px', borderRadius: 6, border: '1px solid #d1d5db',
          background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer',
        }}>关闭</button>
      </div>
    )
  }

  const toolbarPadding = isMobile ? '6px 10px' : '8px 14px'
  const toolbarFontSize = isMobile ? 12 : 13
  const selectMinWidth = isMobile ? 90 : 120
  const linePanelMaxHeight = isMobile ? 140 : 240
  const lineItemFontSize = isMobile ? 11 : 12

  return (
    <div style={{
      position: 'fixed', top: 'calc(var(--nav-h) + 44px)', left: 0, right: 0,
      bottom: 'var(--bottom-nav-h)', zIndex: 2000, background: '#fff',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-system)',
    }}>
      {/* 工具栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: toolbarPadding, borderBottom: '1px solid #f0f0f0',
        background: '#fff', flexShrink: 0, gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: toolbarFontSize, fontWeight: 600, color: '#111827' }}>城市</span>
          <select value={selectedAdcode} onChange={e => setSelectedAdcode(e.target.value)} style={{
            padding: isMobile ? '5px 8px' : '6px 10px', borderRadius: 6,
            border: '1px solid #d1d5db', background: '#fff', color: '#111827',
            fontSize: toolbarFontSize, outline: 'none', cursor: 'pointer',
            minWidth: selectMinWidth, maxWidth: isMobile ? 110 : 'none',
          }}>
            {SUBWAY_CITIES.map(city => (
              <option key={city.adcode} value={city.adcode}>{city.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {lineList.length > 0 && (
            <button onClick={() => setShowLinePanel(v => !v)} title="查看线路列表" style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: isMobile ? '5px 8px' : '6px 10px', borderRadius: 6,
              border: '1px solid #d1d5db', background: showLinePanel ? '#f3f4f6' : '#fff',
              color: '#374151', fontSize: toolbarFontSize, fontWeight: 500,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              {showLinePanel ? <ChevronUp size={14} /> : <List size={14} />}
              <span>线路</span>
            </button>
          )}
          <button onClick={onClose} title="关闭" style={{
            width: isMobile ? 28 : 32, height: isMobile ? 28 : 32,
            borderRadius: 6, border: 'none', background: 'transparent',
            color: '#6b7280', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          ><X size={isMobile ? 16 : 18} /></button>
        </div>
      </div>

      {/* 线路列表面板 */}
      {showLinePanel && lineList.length > 0 && (
        <div style={{
          maxHeight: linePanelMaxHeight, overflowY: 'auto',
          borderBottom: '1px solid #f0f0f0', background: '#fafafa',
          padding: isMobile ? '6px 10px' : '8px 14px',
          display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0,
        }}>
          {lineList.map((line: any, idx: number) => {
            const name = line.name || line.lineName || line.title || String(line)
            const color = line.color || line.lineColor || '#3b82f6'
            return (
              <div key={idx} onClick={() => handleLineClick(line)} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: isMobile ? '3px 6px' : '3px 8px', borderRadius: 4,
                background: '#fff', border: '1px solid #e5e7eb',
                fontSize: lineItemFontSize, color: '#374151',
                whiteSpace: 'nowrap', cursor: 'pointer',
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

      {/* 地铁图 iframe（Blob URL 隔离 CSS） */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {blobUrlRef.current && (
          <iframe
            ref={iframeRef}
            src={blobUrlRef.current}
            title="地铁图"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            allowFullScreen
          />
        )}

        {loading && !errorMsg && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.85)', color: '#6b7280',
            fontSize: isMobile ? 12 : 13, gap: 10, pointerEvents: 'none',
          }}>
            <Loader2 size={isMobile ? 24 : 28} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
            <span>正在加载地铁图…</span>
          </div>
        )}

        {errorMsg && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#ef4444', fontSize: isMobile ? 12 : 13, textAlign: 'center', padding: 20, gap: 12,
          }}>
            <div>{errorMsg}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>
              请确认：1) 已配置高德 JS API 密钥（amap_key）<br/>
              2) 密钥已开通地铁图服务<br/>
              3) 已更新到最新版本（v3.0.22-cn.42+）
            </div>
          </div>
        )}

        {!loading && !errorMsg && (
          <div style={{
            position: 'absolute', right: isMobile ? 8 : 12, bottom: isMobile ? 8 : 12,
            padding: isMobile ? '5px 8px' : '6px 10px', borderRadius: 6,
            background: 'rgba(0,0,0,0.6)', color: '#fff',
            fontSize: isMobile ? 10 : 11, pointerEvents: 'none',
            maxWidth: isMobile ? 160 : 220, textAlign: 'center',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <MapPin size={isMobile ? 10 : 12} style={{ flexShrink: 0 }} />
            <span>点击站点设为起终点，查看路线规划</span>
          </div>
        )}
      </div>
    </div>
  )
}
