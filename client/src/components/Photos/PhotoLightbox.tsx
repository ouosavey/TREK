import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Edit2, Trash2, Check, RotateCcw } from 'lucide-react'
import { useTranslation } from '../../i18n'
import type { Photo, Place, Day } from '../../types'

interface PhotoLightboxProps {
  photos: Photo[]
  initialIndex: number
  onClose: () => void
  onUpdate: (photoId: number, data: Partial<Photo>) => Promise<void>
  onDelete: (photoId: number) => Promise<void>
  days: Day[]
  places: Place[]
  tripId: number
}

export function PhotoLightbox({ photos, initialIndex, onClose, onUpdate, onDelete, days, places, tripId }: PhotoLightboxProps) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(initialIndex || 0)
  const [editCaption, setEditCaption] = useState(false)
  const [caption, setCaption] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const photo = photos[index]

  useEffect(() => {
    setIndex(initialIndex || 0)
  }, [initialIndex])

  useEffect(() => {
    if (photo) setCaption(photo.caption || '')
  }, [photo])

  const prev = useCallback(() => {
    setIndex(i => Math.max(0, i - 1))
    setEditCaption(false)
  }, [])

  const next = useCallback(() => {
    setIndex(i => Math.min(photos.length - 1, i + 1))
    setEditCaption(false)
  }, [photos.length])

  // ── 缩放状态：纯 ref，零 React 重渲染 ──
  const scale = useRef(1)
  const tx = useRef(0)
  const ty = useRef(0)
  const fitScale = useRef(1)
  const imgEl = useRef<HTMLImageElement>(null)
  const boxEl = useRef<HTMLDivElement>(null)
  const hintEl = useRef<HTMLDivElement>(null)
  const labelEl = useRef<HTMLSpanElement>(null)
  const resetEl = useRef<HTMLButtonElement>(null)
  const dragging = useRef(false)
  const dragOrigin = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const pinchDist = useRef<number | null>(null)
  const pinchCenter = useRef({ x: 0, y: 0 })
  const swipeX = useRef<number | null>(null)
  const animating = useRef(false)

  // 手机端最大缩放到 fitScale 的 15 倍，桌面端 10 倍
  const maxZoomFactor = useRef(typeof window !== 'undefined' && window.innerWidth < 768 ? 15 : 10)

  const writeDOM = () => {
    const img = imgEl.current
    if (!img) return
    img.style.transform = `translate(${tx.current}px,${ty.current}px) scale(${scale.current})`
    const zoomed = scale.current > fitScale.current * 1.02
    img.style.cursor = zoomed ? (dragging.current ? 'grabbing' : 'grab') : 'default'
    const label = labelEl.current; if (label) { label.textContent = `${Math.round(scale.current / fitScale.current * 100)}%`; label.style.display = zoomed ? '' : 'none' }
    const btn = resetEl.current; if (btn) btn.style.display = zoomed ? '' : 'none'
    const hint = hintEl.current; if (hint) hint.style.display = zoomed ? 'none' : ''
  }

  const writeDOMAnimated = (targetScale: number, targetTx: number, targetTy: number) => {
    const img = imgEl.current
    if (!img || animating.current) return
    animating.current = true
    scale.current = targetScale; tx.current = targetTx; ty.current = targetTy
    img.style.transition = 'transform 0.25s cubic-bezier(0.22,1,0.36,1)'
    img.style.transform = `translate(${targetTx}px,${targetTy}px) scale(${targetScale})`
    setTimeout(() => { img.style.transition = 'none'; animating.current = false; writeDOM() }, 260)
  }

  const resetZoom = (animate = true) => {
    scale.current = fitScale.current; tx.current = 0; ty.current = 0
    if (animate) writeDOMAnimated(fitScale.current, 0, 0)
    else writeDOM()
  }

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const box = boxEl.current
    if (!box) return
    const cw = box.clientWidth, ch = box.clientHeight
    const iw = img.naturalWidth, ih = img.naturalHeight
    if (!iw || !ih) return
    fitScale.current = Math.min(cw * 0.92 / iw, ch * 0.92 / ih, 1)
    scale.current = fitScale.current; tx.current = 0; ty.current = 0
    writeDOM()
  }

  useEffect(() => { resetZoom(false) }, [index])

  const zoomAt = (cx: number, cy: number, factor: number) => {
    const box = boxEl.current; if (!box) return
    const r = box.getBoundingClientRect()
    const mx = cx - r.left - r.width / 2
    const my = cy - r.top - r.height / 2
    const oldS = scale.current
    const newS = Math.min(fitScale.current * maxZoomFactor.current, Math.max(fitScale.current * 0.2, oldS * factor))
    const ratio = newS / oldS
    tx.current = mx - (mx - tx.current) * ratio
    ty.current = my - (my - ty.current) * ratio
    scale.current = newS
    writeDOM()
  }

  // ── 滚轮缩放 ──
  useEffect(() => {
    const box = boxEl.current; if (!box) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation()
      const d = Math.abs(e.deltaY)
      const step = Math.min(d * 0.0015, 0.12)
      zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1 - step : 1 + step)
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
  }, [index])

  // ── 鼠标拖拽 ──
  const onMD = (e: React.MouseEvent) => {
    if (scale.current > fitScale.current * 1.02) {
      dragging.current = true
      dragOrigin.current = { x: e.clientX, y: e.clientY, tx: tx.current, ty: ty.current }
      e.preventDefault()
    }
  }
  const onMM = (e: React.MouseEvent) => {
    if (!dragging.current) return
    tx.current = dragOrigin.current.tx + (e.clientX - dragOrigin.current.x)
    ty.current = dragOrigin.current.ty + (e.clientY - dragOrigin.current.y)
    writeDOM()
  }
  const onMU = () => { dragging.current = false; writeDOM() }

  // ── 双击 ──
  const onDblClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (scale.current > fitScale.current * 1.02) { resetZoom(true); return }
    const box = boxEl.current; if (!box) return
    const r = box.getBoundingClientRect()
    const mx = e.clientX - r.left - r.width / 2
    const my = e.clientY - r.top - r.height / 2
    const target = fitScale.current * 3
    const ratio = target / scale.current
    const ntx = mx - (mx - tx.current) * ratio
    const nty = my - (my - ty.current) * ratio
    writeDOMAnimated(target, ntx, nty)
  }

  // ── 触摸 ──
  const onTS = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchDist.current = Math.sqrt(dx * dx + dy * dy)
      pinchCenter.current = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 }
      dragging.current = false; swipeX.current = null
    } else if (e.touches.length === 1) {
      if (scale.current > fitScale.current * 1.02) {
        dragging.current = true
        dragOrigin.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: tx.current, ty: ty.current }
      } else { swipeX.current = e.touches[0].clientX }
    }
  }
  const onTM = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchDist.current != null) {
      e.preventDefault(); e.stopPropagation()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const ratio = dist / pinchDist.current
      pinchDist.current = dist
      const nc = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 }
      const box = boxEl.current; if (box) {
        const r = box.getBoundingClientRect()
        const mx = nc.x - r.left - r.width / 2, my = nc.y - r.top - r.height / 2
        const oldS = scale.current, newS = Math.min(fitScale.current * maxZoomFactor.current, Math.max(fitScale.current * 0.2, oldS * ratio))
        const sr = newS / oldS
        tx.current = mx - (mx - tx.current) * sr + (nc.x - pinchCenter.current.x)
        ty.current = my - (my - ty.current) * sr + (nc.y - pinchCenter.current.y)
        scale.current = newS
        pinchCenter.current = nc
      }
      writeDOM()
    } else if (e.touches.length === 1 && dragging.current) {
      e.preventDefault()
      tx.current = dragOrigin.current.tx + (e.touches[0].clientX - dragOrigin.current.x)
      ty.current = dragOrigin.current.ty + (e.touches[0].clientY - dragOrigin.current.y)
      writeDOM()
    }
  }
  const onTE = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchDist.current = null
    if (e.touches.length === 0) {
      dragging.current = false; writeDOM()
      if (swipeX.current != null && scale.current <= fitScale.current * 1.02) {
        const diff = e.changedTouches[0].clientX - swipeX.current
        if (diff > 60) prev(); else if (diff < -60) next()
      }
      swipeX.current = null
    }
  }

  // ── 键盘 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === '+' || e.key === '=') { scale.current = Math.min(fitScale.current * maxZoomFactor.current, scale.current * 1.2); writeDOM() }
      if (e.key === '-') { scale.current = Math.max(fitScale.current * 0.2, scale.current / 1.2); writeDOM() }
      if (e.key === '0') resetZoom(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, prev, next])

  const handleSaveCaption = async () => {
    setIsSaving(true)
    try {
      await onUpdate(photo.id, { caption })
      setEditCaption(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Foto löschen?')) return
    await onDelete(photo.id)
    if (photos.length <= 1) {
      onClose()
    } else {
      setIndex(i => Math.min(i, photos.length - 2))
    }
  }

  if (!photo) return null

  const day = days?.find(d => d.id === photo.day_id)
  const place = places?.find(p => p.id === photo.place_id)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      style={{ paddingBottom: 'var(--bottom-nav-h)', userSelect: 'none', touchAction: 'none' }}
      onClick={onClose}
    >
      {/* Main area */}
      <div
        className="relative flex flex-col w-full h-full max-w-5xl mx-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between p-4 flex-shrink-0">
          <div className="text-white/60 text-sm">
            {index + 1} / {photos.length}
          </div>
          <div className="flex items-center gap-2">
            <span ref={labelEl} style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', minWidth: 40, textAlign: 'center', display: 'none' }} />
            <button ref={resetEl} onClick={() => resetZoom(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'rgba(255,255,255,0.8)', display: 'none', padding: '3px 8px', fontSize: 11, fontFamily: 'inherit' }}>1:1</button>
            <button
              onClick={handleDelete}
              className="p-2 text-white/60 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
              title={t('common.delete')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image area */}
        <div
          ref={boxEl}
          className="flex-1 flex items-center justify-center relative min-h-0 overflow-hidden"
          style={{ touchAction: 'none' }}
          onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
          onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
        >
          {/* Prev button */}
          {index > 0 && (
            <button
              onClick={e => { e.stopPropagation(); prev() }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <img
            ref={imgEl}
            src={getAssetUrl(photo.url)}
            alt={photo.caption || photo.original_name}
            className="rounded-lg select-none"
            style={{ objectFit: 'contain', display: 'block', transformOrigin: 'center center', willChange: 'transform' }}
            onLoad={onImgLoad}
            onDoubleClick={onDblClick}
            draggable={false}
          />

          {/* Next button */}
          {index < photos.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); next() }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Zoom hint */}
        <div ref={hintEl} style={{ textAlign: 'center', padding: '6px 0', fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
          双指缩放 · 双击放大 · 键盘 +/- 缩放
        </div>

        {/* Bottom info */}
        <div className="flex-shrink-0 p-4">
          {/* Caption */}
          <div className="flex items-center gap-2 mb-2">
            {editCaption ? (
              <>
                <input
                  type="text"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveCaption()}
                  placeholder={t('photos.addCaption')}
                  className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-white/40"
                  autoFocus
                />
                <button
                  onClick={handleSaveCaption}
                  disabled={isSaving}
                  className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setEditCaption(false); setCaption(photo.caption || '') }}
                  className="p-1.5 text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <p
                  className="text-white text-sm flex-1 cursor-pointer hover:text-white/80"
                  onClick={() => setEditCaption(true)}
                >
                  {photo.caption || <span className="text-white/40 italic">{t('photos.addCaption')}</span>}
                </p>
                <button
                  onClick={() => setEditCaption(true)}
                  className="p-1.5 text-white/40 hover:text-white/70"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-white/40 text-xs">
            <span>{photo.original_name}</span>
            {photo.created_at && (
              <span>{formatDate(photo.created_at)}</span>
            )}
            {day && <span>📅 Tag {day.day_number}</span>}
            {place && <span>📍 {place.name}</span>}
            {photo.file_size && <span>{formatSize(photo.file_size)}</span>}
          </div>
        </div>

        {/* Thumbnail strip */}
        {photos.length > 1 && (
          <div className="flex-shrink-0 px-4 pb-4">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => { setIndex(i); setEditCaption(false) }}
                  className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden transition-all ${
                    i === index
                      ? 'ring-2 ring-white scale-105'
                      : 'opacity-50 hover:opacity-75'
                  }`}
                >
                  <img
                    src={getAssetUrl(p.url)}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(dateStr, locale = 'en-US') {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return '' }
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
