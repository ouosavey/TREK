import React from 'react'
import ReactDOM from 'react-dom'
import {
  Footprints, Bus, Train as TrainIcon, ChevronDown, ChevronRight,
  MapPin, Clock, Coins, Navigation, X, ArrowRight, Plane,
  CircleDot, Circle
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

function estimateCalories(meters: number): number {
  // 大约每米消耗 0.05 大卡（步行）
  return Math.round(meters * 0.05)
}

// ════════════════════════════════════════════════════════════════════════════
// ── 时间线式详细导航视图（核心升级） ────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

/** 时间线节点：起点 */
function TimelineStart({ name }: { name: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {/* 左侧时间轴 */}
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
      {/* 右侧内容 */}
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
        <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 21 }}>方案时长包含等车时长</span>
      </div>
    </div>
  )
}

/** 时间线节点：步行段 */
function TimelineWalk({ segment }: { segment: TransitSegment }) {
  const cal = estimateCalories(segment.distance)
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
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          <Footprints size={13} style={{ color: '#6b7280', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
            步行{formatDistance(segment.distance)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            ({formatDurationShort(segment.duration)})
          </span>
          {cal > 0 && (
            <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
              消耗{cal}大卡
            </span>
          )}
        </div>
        {segment.instruction && (
          <div style={{
            fontSize: 11.5, color: 'var(--text-secondary)',
            marginTop: 3, lineHeight: 1.5,
          }}>
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
  const [expanded, setExpanded] = React.useState(true)

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {/* 左侧时间轴 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0, paddingTop: 4 }}>
        <div style={{
          width: 18, height: 18, borderRadius: 4,
          background: color, border: `2px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 1px 4px ${color}40`,
        }}>
          {isSubway
            ? <TrainIcon size={9} style={{ color: 'white' }} strokeWidth={2.5} />
            : <Bus size={9} style={{ color: 'white' }} strokeWidth={2.5} />
          }
        </div>
        <div style={{ width: 2.5, flex: 1, minHeight: 16, background: `${color}35`, marginTop: 2 }} />
      </div>

      {/* 右侧内容 */}
      <div style={{ flex: 1, paddingBottom: 10, minWidth: 0 }}>
        {/* 站名（上车站） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
          {isSubway
            ? <TrainIcon size={14} style={{ color, flexShrink: 0 }} />
            : <Bus size={14} style={{ color, flexShrink: 0 }} />
          }
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
            {segment.departureStop}
          </span>
          {isSubway && (
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>地铁进站指引 &gt;</span>
          )}
        </div>

        {/* 线路信息卡片 */}
        <div style={{
          background: 'var(--bg-tertiary)', borderRadius: 8,
          padding: '8px 10px', marginTop: 4, marginBottom: 4,
        }}>
          {/* 线路名 + 方向 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{
              fontSize: 11.5, fontWeight: 700, color: 'white',
              background: color, padding: '1.5px 7px', borderRadius: 4,
              whiteSpace: 'nowrap', letterSpacing: '0.02em',
            }}>
              {segment.lineName || (isSubway ? '地铁' : '公交')}
            </span>
            {segment.instruction && (
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {segment.instruction.replace(/^乘坐/, '')}
              </span>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-faint)', marginLeft: 'auto' }}>
              到站时刻表 &gt;
            </span>
          </div>

          {/* 可展开的详情 */}
          {expanded && (
            <>
              {/* 站点信息 */}
              <div style={{
                fontSize: 11.5, color: 'var(--text-secondary)',
                padding: '4px 0', lineHeight: 1.7,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CircleDot size={8} style={{ color: '#22c55e', flexShrink: 0 }} />
                  <span>{segment.departureStop}</span>
                  <span style={{ color: 'var(--text-faint)', fontSize: 10.5, marginLeft: 'auto' }}>
                    上车站
                  </span>
                </div>
                {segment.viaStops != null && segment.viaStops > 0 && (
                  <div style={{ paddingLeft: 4, color: 'var(--text-faint)', fontSize: 10.5, paddingTop: 1, paddingBottom: 1 }}>
                    <Navigation size={9} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
                    {segment.viaStops}站 ({formatDurationShort(segment.duration)})
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 2 }}>
                  <Circle size={8} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <span>{segment.arrivalStop}</span>
                  <span style={{ color: 'var(--text-faint)', fontSize: 10.5, marginLeft: 'auto' }}>
                    下车站
                  </span>
                </div>
              </div>

              {/* 时长+距离 */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                paddingTop: 4, borderTop: '1px solid var(--border-faint)',
                fontSize: 10.5, color: 'var(--text-faint)',
              }}>
                <span><Clock size={9} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 2 }} />{formatDurationShort(segment.duration)}</span>
                <span><Navigation size={9} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 2 }} />{formatDistance(segment.distance)}</span>
              </div>
            </>
          )}

          {/* 展开/收起按钮 */}
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              display: 'flex', alignItems: 'center', gap: 2,
              marginTop: expanded ? 4 : 0, padding: '2px 0',
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 10.5, color: 'var(--text-faint)',
              width: 'fit-content',
            }}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>{expanded ? '收起详情' : `${segment.viaStops || 0}站 (${formatDurationShort(segment.duration)})`}</span>
          </button>
        </div>

        {/* 下车站名 */}
        {(segment.arrivalStop && segment.arrivalStop !== segment.departureStop) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            {isSubway && (
              <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>地铁出站指引 &gt;</span>
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {segment.arrivalStop}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>(出入口)</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ── 方案摘要标签（用于未选中的备选方案） ─────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

function OptionSummaryBadge({ option, index, isSelected, onSelect }: {
  option: TransitRouteOption; index: number; isSelected: boolean; onSelect: () => void
}) {
  const segs = Array.isArray(option.segments) ? option.segments : []
  const subwayCount = segs.filter(s => s.type === 'subway').length
  const busCount = segs.filter(s => s.type === 'bus').length

  return (
    <button
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '8px 12px',
        border: `1.5px solid ${isSelected ? 'var(--text-primary)' : 'var(--border-faint)'}`,
        borderRadius: 10, background: isSelected ? 'var(--bg-hover)' : 'transparent',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        transition: 'all 0.15s',
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: isSelected ? 'var(--text-primary)' : 'var(--bg-tertiary)',
        color: isSelected ? 'white' : 'var(--text-faint)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}>
        {index + 1}
      </div>
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>
        {formatDuration(option.duration)} 步行{formatDistance(option.walkingDistance)}
      </span>
      {/* 线路标签 */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {segs.filter(s => s.type === 'subway').slice(0, 3).map((seg, i) => (
          <span key={i} style={{
            fontSize: 9.5, fontWeight: 600, color: 'white',
            background: getLineColor(seg.lineName, seg.lineColor),
            padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap',
          }}>
            {seg.lineName || '地铁'}
          </span>
        ))}
        {segs.filter(s => s.type === 'bus').slice(0, 2).map((seg, i) => (
          <span key={i} style={{
            fontSize: 9.5, fontWeight: 600, color: '#fff',
            background: '#3b82f6', padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap',
          }}>
            公交
          </span>
        ))}
      </div>
      {option.cost > 0 && (
        <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>
          ¥{option.cost.toFixed(0)}
        </span>
      )}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ── 单段路线区块（带目的地标题） ─────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

function LegSection({ leg, legIndex, onSelectOption }: {
  leg: TransitLeg; legIndex: number; onSelectOption: (optIdx: number) => void
}) {
  const { t } = useTranslation()
  const selectedOpt = leg.options[leg.selectedOptionIndex]
  const segs = Array.isArray(selectedOpt?.segments) ? selectedOpt.segments : []

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
              <span style={{ fontSize: 10, color: '#b8860b' }}>票价以12306实际查询为准</span>
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

  // 正常路线：展示选中方案的完整时间线 + 其他方案为紧凑卡片
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
      </div>

      {/* 选中方案：完整时间线导航 */}
      {selectedOpt && (
        <div style={{ padding: '12px 14px' }}>
          {/* 方案概要条 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: 8,
            marginBottom: 12,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatDuration(selectedOpt.duration)}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              步行{formatDistance(selectedOpt.walkingDistance)}
            </span>
            {/* 线路标签 */}
            {segs.filter(s => s.type === 'subway').map((seg, i) => (
              <span key={i} style={{
                fontSize: 10.5, fontWeight: 700, color: 'white',
                background: getLineColor(seg.lineName, seg.lineColor),
                padding: '2px 8px', borderRadius: 4,
              }}>
                {seg.lineName || '地铁'}
              </span>
            ))}
            {segs.filter(s => s.type === 'bus').map((seg, i) => (
              <span key={i} style={{
                fontSize: 10.5, fontWeight: 700, color: 'white',
                background: '#3b82f6', padding: '2px 8px', borderRadius: 4,
              }}>
                {seg.lineName || '公交'}
              </span>
            ))}
            {selectedOpt.cost > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                {segs.filter(s => s.type === 'subway' || s.type === 'bus').length}条 &middot;
                ¥{selectedOpt.cost.toFixed(0)}
              </span>
            )}
            {segs[0]?.departureStop && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {segs[0].departureStop.match(/[\(（]/)?.[0]?.replace(/[\(（].*/, '') || segs[0].departureStop}进站
              </span>
            )}
          </div>

          {/* 时间线 */}
          <div style={{ paddingLeft: 2 }}>
            {/* 起点 */}
            <TimelineStart name={leg.fromName} />

            {/* 各段 */}
            {segs.map((seg, si) => (
              <React.Fragment key={si}>
                {seg.type === 'walk'
                  ? <TimelineWalk segment={seg} />
                  : <TimelineTransit segment={seg} />
                }
              </React.Fragment>
            ))}

            {/* 终点 */}
            <TimelineEnd name={leg.toName} />
          </div>
        </div>
      )}

      {/* 备选方案列表 */}
      {leg.options.length > 1 && (
        <div style={{
          padding: '8px 12px 10px',
          borderTop: '1px solid var(--border-faint)',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            其他方案
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {leg.options.map((opt, i) =>
              i !== leg.selectedOptionIndex && (
                <OptionSummaryBadge
                  key={i}
                  option={opt}
                  index={i}
                  isSelected={false}
                  onSelect={() => onSelectOption(i)}
                />
              )
            )}
          </div>
        </div>
      )}
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
  onSelectLegOption, onSelectStrategy, onClose,
}: TransitRoutePanelProps) {
  const { t } = useTranslation()

  const [isMobile, setIsMobile] = React.useState(() => typeof window !== 'undefined' && window.innerWidth <= 768)
  const [mounted, setMounted] = React.useState(false)

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

        {/* 标题栏 */}
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
                {formatDuration(totalDur)} &middot; ¥{totalCost.toFixed(0)}
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
