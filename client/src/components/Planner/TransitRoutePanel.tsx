import React from 'react'
import ReactDOM from 'react-dom'
import {
  Footprints, Bus, Train as TrainIcon, ChevronDown, ChevronRight,
  MapPin, Clock, Coins, Navigation, X, ArrowRight, Plane
} from 'lucide-react'
import type { TransitRouteResult, TransitRouteOption, TransitSegment, TransitLeg } from '../../types'
import { useTranslation } from '../../i18n'

interface TransitRoutePanelProps {
  result: TransitRouteResult
  selectedStrategy: number
  onSelectLegOption: (legIndex: number, optionIndex: number) => void
  onSelectStrategy: (strategy: number) => void
  onClose: () => void
}

// 换乘策略定义
const STRATEGIES = [
  { value: 0, labelKey: 'transit.strategy.fastest', defaultLabel: '最快', icon: '⚡' },
  { value: 1, labelKey: 'transit.strategy.cheapest', defaultLabel: '最省钱', icon: '💰' },
  { value: 2, labelKey: 'transit.strategy.leastTransfer', defaultLabel: '最少换乘', icon: '🔄' },
  { value: 3, labelKey: 'transit.strategy.leastWalk', defaultLabel: '少步行', icon: '🚶' },
]

function getLineColor(lineName?: string, lineColor?: string): string {
  if (lineColor && /^#[0-9a-fA-F]{6}$/.test(lineColor)) return lineColor
  if (!lineName) return '#ef4444'
  const numMatch = lineName.match(/(\d+)/)
  if (numMatch) {
    const n = parseInt(numMatch[1], 10)
    const hue = ((n * 47 + 13) % 360)
    return `hsl(${hue}, 70%, 50%)`
  }
  return '#ef4444'
}

// ── 错误边界：防止渲染崩溃导致白屏 ────────────────────────────────────

class TransitErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error): any {
    return { hasError: true, error }
  }
  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.4)', zIndex: 9998,
        }} onClick={() => this.setState({ hasError: false, error: null })}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 12, padding: '20px 24px',
            textAlign: 'center', maxWidth: 320,
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
              {this.state.error?.message || '渲染错误'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-faint)' }}>点击关闭</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── 图标组件：带颜色的交通工具图标 ──────────────────────────────────────

function WalkIcon() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 20, height: 20, borderRadius: '50%',
      background: '#f3f4f6', border: '1.5px solid #d1d5db',
    }}>
      <Footprints size={10} style={{ color: '#6b7280' }} />
    </span>
  )
}

function BusIcon({ color }: { color?: string }) {
  const c = color || '#3b82f6'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 20, height: 20, borderRadius: 5,
      background: `${c}18`, border: `1.5px solid ${c}`,
    }}>
      <Bus size={11} style={{ color: c }} strokeWidth={2.5} />
    </span>
  )
}

function SubwayIcon({ color }: { color?: string }) {
  const c = color || '#ef4444'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 20, height: 20, borderRadius: 5,
      background: `${c}18`, border: `1.5px solid ${c}`,
    }}>
      <TrainIcon size={11} style={{ color: c }} strokeWidth={2.5} />
    </span>
  )
}

function SegmentIcon({ type, color }: { type: 'walk' | 'bus' | 'subway'; color?: string }) {
  switch (type) {
    case 'walk': return <WalkIcon />
    case 'bus': return <BusIcon color={color} />
    case 'subway': return <SubwayIcon color={color} />
  }
}

// ── 格式化工具 ──────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m > 0 ? m + 'min' : ''}`
  return `${m}min`
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

// ── 分段详情（可展开） ──────────────────────────────────────────────────

function SegmentDetail({ segment }: { segment: TransitSegment }) {
  const [expanded, setExpanded] = React.useState(false)
  const color = segment.type === 'subway' ? getLineColor(segment.lineName, segment.lineColor) : undefined
  const isWalk = segment.type === 'walk'

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      {/* 左侧图标+连线 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22, flexShrink: 0 }}>
        <SegmentIcon type={segment.type} color={color} />
        <div style={{ width: 2, flex: 1, minHeight: 14, background: isWalk ? '#e5e7eb' : `${color || '#3b82f6'}25` }} />
      </div>

      {/* 右侧内容 */}
      <div
        style={{ flex: 1, paddingBottom: 6, minWidth: 0, cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        {!expanded ? (
          /* 折叠态 */
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingTop: 2 }}>
            {segment.type === 'subway' && (
              <span style={{ fontSize: 11, fontWeight: 600, color: color || '#ef4444' }}>
                {segment.lineName}
              </span>
            )}
            {segment.type === 'bus' && (
              <span style={{ fontSize: 11, fontWeight: 500, color: '#3b82f6' }}>
                🚌 {segment.lineName}
              </span>
            )}
            {isWalk && (
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                步行 {formatDistance(segment.distance)}
              </span>
            )}
            <span style={{ color: 'var(--text-faint)', fontSize: 11, marginLeft: 'auto' }}>
              {formatDuration(segment.duration)}
            </span>
            <ChevronRight size={12} style={{ color: 'var(--text-faint)' }} />
          </div>
        ) : (
          /* 展开态 */
          <div style={{ paddingTop: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <SegmentIcon type={segment.type} color={color} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>{segment.instruction}</span>
              <span style={{ color: 'var(--text-faint)', fontSize: 11, marginLeft: 'auto' }}>
                {formatDuration(segment.duration)} · {formatDistance(segment.distance)}
              </span>
            </div>

            {/* 站点信息 */}
            {(segment.type === 'bus' || segment.type === 'subway') && (
              <div style={{
                fontSize: 11, color: 'var(--text-secondary)',
                background: 'var(--bg-tertiary)', borderRadius: 6, padding: '5px 8px',
                lineHeight: 1.6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                  <span>{segment.departureStop}</span>
                </div>
                {segment.viaStops != null && segment.viaStops > 0 && (
                  <div style={{ paddingLeft: 4, color: 'var(--text-faint)', fontSize: 10 }}>↓ 途经 {segment.viaStops} 站</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  <span>{segment.arrivalStop}</span>
                </div>
              </div>
            )}

            {/* 步行指引 */}
            {isWalk && segment.instruction && (
              <div style={{
                fontSize: 11, color: 'var(--text-secondary)',
                background: 'var(--bg-tertiary)', borderRadius: 6, padding: '5px 8px',
                lineHeight: 1.6,
              }}>
                {segment.instruction}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 指标条 ───────────────────────────────────────────────────────────────

function MetricBar({ option }: { option: TransitRouteOption }) {
  const segs = Array.isArray(option.segments) ? option.segments : []
  const subwayCount = segs.filter(s => s.type === 'subway').length
  const busCount = segs.filter(s => s.type === 'bus').length
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '5px 8px',
      background: 'var(--bg-tertiary)', borderRadius: 6,
      marginBottom: 4, fontSize: 11, flexWrap: 'wrap',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--text-secondary)' }}>
        <Clock size={10} />{formatDuration(option.duration)}
      </span>
      {option.cost > 0 && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--text-secondary)' }}>
          <Coins size={10} />¥{option.cost}
        </span>
      )}
      <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--text-secondary)' }}>
        <Navigation size={10} />步行{formatDistance(option.walkingDistance)}
      </span>
      {(subwayCount > 0 || busCount > 0) && (
        <span style={{ color: 'var(--text-faint)' }}>
          {subwayCount > 0 && <span style={{ color: '#ef4444' }}>地铁{subwayCount}</span>}
          {subwayCount > 0 && busCount > 0 && <span>+</span>}
          {busCount > 0 && <span style={{ color: '#3b82f6' }}>公交{busCount}</span>}
        </span>
      )}
    </div>
  )
}

// ── 方案卡片 ─────────────────────────────────────────────────────────────

function RouteOptionCard({ option, index, isSelected, onSelect }: {
  option: TransitRouteOption; index: number; isSelected: boolean; onSelect: () => void
}) {
  const [expanded, setExpanded] = React.useState(isSelected)

  React.useEffect(() => { setExpanded(isSelected) }, [isSelected])

  return (
    <div style={{
      border: `1.5px solid ${isSelected ? 'var(--text-primary)' : 'var(--border-faint)'}`,
      borderRadius: 10, overflow: 'hidden', transition: 'all 0.15s',
    }}>
      <button
        onClick={() => { onSelect(); setExpanded(!expanded) }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 9px', border: 'none', background: 'transparent',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          background: isSelected ? 'var(--text-primary)' : 'var(--bg-tertiary)',
          color: isSelected ? 'var(--bg-primary)' : 'var(--text-faint)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, flexShrink: 0,
        }}>
          {index + 1}
        </div>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'left' }}>
          {option.summary}
        </span>
        <span style={{ color: 'var(--text-faint)' }}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 9px 8px', borderTop: '1px solid var(--border-faint)' }}>
          <MetricBar option={option} />
          <div style={{ marginTop: 4 }}>
            {Array.isArray(option.segments) && option.segments.map((seg, si) => (
              <SegmentDetail key={si} segment={seg} />
            ))}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 22, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                <MapPin size={12} style={{ color: 'var(--text-faint)' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 500 }}>到达终点</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 12306 购票链接生成 ────────────────────────────────────────────────

/** 常用火车站代码映射 (12306 station_code) */
const STATION_CODES: Record<string, string> = {
  // 直辖市
  '北京西': 'BXP', '北京南': 'VNP', '北京': 'BJP', '北京丰台': 'FTP',
  '上海': 'SHH', '上海虹桥': 'AOH', '上海南站': 'SXH',
  '广州南': 'IZQ', '广州': 'GZQ', '深圳北': 'IOQ', '深圳': 'SZQ',
  '天津西': 'TXP', '天津': 'TJP', '天津南': 'TIP',
  '重庆北': 'CUW', '重庆': 'CQW', '重庆西': 'CXW',
  // 湖北
  '汉口': 'HK', '武汉': 'WHN', '武昌': 'WCN', '武汉站': 'WKN',
  // 河南
  '郑州东': 'ZAF', '郑州': 'ZZF',
  // 江苏
  '南京南': 'NKH', '南京': 'NJH',
  // 浙江
  '杭州东': 'HGH', '杭州': 'HZH',
  // 四川
  '成都东': 'ICW', '成都': 'CDW',
  // 陕西
  '西安北': 'EAY', '西安': 'XAY',
  // 湖南
  '长沙南': 'CSQ', '长沙': 'CSQ',
  // 其他常见
  '合肥南': 'UEH', '济南西': 'JGK', '沈阳北': 'SYT', '长春': 'CCT',
  '哈尔滨西': 'HBB', '福州南': 'XKS', '南昌西': 'NKG', '南宁东': 'NNZ',
  '贵阳北': 'KIW', '昆明南': 'KMM', '兰州西': 'LZH', '乌鲁木齐': 'WMR',
  '太原南': 'TAV', '石家庄': 'SJP', '厦门北': 'XMS', '青岛北': 'QDK',
  '大连北': 'DLT', '宁波': 'NGH', '苏州北': 'RKH', '无锡': 'UXH',
  '合肥': 'HFH', '徐州东': 'EUH', '洛阳龙门': 'LYF',
}

function getStationCode(name: string): string {
  // 精确匹配
  if (STATION_CODES[name]) return STATION_CODES[name]
  // 模糊匹配（名称包含）
  for (const [stationName, code] of Object.entries(STATION_CODES)) {
    if (name.includes(stationName) || stationName.includes(name)) return code
  }
  return ''
}

function get12306Url(fromName: string, toName: string): string {
  const fromCode = getStationCode(fromName)
  const toCode = getStationCode(toName)
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  // 有车站代码时生成精确查询URL，否则跳转12306首页
  if (fromCode && toCode) {
    const fs = encodeURIComponent(`${fromName},${fromCode}`)
    const ts = encodeURIComponent(`${toName},${toCode}`)
    return `https://kyfw.12306.cn/otn/leftTicket/init?linktypeid=dc&fs=${fs}&ts=${ts}&date=${dateStr}&flag=N,N,Y`
  }
  return 'https://kyfw.12306.cn/otn/leftTicket/init'
}

// ── 单段路线区块（带目的地标题） ─────────────────────────────────────────

function LegSection({ leg, legIndex, onSelectOption }: {
  leg: TransitLeg; legIndex: number; onSelectOption: (optIdx: number) => void
}) {
  const { t } = useTranslation()

  if (leg.error) {
    // 跨城路段：显示交通建议卡片
    if (leg.crossCityInfo) {
      const info = leg.crossCityInfo
      return (
        <div style={{
          borderRadius: 10, overflow: 'hidden',
          border: '1px solid #e8a838',
          background: 'linear-gradient(135deg, #fff9f0 0%, #fff5e6 100%)',
        }}>
          {/* 标题头 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 10px', background: 'rgba(232,168,56,0.08)',
            borderBottom: '1px solid rgba(232,168,56,0.2)',
          }}>
            <Navigation size={13} style={{ color: '#e8a838', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{leg.fromName}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#b8860b' }}>
              → {leg.toName}
            </span>
          </div>
          {/* 跨城提示 */}
          <div style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: '#996515', marginBottom: 8, textAlign: 'center' }}>
              {leg.error}
            </div>
            {/* 交通建议 */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {info.suggestTrain && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '10px 14px', borderRadius: 10, background: 'white',
                  border: '1.5px solid #3b82f6', minWidth: 90,
                }}>
                  <TrainIcon size={22} style={{ color: '#3b82f6' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1e40af' }}>高铁/火车</span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>约{info.estHours}小时</span>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>{info.distanceKm}km</span>
                </div>
              )}
              {info.suggestPlane && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '10px 14px', borderRadius: 10, background: 'white',
                  border: '1.5px solid #8b5cf6', minWidth: 90,
                }}>
                  <Plane size={22} style={{ color: '#8b5cf6' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#5b21b6' }}>飞机</span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>约2-3小时</span>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>{info.distanceKm}km</span>
                </div>
              )}
            </div>
            {/* 提示文字 + 购票按钮 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <a
                href={get12306Url(leg.fromName, leg.toName)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 14px', borderRadius: 8,
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: 'white', fontSize: 11, fontWeight: 600,
                  textDecoration: 'none', fontFamily: 'inherit',
                  boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,0.3)' }}
              >
                <TrainIcon size={13} />
                12306 查询购票
              </a>
              <span style={{ fontSize: 9.5, color: '#b8860b' }}>
                票价以12306实际查询为准
              </span>
            </div>
          </div>
        </div>
      )
    }
    // 普通错误（无法识别城市等）
    return (
      <div style={{
        borderRadius: 10, overflow: 'hidden',
        border: '1px dashed var(--border-faint)',
        background: 'var(--bg-tertiary)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 10px', borderBottom: '1px dashed var(--border-faint)',
        }}>
          <ArrowRight size={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{leg.fromName}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{leg.toName}</span>
        </div>
        <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-faint)', textAlign: 'center' }}>
          {leg.error}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      borderRadius: 10, overflow: 'hidden',
      border: '1px solid var(--border-faint)',
    }}>
      {/* 目的地标题头 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 10px', background: 'var(--bg-hover)',
        borderBottom: '1px solid var(--border-faint)',
      }}>
        <ArrowRight size={13} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{leg.fromName}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          → {leg.toName}
        </span>
      </div>

      {/* 方案列表 */}
      <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {Array.isArray(leg.options) && leg.options.map((option, i) => (
          <RouteOptionCard
            key={i}
            option={option}
            index={i}
            isSelected={i === leg.selectedOptionIndex}
            onSelect={() => onSelectOption(i)}
          />
        ))}
      </div>
    </div>
  )
}

// ── 主面板 ───────────────────────────────────────────────────────────────

export default function TransitRoutePanel({
  result, selectedStrategy,
  onSelectLegOption, onSelectStrategy, onClose,
}: TransitRoutePanelProps) {
  const { t } = useTranslation()
  // 响应式检测屏幕宽度
  const [isMobile, setIsMobile] = React.useState(() => typeof window !== 'undefined' && window.innerWidth <= 768)
  // 客户端挂载检测: SSR时document.body不存在,Portal会崩溃
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])
  React.useEffect(() => {
    if (!mounted) return
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mounted])

  // 未挂载时不渲染(防止SSR崩溃)
  if (!mounted) return null

  // 汇总统计
  const totalDur = result.legs.reduce((s, l) =>
    s + (l.options[l.selectedOptionIndex]?.duration || 0), 0)
  const totalCost = result.legs.reduce((s, l) =>
    s + (l.options[l.selectedOptionIndex]?.cost || 0), 0)
  const successLegs = result.legs.filter(l => !l.error).length

  const panel = (
    <>
      {/* 遮罩层 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 9998,
          WebkitTapHighlightColor: 'transparent',
        }}
      />
      {/* 面板主体 */}
      <div style={{
        position: 'fixed',
        ...(!isMobile ? {
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(480px, calc(100vw - 32px))',
          maxHeight: '80vh',
        } : {
          bottom: 0, left: 0, right: 0,
          height: '90vh', maxHeight: '90vh',
          borderRadius: '16px 16px 0 0',
        }),
        borderRadius: !isMobile ? 16 : undefined,
        background: 'var(--bg-secondary)',
        boxShadow: isMobile
          ? '0 -4px 24px rgba(0,0,0,0.2)'
          : '0 8px 40px rgba(0,0,0,0.2)',
        zIndex: 9999,
        overflowY: 'auto',
        border: '1px solid var(--border-faint)',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        padding: '14px 16px',
      }}>
        {/* 移动端拖拽指示条 */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 6, paddingBottom: 8 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-primary)' }} />
          </div>
        )}
        {/* 标题栏 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingBottom: 10, borderBottom: '1px solid var(--border-faint)', marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: isMobile ? 15 : 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('transit.title', { defaultValue: '公交/地铁路线' })}
            </span>
            {successLegs > 0 && (
              <span style={{ fontSize: isMobile ? 11 : 10.5, color: '#fff', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                {formatDuration(totalDur)} · ¥{totalCost.toFixed(0)}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-tertiary)', border: 'none', borderRadius: '50%',
            cursor: 'pointer', color: 'var(--text-faint)',
            width: isMobile ? 32 : 28, height: isMobile ? 32 : 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <X size={isMobile ? 16 : 14} />
          </button>
        </div>

        {/* 换乘策略选择器 */}
        <div style={{
          display: 'flex', gap: 4, flexWrap: 'wrap',
          marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border-faint)',
        }}>
          {STRATEGIES.map(s => (
            <button
              key={s.value}
              onClick={() => onSelectStrategy(s.value)}
              style={{
                padding: isMobile ? '6px 12px' : '4px 9px',
                fontSize: isMobile ? 12 : 11, borderRadius: 8,
                border: selectedStrategy === s.value
                  ? '1.5px solid var(--text-primary)'
                  : '1px solid var(--border-faint)',
                background: selectedStrategy === s.value ? 'var(--bg-hover)' : 'transparent',
                color: selectedStrategy === s.value ? 'var(--text-primary)' : 'var(--text-faint)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{ marginRight: 3 }}>{s.icon}</span>
              {t(s.labelKey, { defaultValue: s.defaultLabel })}
            </button>
          ))}
        </div>

        {/* 各段路线（自然流式布局，由外层overflowY:auto控制滚动） */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: isMobile ? 24 : 12 }}>
          {Array.isArray(result.legs) && result.legs.map((leg, li) => (
            <LegSection
              key={li}
              leg={leg}
              legIndex={li}
              onSelectOption={(oi) => onSelectLegOption(li, oi)}
            />
          ))}

          {(!result.legs || result.legs.length === 0) && (
            <div style={{ fontSize: 13, color: 'var(--text-faint)', textAlign: 'center', padding: '24px 0' }}>
              {t('transit.noRoutes', { defaultValue: '未找到公交路线' })}
            </div>
          )}
        </div>
      </div>
    </>
  )

  // Portal渲染到document.body,绕过父容器overflow/transform限制
  return ReactDOM.createPortal(
    <TransitErrorBoundary>{panel}</TransitErrorBoundary>,
    document.body
  )
}
