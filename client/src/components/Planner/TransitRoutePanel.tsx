import React from 'react'
import {
  Footprints, Bus, Train as TrainIcon, ChevronDown, ChevronRight,
  MapPin, Clock, Coins, Navigation, X, ArrowRight
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
  const subwayCount = option.segments.filter(s => s.type === 'subway').length
  const busCount = option.segments.filter(s => s.type === 'bus').length
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
            {option.segments.map((seg, si) => (
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

// ── 单段路线区块（带目的地标题） ─────────────────────────────────────────

function LegSection({ leg, legIndex, onSelectOption }: {
  leg: TransitLeg; legIndex: number; onSelectOption: (optIdx: number) => void
}) {
  const { t } = useTranslation()

  if (leg.error) {
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
        {leg.options.map((option, i) => (
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

  // 汇总统计
  const totalDur = result.legs.reduce((s, l) =>
    s + (l.options[l.selectedOptionIndex]?.duration || 0), 0)
  const totalCost = result.legs.reduce((s, l) =>
    s + (l.options[l.selectedOptionIndex]?.cost || 0), 0)
  const successLegs = result.legs.filter(l => !l.error).length

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 12,
      maxHeight: '70vh', overflowY: 'auto',
    }}>
      {/* 标题栏 + 汇总 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('transit.title', { defaultValue: '公交/地铁' })}
          </span>
          {successLegs > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text-faint)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 4 }}>
              {formatDuration(totalDur)} · ¥{totalCost.toFixed(0)}
            </span>
          )}
        </div>
        <button onClick={onClose} style={{
          background: 'var(--bg-tertiary)', border: 'none', borderRadius: '50%',
          cursor: 'pointer', color: 'var(--text-faint)', width: 22, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={12} />
        </button>
      </div>

      {/* 换乘策略选择器 */}
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap',
        paddingBottom: 6, borderBottom: '1px solid var(--border-faint)',
      }}>
        {STRATEGIES.map(s => (
          <button
            key={s.value}
            onClick={() => onSelectStrategy(s.value)}
            style={{
              padding: '3px 8px', fontSize: 11, borderRadius: 6,
              border: selectedStrategy === s.value
                ? '1.5px solid var(--text-primary)'
                : '1px solid var(--border-faint)',
              background: selectedStrategy === s.value ? 'var(--bg-hover)' : 'transparent',
              color: selectedStrategy === s.value ? 'var(--text-primary)' : 'var(--text-faint)',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >
            <span style={{ marginRight: 3 }}>{s.icon}</span>
            {t(s.labelKey, { defaultValue: s.defaultLabel })}
          </button>
        ))}
      </div>

      {/* 各段路线 */}
      {result.legs.map((leg, li) => (
        <LegSection
          key={li}
          leg={leg}
          legIndex={li}
          onSelectOption={(oi) => onSelectLegOption(li, oi)}
        />
      ))}

      {result.legs.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', padding: '16px 0' }}>
          {t('transit.noRoutes', { defaultValue: '未找到公交路线' })}
        </div>
      )}
    </div>
  )
}
