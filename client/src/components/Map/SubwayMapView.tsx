import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, List, ChevronUp, MapPin, Navigation, Trash2, CircleDot, Route } from 'lucide-react'
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
 * 使用 createPortal 渲染到 document.body，避免父级 stacking context 遮挡。
 *
 * 关键设计：每次切换城市都重建整个 iframe（而非 destroy+recreate 实例），
 * 彻底避免旧实例事件监听器残留导致的"粘鼠标"和"缩放恢复默认"问题。
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
  const [clickedStation, setClickedStation] = useState<any>(null)
  const [startStation, setStartStation] = useState<any>(null)
  const [endStation, setEndStation] = useState<any>(null)
  const [routeComplete, setRouteComplete] = useState<boolean>(false)
  const [routeLines, setRouteLines] = useState<string[]>([])

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const blobUrlRef = useRef<string>('')

  // ── 创建 Blob URL（amapKey 或 selectedAdcode 变化时重建）────────────
  useEffect(() => {
    if (!amapKey) return

    // 清理旧的 blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = ''
    }

    const safeKey = JSON.stringify(amapKey)
    const safeAdcode = JSON.stringify(selectedAdcode)
    const secConfig = amapSecurityCode
      ? 'window._AMapSecurityConfig = { securityJsCode: ' + JSON.stringify(amapSecurityCode) + ' };'
      : ''

    const html = [
      '<!DOCTYPE html>',
      '<html lang="zh-CN"><head>',
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=5.0,minimum-scale=0.5,user-scalable=yes">',
      '<title>地铁图</title>',
      '<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">',
      '<style>',
      '*{margin:0;padding:0;box-sizing:border-box}',
      'html,body{width:100%;height:100%;overflow:hidden;background:#fff}',
      '#sc{width:100%;height:100%;touch-action:none;display:flex;align-items:center;justify-content:center}',
      '#sc>div{margin:auto !important}',
      '</style>',
      '</head><body><div id="sc"></div>',
      '<script>',
      '(function(){',
      'var key=' + safeKey + ';',
      secConfig,
      'var adcode=' + safeAdcode + ';',
      'var si=null,sf=null,cr=false,tid=null;',
      'var curZoom=1.0,pinchDist=0,pinchZoom=1.0;',
      'var touchSX=0,touchSY=0,touchST=0,lastClick=null;',
      '',
      '// 捕获 API 内部错误（formatStation 崩溃等）',
      'window.onerror=function(msg,url,line){',
      '  console.log("[subway] suppressed error:",msg);',
      '  return true;',
      '};',
      '',
      '// ── 站点点击：去重发送 ──────────────────────────────────────────',
      'function sendStationClick(name){',
      '  if(lastClick&&lastClick.name===name&&Date.now()-lastClick.time<1000) return;',
      '  lastClick={name:name,time:Date.now()};',
      '  parent.postMessage({type:"subwayClickStation",station:{name:name,id:name}},"*");',
      '}',
      '',
      '// ── 判断文本是否为站点名（非线路名）──────────────────────────────',
      'function isStationName(text){',
      '  if(!text||text.length===0||text.length>20) return false;',
      '  // 过滤线路名：含"号线"的（如"1号线""18号线"）',
      '  if(/号线/.test(text)) return false;',
      '  // 过滤线路名：以"线"结尾且较短（如"大兴线""亦庄线"）',
      '  if(/线$/.test(text)&&text.length<=4) return false;',
      '  return true;',
      '}',
      '',
      '// ── 从事件目标获取站点名（仅 text/tspan 元素）──────────────────',
      'function getStationNameFromTarget(target){',
      '  if(!target||!target.tagName) return null;',
      '  var tag=target.tagName.toLowerCase();',
      '  if(tag==="text"||tag==="tspan"){',
      '    var t=(target.textContent||"").trim();',
      '    if(isStationName(t)) return t;',
      '  }',
      '  return null;',
      '}',
      '',
      '// ── subway 脚本回调 ────────────────────────────────────────────',
      'window.cbk=function(){',
      '  try{ sf=window.subway||window.Subway }catch(e){ sf=null }',
      '  if(!sf||typeof sf!=="function"){',
      '    parent.postMessage({type:"subwayError",msg:"地铁图组件未就绪，请检查密钥是否已开通地铁图服务"},"*");',
      '    return;',
      '  }',
      '  parent.postMessage({type:"subwayReady"},"*");',
      '  try{',
      '    si=sf("sc",{adcode:adcode,theme:"colorful"});',
      '    si.event.on("subway.complete",function(){',
      '      cr=true; if(tid){clearTimeout(tid);tid=null}',
      '      parent.postMessage({type:"subwayComplete"},"*");',
      '      // 获取线路列表',
      '      try{',
      '        var lines=null;',
      '        if(si.getLinelist) lines=si.getLinelist();',
      '        if(!lines&&si.getLineList){ si.getLineList(function(l){lines=l}); }',
      '        if(lines&&Array.isArray(lines)){ parent.postMessage({type:"subwayLineList",lines:lines},"*"); }',
      '      }catch(e){ console.log("[subway] getLinelist err:",e); }',
      '      // 居中：延迟调用 setFitView 确保渲染完成',
      '      setTimeout(function(){',
      '        try{ si.setFitView(); }catch(e){ console.log("[subway] fitView err:",e); }',
      '      },1000);',
      '    });',
      '    si.event.on("subway.fail",function(){',
      '      if(tid){clearTimeout(tid);tid=null}',
      '      parent.postMessage({type:"subwayFail",msg:"地铁图数据加载失败，该城市可能暂不支持"},"*");',
      '    });',
      '    // station.touch 事件',
      '    si.event.on("station.touch",function(d){',
      '      if(d&&(d.name||d.id)) sendStationClick(d.name||d.id);',
      '    });',
      '    // stationName.touch 事件',
      '    si.event.on("stationName.touch",function(d){',
      '      if(d&&(d.name||d.id)) sendStationClick(d.name||d.id);',
      '    });',
      '    // 路线规划完成事件',
      '    si.event.on("subway.routeComplete",function(d){',
      '      var lineNames=[];',
      '      try{',
      '        var data=d&&d.data?d.data:d;',
      '        if(Array.isArray(data.segments)){',
      '          data.segments.forEach(function(s){',
      '            var n=s.line||s.lineName||s.name||s.line_title;',
      '            if(n&&lineNames.indexOf(n)<0) lineNames.push(n);',
      '          });',
      '        }else if(Array.isArray(data.route)){',
      '          data.route.forEach(function(r){',
      '            var n=r.line||r.lineName||r.name||r.line_title;',
      '            if(n&&lineNames.indexOf(n)<0) lineNames.push(n);',
      '          });',
      '        }else if(Array.isArray(data.lines)){',
      '          data.lines.forEach(function(l){',
      '            var n=typeof l==="string"?l:(l.name||l.lineName||l.line_title);',
      '            if(n&&lineNames.indexOf(n)<0) lineNames.push(n);',
      '          });',
      '        }else if(data.line_names){',
      '          lineNames=data.line_names;',
      '        }',
      '      }catch(e){ console.log("[subway] routeComplete parse err:",e); }',
      '      parent.postMessage({type:"subwayRouteComplete",data:d,lineNames:lineNames},"*");',
      '    });',
      '  }catch(err){',
      '    if(tid){clearTimeout(tid);tid=null}',
      '    parent.postMessage({type:"subwayError",msg:"地铁图加载失败："+String(err)},"*");',
      '  }',
      '  if(tid){clearTimeout(tid)}',
      '  tid=setTimeout(function(){',
      '    if(!cr){ parent.postMessage({type:"subwayTimeout",msg:"地铁图加载超时，请检查网络或密钥配置"},"*"); }',
      '  },10000);',
      '};',
      '',
      'var s=document.createElement("script");',
      's.src="https://webapi.amap.com/subway?v=1.0&key="+encodeURIComponent(key)+"&callback=cbk";',
      's.async=true;',
      's.onerror=function(){ parent.postMessage({type:"subwayError",msg:"地铁图脚本加载失败，请检查网络连接"},"*"); };',
      'document.head.appendChild(s);',
      '',
      '// ── 鼠标滚轮缩放（电脑端）──────────────────────────────────────',
      'document.getElementById("sc").addEventListener("wheel",function(e){',
      '  e.preventDefault();',
      '  var d=e.deltaY>0?-0.1:0.1;',
      '  curZoom=Math.max(0.3,Math.min(1.3,curZoom+d));',
      '  try{ si.scale(curZoom); }catch(ex){}',
      '},{passive:false});',
      '',
      '// ── 双指缩放（手机端）──────────────────────────────────────────',
      'document.getElementById("sc").addEventListener("touchstart",function(e){',
      '  if(e.touches.length===2){',
      '    var dx=e.touches[0].clientX-e.touches[1].clientX;',
      '    var dy=e.touches[0].clientY-e.touches[1].clientY;',
      '    pinchDist=Math.sqrt(dx*dx+dy*dy);',
      '    pinchZoom=curZoom;',
      '  }else if(e.touches.length===1){',
      '    touchSX=e.touches[0].clientX; touchSY=e.touches[0].clientY; touchST=Date.now();',
      '  }',
      '},{passive:false});',
      '',
      'document.getElementById("sc").addEventListener("touchmove",function(e){',
      '  if(e.touches.length===2&&pinchDist>0){',
      '    e.preventDefault();',
      '    var dx=e.touches[0].clientX-e.touches[1].clientX;',
      '    var dy=e.touches[0].clientY-e.touches[1].clientY;',
      '    var dist=Math.sqrt(dx*dx+dy*dy);',
      '    var scale=dist/pinchDist;',
      '    curZoom=Math.max(0.3,Math.min(1.3,pinchZoom*scale));',
      '    try{ si.scale(curZoom); }catch(ex){}',
      '  }',
      '},{passive:false});',
      '',
      '// ── 站点点击检测：touchend（手机端）─────────────────────────────',
      'document.getElementById("sc").addEventListener("touchend",function(e){',
      '  if(e.touches.length<2) pinchDist=0;',
      '  if(e.changedTouches.length===1){',
      '    var dx=e.changedTouches[0].clientX-touchSX;',
      '    var dy=e.changedTouches[0].clientY-touchSY;',
      '    var dist=Math.sqrt(dx*dx+dy*dy);',
      '    var dt=Date.now()-touchST;',
      '    if(dist<15&&dt<500){',
      '      var el=document.elementFromPoint(e.changedTouches[0].clientX,e.changedTouches[0].clientY);',
      '      if(el){ var n=getStationNameFromTarget(el); if(n) sendStationClick(n); }',
      '    }',
      '  }',
      '},{passive:false});',
      '',
      '// ── 站点点击检测：click（电脑端，capture 阶段）──────────────────',
      'document.getElementById("sc").addEventListener("click",function(e){',
      '  var n=getStationNameFromTarget(e.target);',
      '  if(n) sendStationClick(n);',
      '},true);',
      '',
      '// ── 父页消息处理 ────────────────────────────────────────────────',
      'window.addEventListener("message",function(e){',
      '  if(!e.data||typeof e.data.type!=="string") return;',
      '  if(e.data.type==="showLine"&&si&&e.data.lineName){',
      '    try{',
      '      si.showLine(e.data.lineName);',
      '      var c=si.getSelectedLineCenter&&si.getSelectedLineCenter();',
      '      if(c){ si.setCenter(c); }',
      '    }catch(ex){}',
      '  } else if(e.data.type==="setStart"&&si){',
      '    try{ si.setStart(e.data.sid); }catch(ex){}',
      '  } else if(e.data.type==="setEnd"&&si){',
      '    try{ si.setEnd(e.data.sid); }catch(ex){}',
      '  } else if(e.data.type==="setRoute"&&si){',
      '    try{ si.route(e.data.startId,e.data.endId,{closeBtn:true}); }catch(ex){}',
      '  } else if(e.data.type==="clearRoute"&&si){',
      '    try{ si.clearRoute(); }catch(ex){}',
      '    try{ si.setStart(""); }catch(ex){}',
      '    try{ si.setEnd(""); }catch(ex){}',
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
    setClickedStation(null)
    setStartStation(null)
    setEndStation(null)
    setRouteComplete(false)
    setRouteLines([])

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = ''
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amapKey, amapSecurityCode, selectedAdcode])

  // ── 监听 iframe 的 postMessage 消息 ──────────────────────────────────
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data || typeof e.data.type !== 'string') return
      switch (e.data.type) {
        case 'subwayReady':
          break
        case 'subwayComplete':
          setLoading(false)
          setErrorMsg('')
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
        case 'subwayClickStation':
          if (e.data.station) {
            setClickedStation(e.data.station)
          }
          break
        case 'subwayRouteComplete':
          setRouteComplete(true)
          setRouteLines(e.data.lineNames || [])
          break
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // ── 点击线路项：高亮该线路 ───────────────────────────────────────────
  const handleLineClick = useCallback((line: any) => {
    const name = line.name || line.lineName || line.title
    if (!name || !iframeRef.current?.contentWindow) return
    iframeRef.current.contentWindow.postMessage({ type: 'showLine', lineName: name }, '*')
  }, [])

  // ── 站点选择操作 ────────────────────────────────────────────────────
  const handleSetStart = useCallback(() => {
    if (!clickedStation) return
    setStartStation(clickedStation)
    const sid = clickedStation.name || clickedStation.id
    iframeRef.current?.contentWindow?.postMessage({ type: 'setStart', sid }, '*')
    setClickedStation(null)
  }, [clickedStation])

  const handleSetEnd = useCallback(() => {
    if (!clickedStation) return
    setEndStation(clickedStation)
    const sid = clickedStation.name || clickedStation.id
    iframeRef.current?.contentWindow?.postMessage({ type: 'setEnd', sid }, '*')
    setClickedStation(null)
  }, [clickedStation])

  const handlePlanRoute = useCallback(() => {
    if (!startStation || !endStation) return
    const startId = startStation.name || startStation.id
    const endId = endStation.name || endStation.id
    setRouteComplete(false)
    setRouteLines([])
    iframeRef.current?.contentWindow?.postMessage({
      type: 'setRoute', startId, endId,
    }, '*')
  }, [startStation, endStation])

  const handleClearRoute = useCallback(() => {
    setStartStation(null)
    setEndStation(null)
    setClickedStation(null)
    setRouteComplete(false)
    setRouteLines([])
    iframeRef.current?.contentWindow?.postMessage({ type: 'clearRoute' }, '*')
  }, [])

  // ── 未配置 amap_key ──────────────────────────────────────────────────
  if (!amapKey) {
    return createPortal(
      <div style={{
        position: 'fixed', top: 'calc(var(--nav-h) + 44px)', left: 0, right: 0,
        bottom: 'var(--bottom-nav-h)', zIndex: 999999, background: '#fff',
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
      </div>,
      document.body
    )
  }

  const toolbarPadding = isMobile ? '6px 10px' : '8px 14px'
  const toolbarFontSize = isMobile ? 12 : 13
  const selectMinWidth = isMobile ? 90 : 120
  const linePanelMaxHeight = isMobile ? 140 : 240
  const lineItemFontSize = isMobile ? 11 : 12

  return createPortal(
    <div style={{
      position: 'fixed', top: 'calc(var(--nav-h) + 44px)', left: 0, right: 0,
      bottom: 'var(--bottom-nav-h)', zIndex: 999999, background: '#fff',
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
              3) 已更新到最新版本（v3.0.22-cn.49+）
            </div>
          </div>
        )}

        {/* 站点点击弹窗 - 选择起点/终点 */}
        {clickedStation && !loading && !errorMsg && (
          <div style={{
            position: 'absolute', top: isMobile ? 6 : 10, left: '50%', transform: 'translateX(-50%)',
            padding: isMobile ? '8px 12px' : '10px 16px', borderRadius: 8,
            background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8,
            zIndex: 10, maxWidth: isMobile ? '92%' : '400px', whiteSpace: 'nowrap',
          }}>
            <MapPin size={isMobile ? 13 : 15} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: '#111827', maxWidth: isMobile ? 80 : 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {clickedStation.name || clickedStation.id || clickedStation.station_name || '未知站点'}
            </span>
            <button onClick={handleSetStart} style={{
              padding: isMobile ? '4px 8px' : '5px 10px', borderRadius: 4,
              border: 'none', background: '#3b82f6', color: '#fff',
              fontSize: isMobile ? 11 : 12, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>设为起点</button>
            <button onClick={handleSetEnd} style={{
              padding: isMobile ? '4px 8px' : '5px 10px', borderRadius: 4,
              border: 'none', background: '#10b981', color: '#fff',
              fontSize: isMobile ? 11 : 12, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>设为终点</button>
            <button onClick={() => setClickedStation(null)} style={{
              padding: '2px', border: 'none', background: 'transparent',
              color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}><X size={14} /></button>
          </div>
        )}

        {/* 起终点信息栏 + 规划路线 + 路线结果 */}
        {(startStation || endStation || routeComplete) && !loading && !errorMsg && (
          <div style={{
            position: 'absolute', bottom: isMobile ? 6 : 10, left: '50%', transform: 'translateX(-50%)',
            padding: isMobile ? '8px 12px' : '10px 16px', borderRadius: 8,
            background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center',
            gap: isMobile ? 6 : 8, zIndex: 10, maxWidth: isMobile ? '95%' : '500px',
            flexWrap: 'wrap', justifyContent: 'center',
          }}>
            {startStation && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: isMobile ? 11 : 12 }}>
                <CircleDot size={12} style={{ color: '#3b82f6' }} />
                <span style={{ color: '#3b82f6', fontWeight: 600 }}>起</span>
                <span style={{ color: '#111827', maxWidth: isMobile ? 60 : 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{startStation.name || startStation.id || startStation.station_name}</span>
              </div>
            )}
            {startStation && endStation && (
              <span style={{ color: '#9ca3af', fontSize: isMobile ? 10 : 11 }}>→</span>
            )}
            {endStation && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: isMobile ? 11 : 12 }}>
                <Navigation size={12} style={{ color: '#10b981' }} />
                <span style={{ color: '#10b981', fontWeight: 600 }}>终</span>
                <span style={{ color: '#111827', maxWidth: isMobile ? 60 : 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{endStation.name || endStation.id || endStation.station_name}</span>
              </div>
            )}
            {startStation && endStation && !routeComplete && (
              <button onClick={handlePlanRoute} style={{
                padding: isMobile ? '4px 10px' : '5px 12px', borderRadius: 4,
                border: 'none', background: '#3b82f6', color: '#fff',
                fontSize: isMobile ? 11 : 12, cursor: 'pointer', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 3,
              }}><Navigation size={12} />规划路线</button>
            )}
            {routeComplete && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: isMobile ? 11 : 12, color: '#059669', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Route size={12} style={{ flexShrink: 0 }} />
                {routeLines.length > 0 ? (
                  <span>{routeLines.join(' → ')}</span>
                ) : (
                  <span>路线已规划，彩色线段对应不同线路</span>
                )}
              </div>
            )}
            <button onClick={handleClearRoute} title="清除" style={{
              padding: '2px', border: 'none', background: 'transparent',
              color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}><Trash2 size={13} /></button>
          </div>
        )}

        {/* 提示文字（无起终点时显示） */}
        {!loading && !errorMsg && !startStation && !endStation && !clickedStation && (
          <div style={{
            position: 'absolute', right: isMobile ? 8 : 12, bottom: isMobile ? 8 : 12,
            padding: isMobile ? '5px 8px' : '6px 10px', borderRadius: 6,
            background: 'rgba(0,0,0,0.6)', color: '#fff',
            fontSize: isMobile ? 10 : 11, pointerEvents: 'none',
            maxWidth: isMobile ? 160 : 220, textAlign: 'center',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <MapPin size={isMobile ? 10 : 12} style={{ flexShrink: 0 }} />
            <span>点击站点名称设为起终点，滚轮/双指缩放</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
