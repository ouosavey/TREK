import React from 'react'
import ReactDOM from 'react-dom'
import html2canvas from 'html2canvas'
import {
  Footprints, Bus, Train as TrainIcon, ChevronDown, ChevronRight,
  MapPin, Clock, Navigation, X, ArrowRight, Plane,
  CircleDot, Circle, Camera, Download, Loader2
} from 'lucide-react'
import type { TransitRouteResult, TransitRouteOption, TransitSegment, TransitLeg } from '../../types'
import { useTranslation } from '../../i18n'
import { filesApi } from '../../api/client'

interface TransitRoutePanelProps {
  result: TransitRouteResult
  selectedStrategy: number
  onSelectLegOption: (legIndex: number, optionIndex: number) => void
  onSelectStrategy: (strategy: number) => void
  onClose: () => void
  tripId?: number
}

// ── 策略定义 ─────────────────────────────────────────────────────────────

const STRATEGIES = [
  { value: 0, labelKey: 'transit.strategy.fastest', defaultLabel: '最快', icon: '⚡' },
  { value: 1, labelKey: 'transit.strategy.cheapest', defaultLabel: '最省钱', icon: '💰' },
  { value: 2, labelKey: 'transit.strategy.leastTransfer', defaultLabel: '最少换乘', icon: '🔄' },
  { value: 3, labelKey: 'transit.strategy.leastWalk', defaultLabel: '少步行', icon: '🚶' },
]

// ── 颜色工具 ──────────────────────────────────────────────────────────────

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

// ── 错误边界 ──────────────────────────────────────────────────────────────

export class TransitErrorBoundary extends React.Component<any, any> {
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

// ── 格式化工具 ──────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}小时${m > 0 ? m + '分钟' : ''}`
  return `${m}分钟`
}

function formatDurationShort(seconds: number): string {
  const m = Math.round(seconds / 60)
  return `${m}分钟`
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}米`
  return `${(meters / 1000).toFixed(1)}公里`
}

/** 生成方案摘要文字：如 "地铁2条，公交1条" */
function getOptionSummary(segments: TransitSegment[]): string {
  const subwayCount = segments.filter(s => s.type === 'subway').length
  const busCount = segments.filter(s => s.type === 'bus').length
  const parts: string[] = []
  if (subwayCount > 0) parts.push(`地铁${subwayCount}条`)
  if (busCount > 0) parts.push(`公交${busCount}条`)
  return parts.join('，') || '步行'
}

// ════════════════════════════════════════════════════════════════════════════
// ── 时间线式详细导航视图 ────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

/** 时间线节点：起点 */
function TimelineStart({ name }: { name: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0, paddingTop: 2 }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          background: '#22c55e', border: '2.5px solid #bbf7d0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 7, fontWeight: 700, color: 'white' }}>起</span>
        </div>
        <div style={{ width: 2.5, flex: 1, minHeight: 20, background: '#e5e7eb', marginTop: 2 }} />
      </div>
      <div style={{ flex: 1, paddingBottom: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={15} style={{ color: '#22c55e', flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
        </div>
      </div>
    </div>
  )
}

/** 时间线节点：终点 */
function TimelineEnd({ name }: { name: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0, paddingTop: 2 }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          background: '#ef4444', border: '2.5px solid #fecaca',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 7, fontWeight: 700, color: 'white' }}>终</span>
        </div>
      </div>
      <div style={{ flex: 1, paddingBottom: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={15} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
        </div>
      </div>
    </div>
  )
}

/** 时间线节点：步行段 */
function TimelineWalk({ segment }: { segment: TransitSegment }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0, paddingTop: 4 }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          background: 'white', border: '2px solid #9ca3af',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Footprints size={7} style={{ color: '#6b7280' }} />
        </div>
        <div style={{ width: 2.5, flex: 1, minHeight: 16, background: '#e5e7eb', marginTop: 2 }} />
      </div>
      <div style={{ flex: 1, paddingBottom: 10, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Footprints size={13} style={{ color: '#6b7280', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
            步行{formatDistance(segment.distance)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            ({formatDurationShort(segment.duration)})
          </span>
        </div>
        {segment.instruction && (
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
            {segment.instruction}
          </div>
        )}
      </div>
    </div>
  )
}

/** 时间线节点：地铁/公交段 */
function TimelineTransit({ segment }: { segment: TransitSegment }) {
  const isSubway = segment.type === 'subway'
  const color = getLineColor(segment.lineName, segment.lineColor)

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {/* 左侧时间轴 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 26, flexShrink: 0, paddingTop: 4 }}>
        <div style={{
          width: 20, height: 20, borderRadius: isSubway ? 5 : 6,
          background: color, border: `2px solid ${color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 1.5px 5px ${color}35`,
        }}>
          {isSubway
            ? <TrainIcon size={10} style={{ color: 'white' }} strokeWidth={2.5} />
            : <Bus size={10} style={{ color: 'white' }} strokeWidth={2.5} />
          }
        </div>
        <div style={{ width: 3, flex: 1, minHeight: 18, background: `${color}20`, marginTop: 3, borderRadius: 1.5 }} />
      </div>

      {/* 右侧内容 */}
      <div style={{ flex: 1, paddingBottom: 12, minWidth: 0 }}>
        {/* 上车站名 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
          {isSubway
            ? <TrainIcon size={15} style={{ color, flexShrink: 0 }} />
            : <Bus size={15} style={{ color, flexShrink: 0 }} />
          }
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {segment.departureStop}
          </span>
        </div>

        {/* 线路信息卡片 */}
        <div style={{
          background: 'var(--bg-tertiary)', borderRadius: 10,
          padding: '9px 11px', marginTop: 4, marginBottom: 4,
          border: `1px solid ${color}15`,
        }}>
          {/* 线路名标签 + 方向 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 12, fontWeight: 800, color: 'white',
              background: color, padding: '2px 9px', borderRadius: 5,
              whiteSpace: 'nowrap',
            }}>
              {segment.lineName || (isSubway ? '地铁' : '公交')}
            </span>
            {segment.instruction && (
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 500 }}>
                {segment.instruction.replace(/^乘坐/, '')}
              </span>
            )}
          </div>

          {/* 站点信息 */}
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <CircleDot size={9} style={{ color: '#22c55e', flexShrink: 0 }} />
              <span style={{ fontWeight: 500 }}>{segment.departureStop}</span>
              <span style={{ color: 'var(--text-faint)', fontSize: 10.5, marginLeft: 'auto' }}>上车站</span>
            </div>
            {segment.viaStops != null && segment.viaStops > 0 && (
              <div style={{
                paddingLeft: 5, color: 'var(--text-muted)',
                fontSize: 10.5, paddingTop: 1, paddingBottom: 2,
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <Navigation size={9} />
                <span>{segment.viaStops} 站 ({formatDurationShort(segment.duration)})</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 2 }}>
              <Circle size={9} style={{ color: '#ef4444', flexShrink: 0 }} />
              <span style={{ fontWeight: 500 }}>{segment.arrivalStop}</span>
              <span style={{ color: 'var(--text-faint)', fontSize: 10.5, marginLeft: 'auto' }}>下车站</span>
            </div>
          </div>

          {/* 底部信息条：时长 | 距离 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            paddingTop: 5, borderTop: '1px solid var(--border-faint)',
            fontSize: 10.5, color: 'var(--text-faint)',
          }}>
            <span><Clock size={9} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 2 }} />{formatDurationShort(segment.duration)}</span>
            <span><Navigation size={9} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 2 }} />{formatDistance(segment.distance)}</span>
          </div>
        </div>

        {/* 下车站名 */}
        {(segment.arrivalStop && segment.arrivalStop !== segment.departureStop) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {segment.arrivalStop}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ── 方案卡片（可折叠，标题简洁） ────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

function OptionCard({ option, index, isSelected, isExpanded, onSelect, onToggle }: {
  option: TransitRouteOption; index: number; isSelected: boolean; isExpanded: boolean
  onSelect: () => void; onToggle: () => void
}) {
  const segs = Array.isArray(option.segments) ? option.segments : []
  const summary = getOptionSummary(segs)

  return (
    <div style={{
      borderRadius: 10, overflow: 'hidden',
      border: `1.5px solid ${isSelected ? 'var(--text-primary)' : 'var(--border-faint)'}`,
      background: isSelected ? 'var(--bg-hover)' : 'var(--bg-card)',
      transition: 'all 0.15s',
    }}>
      {/* 标题栏：简洁摘要，点击展开/收起 + 选中 */}
      <button
        onClick={() => { onSelect(); onToggle() }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '10px 12px',
          border: 'none', background: 'transparent',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        {/* 序号 */}
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: isSelected ? 'var(--text-primary)' : 'var(--bg-tertiary)',
          color: isSelected ? 'white' : 'var(--text-faint)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>
          {index + 1}
        </div>

        {/* 时长 + 步行距离 */}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {formatDuration(option.duration)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          步行{formatDistance(option.walkingDistance)}
        </span>

        {/* 简洁摘要：地铁N条，公交N条 */}
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {summary}
        </span>

        {/* 展开/收起箭头 */}
        <span style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--text-faint)', display: 'flex', alignItems: 'center' }}>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {/* 展开后的详情时间线 */}
      {isExpanded && (
        <div style={{ padding: '4px 14px 12px', borderTop: '1px solid var(--border-faint)' }}>
          <div style={{ paddingLeft: 2 }}>
            <TimelineStart name={segs[0]?.departureStop || ''} />
            {segs.map((seg, si) => (
              <React.Fragment key={si}>
                {seg.type === 'walk'
                  ? <TimelineWalk segment={seg} />
                  : <TimelineTransit segment={seg} />
                }
              </React.Fragment>
            ))}
            <TimelineEnd name={segs[segs.length - 1]?.arrivalStop || ''} />
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ── 单段路线区块 ─────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

function LegSection({ leg, legIndex, onSelectOption }: {
  leg: TransitLeg; legIndex: number; onSelectOption: (optIdx: number) => void
}) {
  const { t } = useTranslation()
  // 默认所有方案都折叠
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(null)

  // 错误处理（跨城 / 无法识别城市）
  if (leg.error) {
    if (leg.crossCityInfo) {
      const info = leg.crossCityInfo
      return (
        <div style={{
          borderRadius: 12, overflow: 'hidden',
          border: '1px solid #e8a838',
          background: 'linear-gradient(135deg, #fff9f0 0%, #fff5e6 100%)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', background: 'rgba(232,168,56,0.08)',
            borderBottom: '1px solid rgba(232,168,56,0.2)',
          }}>
            <Navigation size={14} style={{ color: '#e8a838', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{leg.fromName}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#b8860b' }}>
              &rarr; {leg.toName}
            </span>
          </div>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: '#996515', marginBottom: 10, textAlign: 'center' }}>
              {leg.error}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {info.suggestTrain && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  padding: '12px 16px', borderRadius: 10, background: 'white',
                  border: '1.5px solid #3b82f6', minWidth: 100,
                }}>
                  <TrainIcon size={24} style={{ color: '#3b82f6' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>高铁/火车</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>约{info.estHours}小时</span>
                  <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{info.distanceKm}km</span>
                </div>
              )}
              {info.suggestPlane && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  padding: '12px 16px', borderRadius: 10, background: 'white',
                  border: '1.5px solid #8b5cf6', minWidth: 100,
                }}>
                  <Plane size={24} style={{ color: '#8b5cf6' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#5b21b6' }}>飞机</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>约2-3小时</span>
                  <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{info.distanceKm}km</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <a href={get12306Url(leg.fromName, leg.toName)} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 16px', borderRadius: 8,
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: 'white', fontSize: 12, fontWeight: 600,
                textDecoration: 'none', fontFamily: 'inherit',
                boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
              }}>
                <TrainIcon size={14} /> 12306 查询购票
              </a>
            </div>
          </div>
        </div>
      )
    }

    // 普通错误
    return (
      <div style={{
        borderRadius: 10, overflow: 'hidden',
        border: '1px dashed var(--border-faint)',
        background: 'var(--bg-tertiary)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 12px', borderBottom: '1px dashed var(--border-faint)',
        }}>
          <ArrowRight size={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{leg.fromName}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{leg.toName}</span>
        </div>
        <div style={{ padding: '8px 12px', fontSize: 11.5, color: 'var(--text-faint)', textAlign: 'center' }}>
          {leg.error}
        </div>
      </div>
    )
  }

  // 正常路线：所有方案以可折叠卡片展示
  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      border: '1px solid var(--border-faint)',
      background: 'var(--bg-card)',
    }}>
      {/* 段标题头 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 12px', background: 'var(--bg-hover)',
        borderBottom: '1px solid var(--border-faint)',
      }}>
        <ArrowRight size={13} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{leg.fromName}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          &rarr; {leg.toName}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>
          {leg.options.length}个方案
        </span>
      </div>

      {/* 方案列表 */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {leg.options.map((opt, i) => (
          <OptionCard
            key={i}
            option={opt}
            index={i}
            isSelected={i === leg.selectedOptionIndex}
            isExpanded={expandedIdx === i}
            onSelect={() => { onSelectOption(i); setExpandedIdx(i) }}
            onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
          />
        ))}
      </div>
    </div>
  )
}

// ── 12306 购票链接生成 ────────────────────────────────────────────────

const STATION_CODES: Record<string, string> = {
  '北京西': 'BXP', '北京南': 'VNP', '北京': 'BJP', '北京丰台': 'FTP',
  '上海': 'SHH', '上海虹桥': 'AOH', '上海南站': 'SXH',
  '广州南': 'IZQ', '广州': 'GZQ', '深圳北': 'IOQ', '深圳': 'SZQ',
  '天津西': 'TXP', '天津': 'TJP', '天津南': 'TIP',
  '重庆北': 'CUW', '重庆': 'CQW', '重庆西': 'CXW',
  '汉口': 'HK', '武汉': 'WHN', '武昌': 'WCN', '武汉站': 'WKN',
  '郑州东': 'ZAF', '郑州': 'ZZF',
  '南京南': 'NKH', '南京': 'NJH',
  '杭州东': 'HGH', '杭州': 'HZH',
  '成都东': 'ICW', '成都': 'CDW',
  '西安北': 'EAY', '西安': 'XAY',
  '长沙南': 'CSQ', '长沙': 'CSQ',
  '合肥南': 'UEH', '济南西': 'JGK', '沈阳北': 'SYT', '长春': 'CCT',
  '哈尔滨西': 'HBB', '福州南': 'XKS', '南昌西': 'NKG', '南宁东': 'NNZ',
  '贵阳北': 'KIW', '昆明南': 'KMM', '兰州西': 'LZH', '乌鲁木齐': 'WMR',
  '太原南': 'TAV', '石家庄': 'SJP', '厦门北': 'XMS', '青岛北': 'QDK',
  '大连北': 'DLT', '宁波': 'NGH', '苏州北': 'RKH', '无锡': 'UXH',
  '合肥': 'HFH', '徐州东': 'EUH', '洛阳龙门': 'LYF',
}

function getStationCode(name: string): string {
  if (STATION_CODES[name]) return STATION_CODES[name]
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
  if (fromCode && toCode) {
    const fs = encodeURIComponent(`${fromName},${fromCode}`)
    const ts = encodeURIComponent(`${toName},${toCode}`)
    return `https://kyfw.12306.cn/otn/leftTicket/init?linktypeid=dc&fs=${fs}&ts=${ts}&date=${dateStr}&flag=N,N,Y`
  }
  return 'https://kyfw.12306.cn/otn/leftTicket/init'
}

// ════════════════════════════════════════════════════════════════════════════
// ── 主面板 ───────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

export default function TransitRoutePanel({
  result, selectedStrategy,
  onSelectLegOption, onSelectStrategy, onClose, tripId,
}: TransitRoutePanelProps) {
  const { t } = useTranslation()

  const [isMobile, setIsMobile] = React.useState(() => typeof window !== 'undefined' && window.innerWidth <= 768)
  const [mounted, setMounted] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [showExportMenu, setShowExportMenu] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)

  // 生成截图 canvas：onclone 中修复定位 + 内联所有computed styles
  const captureCanvas = React.useCallback(async () => {
    if (!contentRef.current) return null

    // 预先收集原始元素和克隆元素的映射，在 onclone 中内联 computed styles
    // 这是解决 html2canvas 无法正确解析 CSS 变量 + Tailwind class 的最可靠方案
    const rootBg = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#ffffff'

    return html2canvas(contentRef.current, {
      scale: 2,
      backgroundColor: rootBg,
      useCORS: true,
      logging: false,
      onclone: (clonedDoc, element) => {
        // 通过 data 属性找到克隆的面板元素
        const target = clonedDoc.querySelector('[data-transit-export]') as HTMLElement | null
        if (!target) return

        // 1. 隐藏遮罩层（fixed overlay）
        const overlay = clonedDoc.body.firstChild as HTMLElement
        if (overlay && overlay.style && overlay.style.position === 'fixed' && overlay.style.background?.includes('0,0,0')) {
          overlay.style.display = 'none'
        }

        // 2. 把面板从 position:fixed 改为 relative，让 html2canvas 能正确渲染
        target.style.position = 'relative'
        target.style.top = ''
        target.style.left = ''
        target.style.right = ''
        target.style.bottom = ''
        target.style.transform = ''
        target.style.zIndex = ''
        target.style.maxHeight = ''
        target.style.height = 'auto'
        target.style.overflow = 'visible'

        // 3. 对每个子元素内联 computed style（解决 html2canvas 无法解析 CSS 变量的问题）
        // 遍历原始 DOM 和克隆 DOM，将原始元素的 computed style 内联到克隆元素上
        const origWalker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT)
        const cloneWalker = clonedDoc.createTreeWalker(target, NodeFilter.SHOW_ELEMENT)
        const origElements: Element[] = []
        while (origWalker.nextNode()) origElements.push(origWalker.currentNode as Element)

        let origIdx = 0
        // 先处理 target 自身
        const targetOrig = element
        if (targetOrig) {
          const cs = getComputedStyle(targetOrig as HTMLElement)
          const propsToInline = [
            'color', 'background', 'backgroundColor', 'backgroundImage',
            'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'letterSpacing',
            'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
            'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
            'border', 'borderRadius', 'borderColor', 'borderWidth',
            'display', 'flexDirection', 'alignItems', 'justifyContent', 'gap',
            'width', 'height', 'minWidth', 'maxWidth',
            'overflow', 'whiteSpace', 'textOverflow', 'textAlign',
            'opacity', 'boxShadow', 'textDecoration',
          ]
          for (const prop of propsToInline) {
            const val = cs.getPropertyValue(prop)
            if (val) (target as HTMLElement).style.setProperty(prop, val)
          }
        }

        // 处理子元素
        while (cloneWalker.nextNode()) {
          if (origIdx >= origElements.length) break
          const origEl = origElements[origIdx] as HTMLElement
          const cloneEl = cloneWalker.currentNode as HTMLElement
          origIdx++

          try {
            const cs = getComputedStyle(origEl)
            // 内联影响布局和渲染的关键属性
            const propsToInline = [
              'color', 'background', 'backgroundColor', 'backgroundImage',
              'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'letterSpacing',
              'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
              'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
              'border', 'borderRadius', 'borderColor', 'borderWidth',
              'display', 'flexDirection', 'alignItems', 'justifyContent', 'gap',
              'width', 'height', 'minWidth', 'maxWidth',
              'overflow', 'whiteSpace', 'textOverflow', 'textAlign',
              'opacity', 'boxShadow', 'textDecoration',
            ]
            for (const prop of propsToInline) {
              const val = cs.getPropertyValue(prop)
              if (val) cloneEl.style.setProperty(prop, val)
            }
          } catch { /* skip */ }
        }
      },
    })
  }, [])

  // 保存图片到本地
  const handleSaveLocal = React.useCallback(async () => {
    setShowExportMenu(false)
    // 等待 React 将 showExportMenu=false 渲染到 DOM，避免截到导出菜单
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    if (exporting) return
    setExporting(true)
    try {
      const canvas = await captureCanvas()
      if (!canvas) { setExporting(false); return }
      const now = new Date()
      const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
      const timeStr = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`
      const filename = `公交路线_${dateStr}_${timeStr}.png`
      const link = document.createElement('a')
      link.download = filename
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) {
      console.error('保存图片失败', e)
    }
    setExporting(false)
  }, [exporting, captureCanvas])

  // 添加到旅行文件
  const handleSaveToTrip = React.useCallback(async () => {
    setShowExportMenu(false)
    // 等待 React 将 showExportMenu=false 渲染到 DOM，避免截到导出菜单
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    if (!tripId || exporting) return
    setExporting(true)
    try {
      const canvas = await captureCanvas()
      if (!canvas) { setExporting(false); return }
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) { setExporting(false); return }
      const now = new Date()
      const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
      const timeStr = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`
      const filename = `公交路线_${dateStr}_${timeStr}.png`
      const formData = new FormData()
      formData.append('file', blob, filename)
      formData.append('description', '公交/地铁路线规划详情')
      await filesApi.upload(tripId, formData)
    } catch (e) {
      console.error('添加到旅行文件失败', e)
    }
    setExporting(false)
  }, [tripId, exporting, captureCanvas])

  React.useEffect(() => { setMounted(true) }, [])
  React.useEffect(() => {
    if (!mounted) return
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mounted])

  if (!mounted) return null

  // 统计
  const totalDur = result.legs.reduce((s, l) =>
    s + (l.options[l.selectedOptionIndex]?.duration || 0), 0)
  const successLegs = result.legs.filter(l => !l.error).length

  const panel = (
    <>
      {/* 遮罩层 */}
      <div
        onClick={() => { setShowExportMenu(false); onClose() }}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 9998,
          WebkitTapHighlightColor: 'transparent',
        }}
      />

      {/* 面板主体 — contentRef 放在这里以导出完整面板（含标题栏+策略标签） */}
      <div ref={contentRef} data-transit-export style={{
        position: 'fixed',
        ...(!isMobile ? {
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(520px, calc(100vw - 32px))',
          maxHeight: '85vh',
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
        border: '1px solid var(--border-faint)',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* 移动端拖拽指示条 */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 6, paddingBottom: 8, flexShrink: 0 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-primary)' }} />
          </div>
        )}

        {/* 标题栏（不显示金额） */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 10px', borderBottom: '1px solid var(--border-faint)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: isMobile ? 15 : 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('transit.title', { defaultValue: '公交/地铁路线' })}
            </span>
            {successLegs > 0 && (
              <span style={{ fontSize: isMobile ? 11 : 10.5, color: '#fff', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                {formatDuration(totalDur)}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            {/* 导出按钮 */}
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
              title="导出路线"
              style={{
                background: exporting ? 'var(--bg-tertiary)' : 'linear-gradient(135deg,#10b981,#059669)',
                border: 'none', borderRadius: 8,
                cursor: exporting ? 'not-allowed' : 'pointer',
                color: 'white',
                width: isMobile ? 32 : 28, height: isMobile ? 32 : 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, opacity: exporting ? 0.7 : 1,
              }}
            >
              {exporting ? <Loader2 size={isMobile ? 15 : 13} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={isMobile ? 15 : 13} />}
            </button>

            {/* 导出选择弹窗 */}
            {showExportMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6,
                background: 'var(--bg-secondary)', borderRadius: 10,
                border: '1px solid var(--border-faint)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                padding: '6px', minWidth: 180, zIndex: 10,
              }}>
                <button
                  onClick={handleSaveLocal}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '10px 12px',
                    border: 'none', background: 'transparent',
                    borderRadius: 7, cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Download size={15} style={{ color: '#3b82f6', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>保存图片到本地</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>下载 PNG 到设备</div>
                  </div>
                </button>
                {tripId && (
                  <button
                    onClick={handleSaveToTrip}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '10px 12px',
                      border: 'none', background: 'transparent',
                      borderRadius: 7, cursor: 'pointer',
                      fontFamily: 'inherit', textAlign: 'left',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Plane size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>添加到旅行文件</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>保存至本次旅行的文件区</div>
                    </div>
                  </button>
                )}
              </div>
            )}

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
        </div>

        {/* 换乘策略选择器 */}
        <div style={{
          display: 'flex', gap: 4, flexWrap: 'wrap',
          padding: '8px 16px', borderBottom: '1px solid var(--border-faint)',
          flexShrink: 0,
        }}>
          {STRATEGIES.map(s => (
            <button
              key={s.value}
              onClick={() => onSelectStrategy(s.value)}
              style={{
                padding: isMobile ? '6px 12px' : '4px 10px',
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

        {/* 可滚动内容区 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          padding: '10px 14px',
          minHeight: 0,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: isMobile ? 28 : 14 }}>
            {Array.isArray(result.legs) && result.legs.map((leg, li) => (
              <LegSection
                key={li}
                leg={leg}
                legIndex={li}
                onSelectOption={(oi) => onSelectLegOption(li, oi)}
              />
            ))}

            {(!result.legs || result.legs.length === 0) && (
              <div style={{ fontSize: 13, color: 'var(--text-faint)', textAlign: 'center', padding: '32px 0' }}>
                {t('transit.noRoutes', { defaultValue: '未找到公交路线' })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )

  return ReactDOM.createPortal(
    <TransitErrorBoundary>{panel}</TransitErrorBoundary>,
    document.body
  )
}
