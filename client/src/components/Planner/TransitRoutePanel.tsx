import React from 'react'
import {
  Footprints, Bus, Train as TrainIcon, ChevronDown, ChevronRight,
  MapPin, Clock, Coins, Navigation, X
} from 'lucide-react'
import type { TransitRouteResult, TransitRouteOption, TransitSegment } from '../../types'
import { useTranslation } from '../../i18n'

interface TransitRoutePanelProps {
  result: TransitRouteResult
  selectedOptionIndex: number
  selectedStrategy: number
  onSelectOption: (index: number) => void
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

const SEGMENT_COLORS = {
  walk: '#6b7280',
  bus: '#3b82f6',
  subway: '#ef4444',
}

// 地铁线路颜色映射（常见北京/上海/广州/深圳地铁线颜色）
const SUBWAY_LINE_COLORS: Record<string, string> = {}

function getLineColor(lineName?: string, lineColor?: string): string {
  if (lineColor && /^#[0-9a-fA-F]{6}$/.test(lineColor)) return lineColor
  if (!lineName) return SEGMENT_COLORS.subway
  // 从线路名提取数字作为颜色种子
  const numMatch = lineName.match(/(\d+)/)
  if (numMatch) {
    const n = parseInt(numMatch[1], 10)
    const hue = ((n * 47 + 13) % 360)
    return `hsl(${hue}, 70%, 50%)`
  }
  return SEGMENT_COLORS.subway
}

function SegmentIcon({ type, color }: { type: 'walk' | 'bus' | 'subway'; color?: string }) {
  const c = type === 'subway' ? (color || SEGMENT_COLORS.subway) : SEGMENT_COLORS[type]
  switch (type) {
    case 'walk': return <Footprints size={13} />
    case 'bus': return <Bus size={13} style={{ color: c }} />
    case 'subway': return <TrainIcon size={13} style={{ color: c }} />
  }
}

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

function SegmentDetail({ segment }: { segment: TransitSegment }) {
  const [expanded, setExpanded] = React.useState(false)
  const color = segment.type === 'subway'
    ? getLineColor(segment.lineName, segment.lineColor)
    : SEGMENT_COLORS[segment.type]
  const isWalk = segment.type === 'walk'

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      {/* 左侧图标和连线 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
        <div style={{
          width: 22, height: 22, borderRadius: isWalk ? '50%' : 5,
          background: isWalk ? '#f3f4f6' : color,
          border: isWalk ? '2px solid #d1d5db' : 'none',
          color: isWalk ? '#6b7280' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isWalk ? 10 : 11, flexShrink: 0,
        }}>
          <SegmentIcon type={segment.type} color={color} />
        </div>
        <div style={{ width: 2, flex: 1, minHeight: 14, background: `${color}30` }} />
      </div>

      {/* 右侧内容 - 点击展开 */}
      <div
        style={{ flex: 1, paddingBottom: 8, minWidth: 0, cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* 折叠态：只显示一行摘要 */}
        {!expanded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingTop: 1 }}>
            {/* 地铁：彩色线路名标签 */}
            {segment.type === 'subway' && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                background: `${color}15`, color: color, whiteSpace: 'nowrap',
              }}>
                {segment.lineName || ''}
              </span>
            )}
            {/* 公交：蓝色线路名标签 */}
            {segment.type === 'bus' && (
              <span style={{
                fontSize: 11, fontWeight: 500, padding: '1px 5px', borderRadius: 3,
                background: '#eff6ff', color: '#2563eb', whiteSpace: 'nowrap',
              }}>
                🚌 {segment.lineName || ''}
              </span>
            )}
            {/* 步行：文字 */}
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
        )}

        {/* 展开态：详细信息 */}
        {expanded && (
          <div style={{ paddingTop: 4, animation: 'fadeIn 0.15s ease-in' }}>
            {/* 标题行 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              {isWalk && <Footprints size={12} style={{ color: SEGMENT_COLORS.walk }} />}
              {segment.type === 'bus' && <Bus size={12} style={{ color: SEGMENT_COLORS.bus }} />}
              {segment.type === 'subway' && <TrainIcon size={12} style={{ color }} />}
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                {segment.instruction}
              </span>
              <span style={{ color: 'var(--text-faint)', fontSize: 11, marginLeft: 'auto' }}>
                {formatDuration(segment.duration)} · {formatDistance(segment.distance)}
              </span>
              <ChevronDown size={12} style={{ color: 'var(--text-faint)' }} />
            </div>

            {/* 站点信息（公交/地铁） */}
            {(segment.type === 'bus' || segment.type === 'subway') && (
              <div style={{
                fontSize: 11, color: 'var(--text-secondary)',
                background: 'var(--bg-tertiary)', borderRadius: 6, padding: '6px 8px',
                marginTop: 4, lineHeight: 1.6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0,
                  }} />
                  <span>{segment.departureStop}</span>
                </div>
                {segment.viaStops != null && segment.viaStops > 0 && (
                  <div style={{ paddingLeft: 4, color: 'var(--text-faint)', margin: '2px 0' }}>
                    ↓ 途经 {segment.viaStops} 站
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0,
                  }} />
                  <span>{segment.arrivalStop}</span>
                </div>
              </div>
            )}

            {/* 步行指引 */}
            {isWalk && segment.instruction && (
              <div style={{
                fontSize: 11, color: 'var(--text-secondary)',
                background: 'var(--bg-tertiary)', borderRadius: 6, padding: '6px 8px',
                marginTop: 4, lineHeight: 1.6,
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

/** 方案卡片顶部指标条 */
function MetricBar({ option }: { option: TransitRouteOption }) {
  const subwayCount = option.segments.filter(s => s.type === 'subway').length
  const busCount = option.segments.filter(s => s.type === 'bus').length

  return (
    <div style={{
      display: 'flex', gap: 12, padding: '6px 10px',
      background: 'var(--bg-tertiary)', borderRadius: 6,
      marginBottom: 4, fontSize: 11, flexWrap: 'wrap',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-secondary)' }}>
        <Clock size={11} />{formatDuration(option.duration)}
      </span>
      {option.cost > 0 && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-secondary)' }}>
          <Coins size={11} />¥{option.cost}
        </span>
      )}
      <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-secondary)' }}>
        <Navigation size={11} />步行 {formatDistance(option.walkingDistance)}
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

function RouteOptionCard({ option, index, isSelected, onSelect }: {
  option: TransitRouteOption
  index: number
  isSelected: boolean
  onSelect: () => void
}) {
  const [expanded, setExpanded] = React.useState(isSelected)

  React.useEffect(() => {
    setExpanded(isSelected)
  }, [isSelected])

  return (
    <div style={{
      border: `1.5px solid ${isSelected ? 'var(--text-primary)' : 'var(--border-faint)'}`,
      borderRadius: 12, overflow: 'hidden', transition: 'all 0.2s',
      boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
    }}>
      {/* 卡片头部：序号+摘要 */}
      <button
        onClick={() => { onSelect(); setExpanded(!expanded) }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', border: 'none', background: 'transparent',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: isSelected ? 'var(--text-primary)' : 'var(--bg-tertiary)',
          color: isSelected ? 'var(--bg-primary)' : 'var(--text-faint)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>
          {index + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
            {option.summary}
          </div>
        </div>
        <span style={{ color: 'var(--text-faint)' }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {/* 展开内容：指标条 + 分段详情 */}
      {expanded && (
        <div style={{
          padding: '0 10px 10px', borderTop: '1px solid var(--border-faint)',
          animation: 'slideDown 0.2s ease-out',
        }}>
          <MetricBar option={option} />

          <div style={{ marginTop: 6 }}>
            {option.segments.map((seg, si) => (
              <SegmentDetail key={si} segment={seg} />
            ))}
            {/* 终点标记 */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                <MapPin size={13} style={{ color: 'var(--text-faint)' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 500 }}>
                到达终点
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TransitRoutePanel({
  result, selectedOptionIndex, selectedStrategy,
  onSelectOption, onSelectStrategy, onClose,
}: TransitRoutePanelProps) {
  const { t } = useTranslation()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 12,
    }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}>
          {t('transit.title', { defaultValue: '公交/地铁路线' })}
        </span>
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
        padding: '4px 2px', borderBottom: '1px solid var(--border-faint)', paddingBottom: 8,
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
              background: selectedStrategy === s.value
                ? 'var(--bg-hover)'
                : 'transparent',
              color: selectedStrategy === s.value
                ? 'var(--text-primary)'
                : 'var(--text-faint)',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >
            <span style={{ marginRight: 3 }}>{s.icon}</span>
            {t(s.labelKey, { defaultValue: s.defaultLabel })}
          </button>
        ))}
      </div>

      {/* 方案列表 */}
      {result.options.map((option, i) => (
        <RouteOptionCard
          key={i}
          option={option}
          index={i}
          isSelected={i === selectedOptionIndex}
          onSelect={() => onSelectOption(i)}
        />
      ))}

      {result.options.length === 0 && (
        <div style={{
          fontSize: 12, color: 'var(--text-faint)', textAlign: 'center',
          padding: '16px 0', lineHeight: 1.5,
        }}>
          {t('transit.noRoutes', { defaultValue: '未找到公交路线，请尝试其他策略或扩大搜索范围' })}
        </div>
      )}
    </div>
  )
}
