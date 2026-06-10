import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'
import { useSettingsStore } from '../../store/settingsStore'
import { wgs84ToGcj02, gcj02ToWgs84 } from '../../utils/coordTransform'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AMapInstance = any
type AMapMarkerType = any
type AMapPolylineType = any

export interface JourneyMapAMapHandle {
  highlightMarker: (id: string | null) => void
  focusMarker: (id: string) => void
  invalidateSize: () => void
}

interface MapEntry {
  id: string
  lat: number
  lng: number
  title?: string | null
  location_name?: string | null
  mood?: string | null
  entry_date: string
  dayColor?: string
  dayLabel?: number
}

interface Props {
  checkins: unknown[]
  entries: MapEntry[]
  trail?: { lat: number; lng: number }[]
  height?: number
  dark?: boolean
  activeMarkerId?: string | null
  onMarkerClick?: (id: string, type?: string) => void
  fullScreen?: boolean
  paddingBottom?: number
}

interface Item {
  id: string
  lat: number
  lng: number
  label: string
  locationName: string
  time: string
  dayColor: string
  dayLabel: number
}

const MARKER_W = 28
const MARKER_H = 36

function buildItems(entries: MapEntry[]): Item[] {
  const items: Item[] = []
  for (const e of entries) {
    if (e.lat && e.lng) {
      items.push({
        id: e.id,
        lat: e.lat,
        lng: e.lng,
        label: e.title || '',
        locationName: e.location_name || '',
        time: e.entry_date,
        dayColor: e.dayColor || '#52525B',
        dayLabel: e.dayLabel ?? 1,
      })
    }
  }
  items.sort((a, b) => a.time.localeCompare(b.time))
  return items
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatEntryDate(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00')
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(d)
  } catch {
    return iso
  }
}

// Inject the popup styles once per document. Frosted-glass card matching
// the JourneyMapGL style — title on top, location / date subtly below.
function ensureJourneyPopupStyle() {
  if (document.getElementById('trek-journey-amap-popup-style')) return
  const s = document.createElement('style')
  s.id = 'trek-journey-amap-popup-style'
  s.textContent = `
    .amap-info.trek-journey-popup { pointer-events: none; animation: trek-journey-popup-in 180ms ease-out; }
    .amap-info.trek-journey-popup .amap-info-content {
      padding: 9px 14px 10px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      border: 1px solid rgba(0, 0, 0, 0.06);
      box-shadow: 0 10px 32px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.06);
      font-family: -apple-system, system-ui, sans-serif;
      min-width: 160px;
      max-width: 280px;
      color: #18181B;
      line-height: 1.4;
    }
    .amap-info.trek-journey-popup.trek-dark .amap-info-content {
      background: rgba(24, 24, 27, 0.88);
      border-color: rgba(255, 255, 255, 0.08);
      color: #FAFAFA;
    }
    .amap-info.trek-journey-popup .amap-info-sharp { display: none; }
    .amap-info.trek-journey-popup .amap-info-close { display: none; }
    .trek-journey-popup-title {
      font-size: 13.5px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: #18181B;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .amap-info.trek-journey-popup.trek-dark .trek-journey-popup-title { color: #FAFAFA; }
    .trek-journey-popup-sub {
      display: flex;
      align-items: baseline;
      gap: 7px;
      margin-top: 3px;
      font-size: 11.5px;
      color: #71717A;
      line-height: 1.35;
      white-space: nowrap;
    }
    .amap-info.trek-journey-popup.trek-dark .trek-journey-popup-sub { color: #A1A1AA; }
    .trek-journey-popup-place {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .trek-journey-popup-sep {
      flex: 0 0 auto;
      opacity: 0.55;
      font-weight: 500;
    }
    .trek-journey-popup-date { flex: 0 0 auto; }
    @keyframes trek-journey-popup-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `
  document.head.appendChild(s)
}

function markerHtml(dayColor: string, dayLabel: number, highlighted: boolean): HTMLDivElement {
  const fill = dayColor
  const textColor = '#fff'
  const stroke = highlighted ? '#fff' : 'rgba(255,255,255,0.5)'
  const shadow = highlighted
    ? 'drop-shadow(0 0 10px rgba(0,0,0,0.4)) drop-shadow(0 2px 6px rgba(0,0,0,0.4))'
    : 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))'
  const scale = highlighted ? 1.2 : 1
  const label = String(dayLabel)

  const wrap = document.createElement('div')
  wrap.style.cssText = `width:${MARKER_W}px;height:${MARKER_H}px;cursor:pointer;`
  const inner = document.createElement('div')
  inner.className = 'trek-journey-marker-inner'
  inner.style.cssText = `width:100%;height:100%;transform:scale(${scale});transform-origin:bottom center;transition:transform 0.2s ease;filter:${shadow};`
  inner.innerHTML = `<svg width="${MARKER_W}" height="${MARKER_H}" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 34C14 34 26 22.36 26 13C26 6.37 20.63 1 14 1C7.37 1 2 6.37 2 13C2 22.36 14 34 14 34Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <circle cx="14" cy="13" r="8" fill="${fill}"/>
    <text x="14" y="13" text-anchor="middle" dominant-baseline="central" fill="${textColor}" font-family="-apple-system,system-ui,sans-serif" font-size="11" font-weight="700">${label}</text>
  </svg>`
  wrap.appendChild(inner)
  return wrap
}

const EMPTY_TRAIL: { lat: number; lng: number }[] = []

const JourneyMapAMap = forwardRef<JourneyMapAMapHandle, Props>(function JourneyMapAMap(
  { entries, trail, height = 220, dark, activeMarkerId, onMarkerClick, fullScreen, paddingBottom },
  ref
) {
  const stableTrail = trail || EMPTY_TRAIL
  const amapKey = useSettingsStore(s => s.settings.amap_key || '')
  const amapSecurityCode = useSettingsStore(s => s.settings.amap_security_code || '')
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<AMapInstance | null>(null)
  const AMapRef = useRef<any>(null)
  const markersRef = useRef<Map<string, AMapMarkerType>>(new Map())
  const itemsRef = useRef<Item[]>([])
  const highlightedRef = useRef<string | null>(null)
  const infoWindowRef = useRef<any>(null)
  const polylineRef = useRef<AMapPolylineType | null>(null)
  const onMarkerClickRef = useRef(onMarkerClick)
  onMarkerClickRef.current = onMarkerClick
  const darkRef = useRef(dark)
  darkRef.current = dark

  const showPopup = useCallback((id: string) => {
    const item = itemsRef.current.find(i => i.id === id)
    if (!item || !mapRef.current || !AMapRef.current) return
    ensureJourneyPopupStyle()

    const AMap = AMapRef.current
    const primaryRaw = item.label || item.locationName || 'Entry'
    const secondaryPlace = item.label ? item.locationName : ''
    const dateStr = formatEntryDate(item.time)
    const primary = escapeHtml(primaryRaw)
    const place = escapeHtml(secondaryPlace)
    const date = escapeHtml(dateStr)

    const subParts: string[] = []
    if (place) subParts.push(`<span class="trek-journey-popup-place">${place}</span>`)
    if (date) subParts.push(`<span class="trek-journey-popup-date">${date}</span>`)
    const subline = subParts.length === 2
      ? `${subParts[0]}<span class="trek-journey-popup-sep">\u00B7</span>${subParts[1]}`
      : subParts.join('')

    const html = `
      <div class="trek-journey-popup-title">${primary}</div>
      ${subline ? `<div class="trek-journey-popup-sub">${subline}</div>` : ''}
    `

    // Convert WGS-84 → GCJ-02 for AMap
    const [gcjLng, gcjLat] = wgs84ToGcj02(item.lng, item.lat)

    if (infoWindowRef.current) {
      infoWindowRef.current.setContent(html)
      infoWindowRef.current.open(mapRef.current, new AMap.LngLat(gcjLng, gcjLat))
      const el = infoWindowRef.current.getDom()
      if (el) {
        const container = el.parentElement
        if (container) {
          container.classList.toggle('trek-dark', !!darkRef.current)
        }
      }
    } else {
      infoWindowRef.current = new AMap.InfoWindow({
        content: html,
        offset: new AMap.Pixel(0, -MARKER_H - 10),
        closeWhenClickMap: false,
        isCustom: false,
        className: `trek-journey-popup${darkRef.current ? ' trek-dark' : ''}`,
      })
      infoWindowRef.current.open(mapRef.current, new AMap.LngLat(gcjLng, gcjLat))
    }
  }, [])

  const hidePopup = useCallback(() => {
    if (infoWindowRef.current) {
      try { infoWindowRef.current.close() } catch { /* noop */ }
    }
  }, [])

  const setMarkerStyle = useCallback((id: string, highlighted: boolean) => {
    const item = itemsRef.current.find(i => i.id === id)
    const marker = markersRef.current.get(id)
    if (!item || !marker) return
    const el = marker.getContent() as HTMLElement
    if (!el) return
    const currentInner = el.querySelector('.trek-journey-marker-inner') as HTMLDivElement | null
    if (!currentInner) return
    const next = markerHtml(item.dayColor, item.dayLabel, highlighted)
    const nextInner = next.querySelector('.trek-journey-marker-inner') as HTMLDivElement
    currentInner.style.cssText = nextInner.style.cssText
    currentInner.innerHTML = nextInner.innerHTML
    marker.setzIndex(highlighted ? 1000 : 100)
  }, [])

  const highlightMarker = useCallback((id: string | null) => {
    const prev = highlightedRef.current
    highlightedRef.current = id
    if (prev && prev !== id) setMarkerStyle(prev, false)
    if (id) {
      setMarkerStyle(id, true)
      showPopup(id)
    } else {
      hidePopup()
    }
  }, [setMarkerStyle, showPopup, hidePopup])

  const focusMarker = useCallback((id: string) => {
    highlightMarker(id)
    const item = itemsRef.current.find(i => i.id === id)
    if (!item || !mapRef.current) return
    // Convert WGS-84 → GCJ-02
    const [gcjLng, gcjLat] = wgs84ToGcj02(item.lng, item.lat)
    try {
      mapRef.current.setZoomAndCenter(
        Math.max(mapRef.current.getZoom(), 14),
        [gcjLng, gcjLat],
        false,
        600
      )
    } catch { /* map not yet ready */ }
  }, [highlightMarker])

  const invalidateSize = useCallback(() => {
    // AMap doesn't have a direct resize method — it auto-resizes.
    // Trigger a re-layout by calling setFitView with no arguments if map exists.
    try {
      if (mapRef.current) {
        // Force recalculation by briefly toggling display
        const container = containerRef.current
        if (container) {
          const prev = container.style.display
          container.style.display = 'none'
          // Force reflow
          void container.offsetHeight
          container.style.display = prev
        }
      }
    } catch { /* noop */ }
  }, [])

  useImperativeHandle(ref, () => ({ highlightMarker, focusMarker, invalidateSize }), [highlightMarker, focusMarker, invalidateSize])

  // Build map once per key change
  useEffect(() => {
    if (!containerRef.current || !amapKey) return

    // Set security config before loading
    if (amapSecurityCode) {
      (window as any)._AMapSecurityConfig = { securityJsCode: amapSecurityCode }
    }

    let destroyed = false

    const items = buildItems(entries)
    itemsRef.current = items

    AMapLoader.load({
      key: amapKey,
      version: '2.0',
      plugins: ['AMap.Scale'],
    }).then((AMap: any) => {
      if (destroyed) return
      AMapRef.current = AMap

      // Determine initial center & zoom
      const hasPoints = items.length > 0 || stableTrail.length > 0
      let initialCenter: [number, number]
      let initialZoom: number

      if (hasPoints) {
        // Compute center from all points (converted to GCJ-02)
        let sumLng = 0, sumLat = 0, count = 0
        for (const i of items) {
          const [gcjLng, gcjLat] = wgs84ToGcj02(i.lng, i.lat)
          sumLng += gcjLng
          sumLat += gcjLat
          count++
        }
        for (const p of stableTrail) {
          const [gcjLng, gcjLat] = wgs84ToGcj02(p.lng, p.lat)
          sumLng += gcjLng
          sumLat += gcjLat
          count++
        }
        initialCenter = [sumLng / count, sumLat / count]
        initialZoom = 2
      } else {
        initialCenter = [116.397428, 39.90923] // Beijing default
        initialZoom = 1
      }

      const map = new AMap.Map(containerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        resizeEnable: true,
        viewMode: '2D',
      })
      mapRef.current = map

      // ── Dashed trail line connecting entries in time order ──────────
      if (items.length > 1) {
        const path = items.map(i => {
          const [gcjLng, gcjLat] = wgs84ToGcj02(i.lng, i.lat)
          return new AMap.LngLat(gcjLng, gcjLat)
        })
        const polyline = new AMap.Polyline({
          path,
          strokeColor: darkRef.current ? '#71717A' : '#A1A1AA',
          strokeWeight: 1.5,
          strokeOpacity: 0.5,
          strokeStyle: 'dashed',
          strokeDasharray: [2, 3],
          lineJoin: 'round',
          lineCap: 'round',
          zIndex: 50,
        })
        polyline.setMap(map)
        polylineRef.current = polyline
      }

      // ── Markers ────────────────────────────────────────────────────
      items.forEach((item) => {
        const el = markerHtml(item.dayColor, item.dayLabel, false)

        // Click handler
        el.addEventListener('click', (ev: Event) => {
          ev.stopPropagation()
          onMarkerClickRef.current?.(item.id)
        })

        // Hover handlers
        el.addEventListener('mouseenter', () => {
          highlightMarker(item.id)
        })
        el.addEventListener('mouseleave', () => {
          if (highlightedRef.current === item.id) {
            highlightMarker(null)
          }
        })

        // Convert WGS-84 → GCJ-02
        const [gcjLng, gcjLat] = wgs84ToGcj02(item.lng, item.lat)

        const marker = new AMap.Marker({
          position: new AMap.LngLat(gcjLng, gcjLat),
          content: el,
          offset: new AMap.Pixel(-MARKER_W / 2, -MARKER_H),
          zIndex: 100,
        })
        marker.setMap(map)
        markersRef.current.set(item.id, marker)
      })

      // ── Fit bounds to all points ───────────────────────────────────
      if (hasPoints) {
        const allCoords: any[] = []
        items.forEach(i => {
          const [gcjLng, gcjLat] = wgs84ToGcj02(i.lng, i.lat)
          allCoords.push(new AMap.LngLat(gcjLng, gcjLat))
        })
        stableTrail.forEach(p => {
          const [gcjLng, gcjLat] = wgs84ToGcj02(p.lng, p.lat)
          allCoords.push(new AMap.LngLat(gcjLng, gcjLat))
        })

        if (allCoords.length > 0) {
          const bounds = new AMap.Bounds()
          for (const lngLat of allCoords) {
            bounds.extend(lngLat)
          }
          const pb = paddingBottom || 50
          try {
            map.setBounds(bounds, false, { top: 50, bottom: pb, left: 50, right: 50 })
          } catch { /* empty bounds */ }
        }
      }

      // Apply dark mode style if needed
      if (darkRef.current) {
        map.setMapStyle('amap://styles/dark')
      }
    }).catch((err: any) => {
      console.error('AMap load failed:', err)
    })

    return () => {
      destroyed = true
      markersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
      markersRef.current.clear()
      if (polylineRef.current) { try { polylineRef.current.setMap(null) } catch {} polylineRef.current = null }
      if (infoWindowRef.current) { try { infoWindowRef.current.close() } catch {} infoWindowRef.current = null }
      highlightedRef.current = null
      if (mapRef.current) { try { mapRef.current.destroy() } catch {} mapRef.current = null }
      AMapRef.current = null
    }
  }, [entries, stableTrail, amapKey, amapSecurityCode, fullScreen, paddingBottom])

  // ── Dark mode toggle ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return
    try {
      mapRef.current.setMapStyle(dark ? 'amap://styles/dark' : 'amap://styles/normal')
    } catch { /* map not ready */ }
  }, [dark])

  // ── External activeMarkerId → highlight + flyTo ───────────────────────
  useEffect(() => {
    if (!activeMarkerId || !mapRef.current) return
    const t = setTimeout(() => {
      highlightMarker(activeMarkerId)
      const item = itemsRef.current.find(i => i.id === activeMarkerId)
      if (!item || !mapRef.current) return
      const [gcjLng, gcjLat] = wgs84ToGcj02(item.lng, item.lat)
      try {
        mapRef.current.setZoomAndCenter(
          Math.max(mapRef.current.getZoom(), 12),
          [gcjLng, gcjLat],
          false,
          500
        )
      } catch { /* map not ready */ }
    }, 50)
    return () => clearTimeout(t)
  }, [activeMarkerId, highlightMarker])

  // ── No AMap key placeholder ───────────────────────────────────────────
  if (!amapKey) {
    return (
      <div
        style={{ position: 'relative', height: height === 9999 ? '100%' : height, width: '100%', borderRadius: 'inherit', overflow: 'hidden' }}
        className="flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-center px-6"
      >
        <div className="text-sm text-zinc-500">
          No AMap key configured.<br />
          <span className="text-xs">Settings → Map → AMap</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height: height === 9999 ? '100%' : height, width: '100%', borderRadius: 'inherit', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
})

export default JourneyMapAMap
