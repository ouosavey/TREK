import React from 'react'
import { Footprints, Bus, Train as TrainIcon, ChevronDown, ChevronRight, MapPin } from 'lucide-react'
import type { TransitRouteResult, TransitRouteOption, TransitSegment } from '../../types'
import { useTranslation } from '../../i18n'

interface TransitRoutePanelProps {
  result: TransitRouteResult
  selectedOptionIndex: number
  onSelectOption: (index: number) => void
  onClose: () => void
}

const SEGMENT_COLORS = {
  walk: '#6b7280',
  bus: '#3b82f6',
  subway: '#ef4444',
}

function SegmentIcon({ type }: { type: 'walk' | 'bus' | 'subway' }) {
  switch (type) {
    case 'walk': return <Footprints size={13} />
    case 'bus': return <Bus size={13} />
    case 'subway': return <TrainIcon size={13} />
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
  const color = SEGMENT_COLORS[segment.type]

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      {/* 左侧图标和连线 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%', background: color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0,
        }}>
          <SegmentIcon type={segment.type} />
        </div>
        <div style={{ width: 2, flex: 1, minHeight: 12, background: `${color}40` }} />
      </div>

      {/* 右侧内容 */}
      <div style={{ flex: 1, paddingBottom: 6, minWidth: 0 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}
          onClick={() => setExpanded(!expanded)}
        >
          <span style={{ fontWeight: 500 }}>{segment.instruction}</span>
          <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>
            {formatDuration(segment.duration)} · {formatDistance(segment.distance)}
          </span>
          {segment.type !== 'walk' && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-faint)' }}>
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          )}
        </div>

        {/* 站点信息 */}
        {segment.type !== 'walk' && (
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
            {segment.departureStop && <span>{segment.departureStop} → {segment.arrivalStop}</span>}
            {segment.viaStops != null && segment.viaStops > 0 && <span> ({segment.viaStops}站)</span>}
          </div>
        )}

        {/* 展开详情 */}
        {expanded && segment.type === 'walk' && segment.instruction && (
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, lineHeight: 1.5 }}>
            {segment.instruction}
          </div>
        )}
      </div>
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
  const { t } = useTranslation()

  return (
    <div style={{
      border: `1px solid ${isSelected ? 'var(--text-primary)' : 'var(--border-faint)'}`,
      borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.15s',
    }}>
      <button
        onClick={() => { onSelect(); setExpanded(!expanded) }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', border: 'none', background: isSelected ? 'var(--bg-hover)' : 'transparent',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        {/* 方案序号 */}
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: isSelected ? 'var(--text-primary)' : 'var(--bg-tertiary)',
          color: isSelected ? 'var(--bg-primary)' : 'var(--text-faint)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0,
        }}>
          {index + 1}
        </div>

        {/* 摘要 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
            {option.summary}
          </div>
        </div>

        <span style={{ color: 'var(--text-faint)' }}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>

      {/* 展开的分段详情 */}
      {expanded && (
        <div style={{ padding: '4px 10px 10px', borderTop: '1px solid var(--border-faint)' }}>
          {option.segments.map((seg, si) => (
            <SegmentDetail key={si} segment={seg} />
          ))}
          {/* 终点标记 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin size={13} style={{ color: 'var(--text-faint)' }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>到达终点</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TransitRoutePanel({ result, selectedOptionIndex, onSelectOption, onClose }: TransitRoutePanelProps) {
  const { t } = useTranslation()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 10,
    }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {t('transit.title', { defaultValue: '公交/地铁路线' })}
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)',
          display: 'flex', padding: 2,
        }}>
          <ChevronDown size={13} />
        </button>
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
        <div style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', padding: '8px 0' }}>
          {t('transit.noRoutes', { defaultValue: '未找到公交路线' })}
        </div>
      )}
    </div>
  )
}
