import { useEffect, useRef, useMemo, useState, createElement, memo } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AMapLoader from '@amap/amap-jsapi-loader'
import { Plane, Train, Ship, Car, Search, X, Loader2 } from 'lucide-react'
import SubwayMapView from './SubwayMapView'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { getCached, isLoading, fetchPhoto, onThumbReady, getAllThumbs } from '../../services/photoService'
import { getAssetUrl } from '../../utils/serverConfig'
import { CATEGORY_ICON_MAP, getCategoryIcon } from '../shared/categoryIcons'
import { wgs84ToGcj02, wgs84ToGcj02Batch, gcj02ToWgs84 } from '../../utils/coordTransform'
import LocationButton from './LocationButton'
import { mapsApi } from '../../api/client'
import { useGeolocation } from '../../hooks/useGeolocation'
import type { Place, Reservation, ReservationEndpoint, RouteSegment } from '../../types'
import type { GeoPosition, TrackingMode } from '../../hooks/useGeolocation'

// ═══════════════════════════════════════════════════════════════════
// MODULE-LEVEL: Suppress AMap LngLat/Pixel NaN errors
// These errors originate from the AMap SDK's internal event loop when
// the map's coordinate system becomes temporarily inconsistent.
// The SDK throws "Invalid Object: LngLat(NaN, NaN)" inside
// requestAnimationFrame callbacks, which breaks the rendering loop
// and causes the map to go gray. We intercept at multiple levels:
// 1. Wrap requestAnimationFrame to catch errors in AMap's render loop
// 2. Capture-phase window.error listener as safety net
// 3. Console.error override to reduce noise
// ═══════════════════════════════════════════════════════════════════
;(function installAmapErrorSuppressor() {
  if ((window as any).__amapErrorSuppressed) return
  ;(window as any).__amapErrorSuppressed = true

  function isAmapNaNError(msg: string): boolean {
    if (!msg) return false
    // Match "Invalid Object: LngLat(NaN, NaN)" or "Invalid Object: Pixel(NaN, NaN)"
    if (msg.includes('Invalid Object') && (msg.includes('LngLat') || msg.includes('Pixel'))) return true
    // Match other NaN-related errors from AMap internals
    if (msg.includes('NaN') && (msg.includes('LngLat') || msg.includes('Pixel') || msg.includes('containerToLngLat') || msg.includes('lngLatToContainer'))) return true
    return false
  }

  // ── 1. Wrap requestAnimationFrame ──────────────────────────────────
  // AMap SDK's render loop runs in rAF callbacks. When it throws
  // "Invalid Object: LngLat(NaN, NaN)", the rAF callback is aborted
  // and the map stops rendering (goes gray). By wrapping rAF, we can
  // catch these errors and allow the render loop to continue.
  const _origRAF = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = function(callback: FrameRequestCallback): number {
    const wrappedCallback = function(timestamp: number) {
      try {
        callback(timestamp)
      } catch (e: any) {
        const msg = String(e?.message ?? e ?? '')
        if (isAmapNaNError(msg)) {
          // Silently swallow — the map will recover on next frame
          return
        }
        // Re-throw non-AMap errors
        throw e
      }
    }
    return _origRAF(wrappedCallback)
  }

  // ── 2. Capture-phase error listener ────────────────────────────────
  window.addEventListener('error', function(event) {
    const msg = String(event.message ?? '')
    if (isAmapNaNError(msg)) {
      event.stopImmediatePropagation()
      event.preventDefault()
      return
    }
  }, true)

  // ── 3. Unhandled promise rejection suppression ─────────────────────
  window.addEventListener('unhandledrejection', function(event) {
    const reason = String(event.reason?.message ?? event.reason ?? '')
    if (isAmapNaNError(reason)) {
      event.preventDefault()
    }
  })

  // ── 4. Console.error override ──────────────────────────────────────
  const _origConsoleError = console.error
  console.error = function(...args: any[]) {
    const msg = args.map(a => typeof a === 'string' ? a : (a?.message ?? '')).join(' ')
    if (isAmapNaNError(msg)) return // suppress
    _origConsoleError.apply(console, args)
  }
})()

// ── Safe coordinate helpers ───────────────────────────────────────────
// Prevents NaN from reaching AMap SDK which causes white-screen crashes

/** Safely convert WGS-84 → GCJ-02, returns null if coords are invalid */
function safeGcj(lng: unknown, lat: unknown): [number, number] | null {
  const nLng = typeof lng === 'number' ? lng : parseFloat(String(lng ?? ''))
  const nLat = typeof lat === 'number' ? lat : parseFloat(String(lat ?? ''))
  // Reject NaN, Infinity, and default/placeholder (0,0) coords
  if (!Number.isFinite(nLng) || !Number.isFinite(nLat)) return null
  if (nLng === 0 && nLat === 0) return null
  return wgs84ToGcj02(nLng, nLat)
}

/** Safely parse numeric coordinates from a place-like object */
function safeCoords(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const nLat = typeof lat === 'number' ? lat : parseFloat(String(lat ?? ''))
  const nLng = typeof lng === 'number' ? lng : parseFloat(String(lng ?? ''))
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null
  return { lat: nLat, lng: nLng }
}

/** Check if an error message is a known-harmless AMap coordinate validation error */
function isAmapNaNError(msg: string, src: string): boolean {
  const lower = msg.toLowerCase()
  // Match "Invalid Object: LngLat(NaN, NaN)" or "Invalid Object: Pixel(NaN, NaN)"
  if (lower.includes('invalid object') && (lower.includes('lnglat') || lower.includes('pixel'))) return true
  // Match any NaN error from AMap/plugin sources
  if ((src.includes('amap') || src.includes('plugin') || src.includes('webapi') || src.includes('map_')) && lower.includes('nan')) return true
  return false
}

// ── AMap type shorthands ─────────────────────────────────────────────────
// We reference the global AMap namespace that @amap/amap-jsapi-loader injects.
/* eslint-disable @typescript-eslint/no-explicit-any */
type AMapInstance = any
type AMapMarkerType = any
type AMapPolylineType = any
type AMapCircleType = any

function categoryIconSvg(iconName: string | null | undefined, size: number): string {
  const IconComponent = (iconName && CATEGORY_ICON_MAP[iconName]) || CATEGORY_ICON_MAP['MapPin']
  try {
    return renderToStaticMarkup(createElement(IconComponent, { size, color: 'white', strokeWidth: 2.5 }))
  } catch { return '' }
}

// ── Props ────────────────────────────────────────────────────────────────
interface Props {
  places?: Place[]
  dayPlaces?: Place[]
  route?: [number, number][][] | null
  routeSegments?: RouteSegment[]
  selectedPlaceId?: number | null
  onMarkerClick?: (id: number) => void
  onMapClick?: (info: { latlng: { lat: number; lng: number } }) => void
  onMapContextMenu?: ((e: { latlng: { lat: number; lng: number }; originalEvent: MouseEvent }) => void) | null
  center?: [number, number]
  zoom?: number
  tileUrl?: string
  fitKey?: number
  dayOrderMap?: Record<number, number[] | null>
  leftWidth?: number
  rightWidth?: number
  hasInspector?: boolean
  hasDayDetail?: boolean
  dayDetailId?: number | null
  reservations?: Reservation[]
  showReservationStats?: boolean
  visibleConnectionIds?: number[]
  onReservationClick?: (reservationId: number) => void
}

// ── Marker icon builder ──────────────────────────────────────────────────
// Creates an HTML DOM element for an AMap Marker, matching the visual style
// of the Leaflet/Mapbox versions (circular photo or category-icon badge
// with optional order-number badge).
function createMarkerElement(
  place: Place & { category_color?: string; category_icon?: string },
  photoUrl: string | null,
  orderNumbers: number[] | null,
  selected: boolean,
): HTMLDivElement {
  const size = selected ? 44 : 36
  const borderColor = selected ? '#111827' : 'white'
  const borderWidth = selected ? 3 : 2.5
  const shadow = selected
    ? '0 0 0 3px rgba(17,24,39,0.25), 0 4px 14px rgba(0,0,0,0.3)'
    : '0 2px 8px rgba(0,0,0,0.22)'
  const bgColor = place.category_color || '#6b7280'
  const outer = size + borderWidth * 2

  let badgeHtml = ''
  if (orderNumbers && orderNumbers.length > 0) {
    const label = orderNumbers.join(' · ')
    badgeHtml = `<span style="
      position:absolute;bottom:-2px;right:-2px;
      min-width:18px;height:${orderNumbers.length > 1 ? 16 : 18}px;border-radius:${orderNumbers.length > 1 ? 8 : 9}px;
      padding:0 ${orderNumbers.length > 1 ? 4 : 3}px;
      background:rgba(255,255,255,0.94);
      border:1.5px solid rgba(0,0,0,0.15);
      box-shadow:0 1px 4px rgba(0,0,0,0.18);
      display:flex;align-items:center;justify-content:center;
      font-size:${orderNumbers.length > 1 ? 7.5 : 9}px;font-weight:800;color:#111827;
      font-family:-apple-system,system-ui,sans-serif;line-height:1;
      box-sizing:border-box;white-space:nowrap;
    ">${label}</span>`
  }

  const wrap = document.createElement('div')
  wrap.style.cssText = `width:${outer}px;height:${outer}px;cursor:pointer;position:relative;`

  const hasPhoto = photoUrl && (photoUrl.startsWith('data:') || photoUrl.startsWith('/api/maps/place-photo/'))
  if (hasPhoto) {
    wrap.innerHTML = `
      <div style="
        position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:${size}px;height:${size}px;border-radius:50%;
        border:${borderWidth}px solid ${borderColor};
        box-shadow:${shadow};
        overflow:hidden;background:${bgColor};
        box-sizing:content-box;
      ">
        <img src="${getAssetUrl(photoUrl)}" width="${size}" height="${size}" style="display:block;border-radius:50%;object-fit:cover;" />
      </div>
      ${badgeHtml}
    `
  } else {
    wrap.innerHTML = `
      <div style="
        position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:${size}px;height:${size}px;border-radius:50%;
        border:${borderWidth}px solid ${borderColor};
        box-shadow:${shadow};
        background:${bgColor};
        display:flex;align-items:center;justify-content:center;
        box-sizing:content-box;
      ">
        ${categoryIconSvg(place.category_icon, selected ? 18 : 15)}
      </div>
      ${badgeHtml}
    `
  }
  return wrap
}

// ── Reservation overlay helpers ──────────────────────────────────────────
type TransportType = 'flight' | 'train' | 'cruise' | 'car'
const TRANSPORT_TYPES: TransportType[] = ['flight', 'train', 'cruise', 'car']
const TRANSPORT_COLOR = '#3b82f6'

const TYPE_META: Record<TransportType, { icon: typeof Plane; geodesic: boolean }> = {
  flight: { icon: Plane, geodesic: true },
  train: { icon: Train, geodesic: false },
  cruise: { icon: Ship, geodesic: true },
  car: { icon: Car, geodesic: false },
}

const toRad = (d: number) => d * Math.PI / 180
const toDeg = (r: number) => r * 180 / Math.PI

function greatCircle(a: [number, number], b: [number, number], steps = 256): [number, number][] {
  const [lat1, lng1] = [toRad(a[0]), toRad(a[1])]
  const [lat2, lng2] = [toRad(b[0]), toRad(b[1])]
  const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2))
  if (d === 0) return [a, b]
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2)
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y))
    const lng = Math.atan2(y, x)
    pts.push([toDeg(lat), toDeg(lng)])
  }
  return pts
}

function splitAntimeridian(points: [number, number][]): [number, number][][] {
  const segments: [number, number][][] = []
  let cur: [number, number][] = []
  for (let i = 0; i < points.length; i++) {
    if (i > 0 && Math.abs(points[i][1] - points[i - 1][1]) > 180) {
      if (cur.length > 1) segments.push(cur)
      cur = []
    }
    cur.push(points[i])
  }
  if (cur.length > 1) segments.push(cur)
  return segments
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function parseInTz(isoLocal: string, tz: string): number {
  const [datePart, timePart] = isoLocal.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi] = (timePart || '00:00').split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]))
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second))
  return guess - (asUtc - guess)
}

function computeDuration(from: ReservationEndpoint, to: ReservationEndpoint, fallbackStart: string | null, fallbackEnd: string | null): string | null {
  let start = from.local_date && from.local_time ? `${from.local_date}T${from.local_time}` : fallbackStart
  let end = to.local_date && to.local_time ? `${to.local_date}T${to.local_time}` : fallbackEnd
  if (!start || !end) return null
  if (!start.includes('T') && end.includes('T')) start = `${end.split('T')[0]}T${start}`
  if (!end.includes('T') && start.includes('T')) end = `${start.split('T')[0]}T${end}`
  if (!start.includes('T') || !end.includes('T')) return null
  const fromTz = from.timezone || to.timezone
  const toTz = to.timezone || fromTz
  let startMs: number, endMs: number
  if (fromTz && toTz) {
    startMs = parseInTz(start, fromTz)
    endMs = parseInTz(end, toTz)
  } else {
    startMs = new Date(start).getTime()
    endMs = new Date(end).getTime()
  }
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null
  if (endMs <= startMs) endMs += 24 * 60 * 60000
  const minutes = Math.round((endMs - startMs) / 60000)
  if (minutes <= 0 || minutes > 48 * 60) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const cleanName = (name: string) => name.replace(/\s*\([^)]*\)/g, '').trim()

interface TransportItem {
  res: Reservation
  from: ReservationEndpoint
  to: ReservationEndpoint
  type: TransportType
  arcs: [number, number][][]
  primaryArc: [number, number][]
  mainLabel: string | null
  subLabel: string | null
}

function buildReservationItems(reservations: Reservation[]): TransportItem[] {
  const out: TransportItem[] = []
  for (const r of reservations) {
    if (!TRANSPORT_TYPES.includes(r.type as TransportType)) continue
    const eps = r.endpoints || []
    const from = eps.find(e => e.role === 'from')
    const to = eps.find(e => e.role === 'to')
    if (!from || !to) continue
    const type = r.type as TransportType
    const isGeo = TYPE_META[type].geodesic
    const arcs = isGeo
      ? splitAntimeridian(greatCircle([from.lat, from.lng], [to.lat, to.lng]))
      : [[[from.lat, from.lng], [to.lat, to.lng]] as [number, number][]]
    const primaryIdx = arcs.reduce((best, seg, idx, all) => seg.length > all[best].length ? idx : best, 0)
    const primaryArc = arcs[primaryIdx] ?? []
    const duration = computeDuration(from, to, r.reservation_time || null, r.reservation_end_time || null)
    const distance = `${Math.round(haversineKm([from.lat, from.lng], [to.lat, to.lng]))} km`
    const mainLabel = from.code && to.code ? `${from.code} → ${to.code}` : null
    const subParts = [duration, distance].filter(Boolean) as string[]
    const subLabel = subParts.length > 0 ? subParts.join(' · ') : null
    out.push({ res: r, from, to, type, arcs, primaryArc, mainLabel, subLabel })
  }
  return out
}

function endpointMarkerHtml(type: TransportType, label: string | null): string {
  const { icon: IconCmp } = TYPE_META[type]
  const svg = renderToStaticMarkup(createElement(IconCmp, { size: 13, color: 'white', strokeWidth: 2.5 }))
  const labelHtml = label ? `<span style="display:inline-flex;align-items:center;line-height:1">${label}</span>` : ''
  return `<div style="
    display:inline-flex;align-items:center;justify-content:center;gap:4px;
    padding:0 8px;border-radius:999px;
    background:${TRANSPORT_COLOR};box-shadow:0 2px 6px rgba(0,0,0,0.25);
    border:1.5px solid #fff;color:#fff;
    font-family:-apple-system,system-ui,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.3px;line-height:1;
    box-sizing:border-box;height:22px;white-space:nowrap;cursor:pointer;
  "><span style="display:inline-flex;align-items:center;">${svg}</span>${labelHtml}</div>`
}

function buildStatsHtml(mainLabel: string | null, subLabel: string | null): { html: string; width: number; height: number } {
  const estWidth = Math.max(
    mainLabel ? mainLabel.length * 6.5 : 0,
    subLabel ? subLabel.length * 5.5 : 0,
  ) + 22
  const hasBoth = !!mainLabel && !!subLabel
  const height = hasBoth ? 36 : 22
  const main = mainLabel ? `<span style="font-size:12px;font-weight:700;line-height:1;display:block">${mainLabel}</span>` : ''
  const sub = subLabel ? `<span style="font-size:10px;font-weight:500;line-height:1;opacity:0.85;display:block${hasBoth ? ';margin-top:4px' : ''}">${subLabel}</span>` : ''
  const html = `<div class="trek-stats-inner" style="
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    width:100%;height:100%;
    padding:0 11px;border-radius:999px;
    background:rgba(17,24,39,0.92);color:#fff;
    box-shadow:0 2px 6px rgba(0,0,0,0.25);
    border:1px solid ${TRANSPORT_COLOR}aa;
    font-family:-apple-system,system-ui,'SF Pro Text',sans-serif;
    white-space:nowrap;box-sizing:border-box;pointer-events:none;
    transform-origin:center;will-change:transform;
  ">${main}${sub}</div>`
  return { html, width: estWidth, height }
}

// ── Main component ───────────────────────────────────────────────────────
export const MapViewAMap = memo(function MapViewAMap({
  places = [],
  dayPlaces = [],
  route = null,
  routeSegments = [],
  selectedPlaceId = null,
  onMarkerClick,
  onMapClick,
  onMapContextMenu = null,
  center = [48.8566, 2.3522],
  zoom = 10,
  fitKey = 0,
  dayOrderMap = {},
  leftWidth = 0,
  rightWidth = 0,
  hasInspector = false,
  hasDayDetail = false,
  dayDetailId = null,
  reservations = [] as Reservation[],
  showReservationStats = false,
  visibleConnectionIds = [] as number[],
  onReservationClick,
}: Props) {
  const amapKey = useSettingsStore(s => s.settings.amap_key || '')
  const amapSecurityCode = useSettingsStore(s => s.settings.amap_security_code || '')
  const placesPhotosEnabled = useAuthStore(s => s.placesPhotosEnabled)
  const showEndpointLabels = useSettingsStore(s => s.settings.map_booking_labels) !== false

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<AMapInstance | null>(null)
  const AMapRef = useRef<any>(null) // the AMap constructor namespace
  const markersRef = useRef<Map<number, AMapMarkerType>>(new Map())
  const clusterRef = useRef<any>(null)
  const routePolylinesRef = useRef<AMapPolylineType[]>([])
  const routeLabelMarkersRef = useRef<AMapMarkerType[]>([])
  const gpxPolylinesRef = useRef<AMapPolylineType[]>([])
  const locationMarkersRef = useRef<{ dot: AMapMarkerType | null; heading: AMapMarkerType | null; accuracy: AMapCircleType | null }>({ dot: null, heading: null, accuracy: null })
  const reservationPolylinesRef = useRef<AMapPolylineType[]>([])
  const reservationEndpointMarkersRef = useRef<AMapMarkerType[]>([])
  const reservationStatsMarkersRef = useRef<{ marker: AMapMarkerType; arc: [number, number][] }[]>([])

  // 多边形区域搜索相关 ref
  const polygonRef = useRef<any>(null)                              // AMap.Polygon 实例
  const polygonVertexMarkersRef = useRef<AMapMarkerType[]>([])      // 多边形顶点标记
  const searchResultMarkersRef = useRef<AMapMarkerType[]>([])       // 搜索结果标记
  const polygonSearchActiveRef = useRef(false)                      // 供地图事件回调读取的 ref
  const polygonInfoWindowRef = useRef<any>(null)                    // 搜索结果信息窗口

  const onClickRefs = useRef({ marker: onMarkerClick, map: onMapClick, context: onMapContextMenu })
  onClickRefs.current.marker = onMarkerClick
  onClickRefs.current.map = onMapClick
  onClickRefs.current.context = onMapContextMenu
  const onReservationClickRef = useRef(onReservationClick)
  onReservationClickRef.current = onReservationClick

  const { position: userPosition, mode: trackingMode, error: trackingError, cycleMode: cycleTrackingMode, setMode: setTrackingMode } = useGeolocation()

  // ── Photo loading with RAF batching ──────────────────────────────────
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>(getAllThumbs)
  const pendingThumbsRef = useRef<Record<string, string>>({})
  const thumbRafRef = useRef<number | null>(null)
  const placeIds = useMemo(() => places.map(p => p.id).join(','), [places])

  useEffect(() => {
    if (!places || places.length === 0 || !placesPhotosEnabled) return
    const cleanups: (() => void)[] = []

    const setThumb = (cacheKey: string, thumb: string) => {
      pendingThumbsRef.current[cacheKey] = thumb
      if (thumbRafRef.current !== null) return
      thumbRafRef.current = requestAnimationFrame(() => {
        thumbRafRef.current = null
        const pending = pendingThumbsRef.current
        pendingThumbsRef.current = {}
        setPhotoUrls(prev => {
          const hasChange = Object.entries(pending).some(([k, v]) => prev[k] !== v)
          return hasChange ? { ...prev, ...pending } : prev
        })
      })
    }

    for (const place of places) {
      const cacheKey = place.google_place_id || place.osm_id || `${place.lat},${place.lng}`
      if (!cacheKey) continue
      const cached = getCached(cacheKey)
      if (cached?.thumbDataUrl) {
        setThumb(cacheKey, cached.thumbDataUrl)
        continue
      }
      cleanups.push(onThumbReady(cacheKey, thumb => setThumb(cacheKey, thumb)))
      if (!cached && !isLoading(cacheKey)) {
        const photoId =
          (place.image_url?.startsWith('/api/maps/place-photo/') ? place.image_url : null)
          || place.google_place_id
          || place.osm_id
          || place.image_url
        if (photoId || (place.lat && place.lng)) {
          fetchPhoto(cacheKey, photoId || `coords:${place.lat}:${place.lng}`, place.lat, place.lng, place.name)
        }
      }
    }

    return () => {
      cleanups.forEach(fn => fn())
      if (thumbRafRef.current !== null) {
        cancelAnimationFrame(thumbRafRef.current)
        thumbRafRef.current = null
      }
    }
  }, [placeIds, placesPhotosEnabled])

  // ── Hover tooltip state ──────────────────────────────────────────────
  const [hoveredPlace, setHoveredPlace] = useState<any>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const isTouchDevice = typeof window !== 'undefined' && navigator.maxTouchPoints > 0

  // IP 定位标记（只执行一次）
  const ipLocatedRef = useRef(false)
  // 地铁图视图
  const [showSubway, setShowSubway] = useState(false)

  // 多边形区域搜索状态
  const [polygonSearchActive, setPolygonSearchActive] = useState(false)       // 是否处于绘制模式
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([])  // 多边形顶点（GCJ-02 [lng, lat]）
  const [searchKeywords, setSearchKeywords] = useState('')                    // 搜索关键词
  const [searchResults, setSearchResults] = useState<any[]>([])               // 搜索结果
  const [searchLoading, setSearchLoading] = useState(false)                   // 搜索中
  const [showKeywordInput, setShowKeywordInput] = useState(false)             // 是否显示关键词输入框
  const [showResultsPanel, setShowResultsPanel] = useState(true)              // 结果面板是否展开
  const [resultsPanelHeight, setResultsPanelHeight] = useState(170)           // 结果面板高度（手机端可拖动调整）

  // 同步 polygonSearchActive 到 ref，供地图事件回调使用
  useEffect(() => {
    polygonSearchActiveRef.current = polygonSearchActive
  }, [polygonSearchActive])

  // ── 多边形区域搜索：绘制多边形轮廓和顶点标记 ──────────────────────
  useEffect(() => {
    const AMap = AMapRef.current
    const map = mapRef.current
    if (!AMap || !map) return

    // 清理旧的多边形和顶点标记
    if (polygonRef.current) { try { polygonRef.current.setMap(null) } catch {} polygonRef.current = null }
    polygonVertexMarkersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
    polygonVertexMarkersRef.current = []

    if (!polygonSearchActive || polygonPoints.length === 0) return

    // 绘制多边形轮廓（2个点以上显示连线，3个点以上显示填充区域）
    if (polygonPoints.length >= 2) {
      const path = polygonPoints.map(([lng, lat]) => new AMap.LngLat(lng, lat))
      try {
        const polygon = new AMap.Polygon({
          path,
          strokeColor: '#3b82f6',
          strokeWeight: 2,
          strokeOpacity: 0.9,
          fillColor: '#3b82f6',
          fillOpacity: 0.12,
          zIndex: 50,
        })
        polygon.setMap(map)
        polygonRef.current = polygon
      } catch { /* ignore */ }
    }

    // 绘制顶点标记（蓝色圆点）
    for (const [lng, lat] of polygonPoints) {
      const el = document.createElement('div')
      el.style.cssText = `
        width:12px;height:12px;border-radius:50%;
        background:#3b82f6;border:2px solid white;
        box-shadow:0 1px 4px rgba(0,0,0,0.3);
        pointer-events:none;
      `
      try {
        const marker = new AMap.Marker({
          position: new AMap.LngLat(lng, lat),
          content: el,
          offset: new AMap.Pixel(-6, -6),
          zIndex: 120,
        })
        marker.setMap(map)
        polygonVertexMarkersRef.current.push(marker)
      } catch { /* ignore */ }
    }
  }, [polygonPoints, polygonSearchActive])

  // ── Initialize AMap ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !amapKey) return

    // Set security config before loading
    if (amapSecurityCode) {
      (window as any)._AMapSecurityConfig = { securityJsCode: amapSecurityCode }
    }

    let destroyed = false

    AMapLoader.load({
      key: amapKey,
      version: '2.0',
      plugins: [
        // Note: AMap.Scale and AMap.MarkerCluster both removed.
        // Scale internally produces LngLat(NaN) when map state is incomplete.
        // MarkerCluster calls lngLatToContainer on every map interaction,
        // producing continuous NaN errors that lock up the map.
      ],
    }).then((AMap: any) => {
      if (destroyed) return
      AMapRef.current = AMap

      // ── Monkey-patch AMap.LngLat and AMap.Pixel ──────────────────────
      // ROOT CAUSE: AMap SDK internally calls `new LngLat(NaN, NaN)` from
      // its event loop (zoom/pan/mousemove). The LngLat constructor throws
      // "Invalid Object: LngLat(NaN, NaN)" which breaks the SDK's internal
      // event loop, permanently locking the map.
      //
      // window.onerror/onunhandledrejection CANNOT prevent this because:
      // 1. The throw happens inside the SDK's own try-catch in some paths
      // 2. The SDK caches the LngLat reference before we can intercept
      // 3. Even if suppressed, the SDK's internal state is already broken
      //
      // SOLUTION: Replace the LngLat/Pixel constructors with wrappers that
      // substitute NaN with safe defaults instead of throwing. This way the
      // SDK never enters a broken state.
      const _OrigLngLat = AMap.LngLat
      const _OrigPixel = AMap.Pixel

      AMap.LngLat = function(lng: any, lat: any) {
        const nLng = Number(lng)
        const nLat = Number(lat)
        if (!Number.isFinite(nLng) || !Number.isFinite(nLat)) {
          // Substitute with a safe default instead of throwing
          return new _OrigLngLat(116.397428, 39.90923)
        }
        return new _OrigLngLat(nLng, nLat)
      } as any
      AMap.LngLat.prototype = _OrigLngLat.prototype
      // Preserve static methods
      Object.keys(_OrigLngLat).forEach(k => {
        if (!(k in AMap.LngLat)) (AMap.LngLat as any)[k] = (_OrigLngLat as any)[k]
      })

      AMap.Pixel = function(x: any, y: any) {
        const nX = Number(x)
        const nY = Number(y)
        if (!Number.isFinite(nX) || !Number.isFinite(nY)) {
          return new _OrigPixel(0, 0)
        }
        return new _OrigPixel(nX, nY)
      } as any
      AMap.Pixel.prototype = _OrigPixel.prototype
      Object.keys(_OrigPixel).forEach(k => {
        if (!(k in AMap.Pixel)) (AMap.Pixel as any)[k] = (_OrigPixel as any)[k]
      })

      console.log('[AMap] LngLat/Pixel NaN-safe patches installed')

      const gcj = safeGcj(center[1], center[0]) || [116.397428, 39.90923] // fallback: Beijing
      const map = new AMap.Map(containerRef.current, {
        center: gcj,
        zoom,
        resizeEnable: true,
        mapStyle: 'amap://styles/normal',
      })
      mapRef.current = map

      // ── IP 定位：首次加载且 center 为默认值（巴黎）时自动定位 ──────
      if (!ipLocatedRef.current && center[0] === 48.8566 && center[1] === 2.3522) {
        ipLocatedRef.current = true
        mapsApi.ipLocateAmap().then((data: any) => {
          if (data?.center && !destroyed && mapRef.current) {
            // IP 定位返回 GCJ-02 坐标，可直接用于 AMap
            mapRef.current.setCenter([data.center.lng, data.center.lat])
            mapRef.current.setZoom(12)
          }
        }).catch(() => {})
      }

      // ── Map-instance-level coordinate safety wrappers ───────────────
      // Even though we patched AMap.LngLat/Pixel constructors above, the SDK
      // has internal code paths that bypass constructors (e.g., Object.create,
      // factory methods, inline object literals). These wrappers intercept
      // coordinate conversions at the map level and guarantee no NaN leaks.
      const SAFE_CENTER: [number, number] = [116.397428, 39.90923]
      const _origContainerToLngLat = map.containerToLngLat.bind(map)
      map.containerToLngLat = function(pixel: any): any {
        try {
          const result = _origContainerToLngLat(pixel)
          if (!result) return new AMap.LngLat(...SAFE_CENTER)
          const lng = result.getLng?.() ?? result.lng
          const lat = result.getLat?.() ?? result.lat
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
            return new AMap.LngLat(...SAFE_CENTER)
          }
          return result
        } catch {
          return new AMap.LngLat(...SAFE_CENTER)
        }
      }
      const _origLngLatToContainer = map.lngLatToContainer.bind(map)
      map.lngLatToContainer = function(lnglat: any): any {
        try {
          const result = _origLngLatToContainer(lnglat)
          if (!result) return new AMap.Pixel(0, 0)
          const x = result.getX?.() ?? result.x
          const y = result.getY?.() ?? result.y
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return new AMap.Pixel(0, 0)
          }
          return result
        } catch {
          return new AMap.Pixel(0, 0)
        }
      }

      // ── Periodic health monitor ───────────────────────────────────────
      // Runs every 2 seconds to detect and recover from silent state corruption.
      // This catches NaN states that slip past event-based health checks.
      // NOTE: Do NOT call map.resize() here — it can trigger more NaN errors.
      const healthInterval = setInterval(() => {
        try {
          const c = map.getCenter()
          if (!c || Number.isNaN(c.getLng()) || Number.isNaN(c.getLat()) || !Number.isFinite(c.getLng()) || !Number.isFinite(c.getLat())) {
            console.warn('[AMap] Health check: NaN center detected, recovering...')
            map.setCenter(SAFE_CENTER)
            map.setZoom(10)
          }
          const z = map.getZoom()
          if (Number.isNaN(z) || !Number.isFinite(z)) {
            console.warn('[AMap] Health check: NaN zoom detected, recovering...')
            map.setZoom(10)
          }
        } catch {}
      }, 2000)
      // Store interval ID for cleanup
      ;(map as any).__healthInterval = healthInterval

      // Force resize after DOM layout to ensure correct dimensions
      // Then validate: if resize corrupted state, restore safe defaults
      setTimeout(() => {
        try {
          const prevCenter = map.getCenter()
          const prevZoom = map.getZoom()
          map.resize()
          const c = map.getCenter()
          if (c && (!Number.isFinite(c.getLng()) || !Number.isFinite(c.getLat()))) {
            console.warn('[AMap] resize() produced NaN, restoring...')
            map.setCenter(prevCenter && Number.isFinite(prevCenter.getLng()) ? prevCenter : SAFE_CENTER)
            map.setZoom(Number.isFinite(prevZoom) ? prevZoom : 10)
          }
        } catch {}
      }, 200)

      // Click handler — 多边形搜索模式添加顶点，否则转换 GCJ-02 → WGS-84 并回调
      map.on('click', (e: any) => {
        if (polygonSearchActiveRef.current) {
          const lng = e.lnglat.getLng()
          const lat = e.lnglat.getLat()
          setPolygonPoints(prev => [...prev, [lng, lat]])
          return
        }
        const [wgsLng, wgsLat] = gcj02ToWgs84(e.lnglat.getLng(), e.lnglat.getLat())
        onClickRefs.current.map?.({ latlng: { lat: wgsLat, lng: wgsLng } })
      })

      // Right-click handler — 绘制模式时禁用右键菜单
      map.on('rightclick', (e: any) => {
        if (polygonSearchActiveRef.current) return
        if (!onClickRefs.current.context) return
        const [wgsLng, wgsLat] = gcj02ToWgs84(e.lnglat.getLng(), e.lnglat.getLat())
        onClickRefs.current.context({
          latlng: { lat: wgsLat, lng: wgsLng },
          originalEvent: e.originalEvent || new MouseEvent('contextmenu'),
        })
      })

      // Drop follow mode on user drag
      map.on('dragstart', () => {
        setTrackingMode(prev => prev === 'follow' ? 'show' : prev)
      })

      // Update reservation stats rotation on move/zoom
      map.on('moveend', () => {
        updateReservationStatsRotation()
        // Health check: detect NaN center and recover
        // Do NOT call map.resize() here — it triggers more NaN errors!
        try {
          const center = map.getCenter()
          if (center && (Number.isNaN(center.getLng()) || Number.isNaN(center.getLat()) ||
              !Number.isFinite(center.getLng()) || !Number.isFinite(center.getLat()))) {
            console.warn('[AMap] NaN center detected on moveend, resetting...')
            map.setCenter([116.397428, 39.90923])
            map.setZoom(10)
          }
        } catch {}
      })
      map.on('zoomend', () => {
        updateReservationStatsRotation()
        // Health check: detect NaN zoom/center and recover
        // Do NOT call map.resize() here — it triggers more NaN errors!
        try {
          const zoom = map.getZoom()
          const center = map.getCenter()
          const hasNaNZoom = Number.isNaN(zoom) || !Number.isFinite(zoom)
          const hasNaNCenter = center && (Number.isNaN(center.getLng()) || Number.isNaN(center.getLat()) ||
              !Number.isFinite(center.getLng()) || !Number.isFinite(center.getLat()))
          if (hasNaNZoom || hasNaNCenter) {
            console.warn('[AMap] NaN detected on zoomend, resetting...')
            map.setCenter(SAFE_CENTER)
            map.setZoom(10)
          }
        } catch {}
      })

      // Debounced mousemove health check: detect NaN coordinates early
      // and recover by resetting center/zoom (NOT by calling resize(),
      // which can itself trigger NaN errors in AMap SDK)
      let mouseMoveRecoverTimer: ReturnType<typeof setTimeout> | null = null
      map.on('mousemove', () => {
        if (mouseMoveRecoverTimer) return // debounce: only check once per 500ms
        mouseMoveRecoverTimer = setTimeout(() => { mouseMoveRecoverTimer = null }, 500)
        try {
          const center = map.getCenter()
          if (center && (Number.isNaN(center.getLng()) || Number.isNaN(center.getLat()) ||
              !Number.isFinite(center.getLng()) || !Number.isFinite(center.getLat()))) {
            console.warn('[AMap] NaN center on mousemove, recovering...')
            map.setCenter(SAFE_CENTER)
            map.setZoom(10)
          }
        } catch {}
      })
    }).catch((err: any) => {
      console.error('AMap load failed:', err)
    })

    return () => {
      destroyed = true
      // Clear periodic health monitor
      if (mapRef.current && (mapRef.current as any).__healthInterval) {
        clearInterval((mapRef.current as any).__healthInterval)
      }
      // Clean up all markers and overlays
      markersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
      markersRef.current.clear()
      if (clusterRef.current) { try { clusterRef.current.setMap(null) } catch {} clusterRef.current = null }
      routePolylinesRef.current.forEach(p => { try { p.setMap(null) } catch {} })
      routePolylinesRef.current = []
      routeLabelMarkersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
      routeLabelMarkersRef.current = []
      gpxPolylinesRef.current.forEach(p => { try { p.setMap(null) } catch {} })
      gpxPolylinesRef.current = []
      clearLocationMarkers()
      clearReservationOverlays()
      // 清理多边形区域搜索相关图形
      if (polygonRef.current) { try { polygonRef.current.setMap(null) } catch {} polygonRef.current = null }
      polygonVertexMarkersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
      polygonVertexMarkersRef.current = []
      searchResultMarkersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
      searchResultMarkersRef.current = []
      if (polygonInfoWindowRef.current) { try { polygonInfoWindowRef.current.close() } catch {} polygonInfoWindowRef.current = null }
      if (mapRef.current) { try { mapRef.current.destroy() } catch {} mapRef.current = null }
      AMapRef.current = null
    }
  }, [amapKey, amapSecurityCode]) // rebuild on key change

  // ── ResizeObserver: keep map coordinate system consistent ───────────
  // Only call map.resize() for genuine container size changes.
  // After resize, validate state — if NaN, restore safe defaults.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      const map = mapRef.current
      if (!map) return
      try {
        const prevCenter = map.getCenter()
        const prevZoom = map.getZoom()
        map.resize()
        const c = map.getCenter()
        if (c && (!Number.isFinite(c.getLng()) || !Number.isFinite(c.getLat()))) {
          map.setCenter(prevCenter && Number.isFinite(prevCenter.getLng()) ? prevCenter : [116.397428, 39.90923])
          map.setZoom(Number.isFinite(prevZoom) ? prevZoom : 10)
        }
      } catch {}
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // ── Overlay visibility change ────────────────────────────────────────
  // NOTE: DayDetailPanel and PlaceInspector use position:fixed — they do NOT
  // change the map container's dimensions. The main branch's Leaflet version
  // also does NOT call invalidateSize() when overlays appear. Calling
  // map.resize() here was causing AMap's internal coordinate system to
  // recalculate and produce NaN errors, making the map go gray.
  // Therefore: do NOT call map.resize() when overlays change.
  // The ResizeObserver above handles actual container size changes.

  // ── Marker reconciliation ────────────────────────────────────────────
  useEffect(() => {
    const AMap = AMapRef.current
    const map = mapRef.current
    if (!AMap || !map) return

    try {
      const ids = new Set(places.map(p => p.id))

      // Remove markers for places no longer present
      markersRef.current.forEach((marker, id) => {
        if (!ids.has(id)) {
          try { marker.setMap(null) } catch {}
          markersRef.current.delete(id)
        }
      })

      // Guard: skip if map container has no valid size yet (causes NaN from lngLatToContainer)
      const mapSize = map.getSize()
      if (!mapSize || mapSize.getWidth() <= 0 || mapSize.getHeight() <= 0) return

      // Create or update markers
      const markerList: AMapMarkerType[] = []

      for (const place of places) {
        const gcj = safeGcj(place.lng, place.lat)
        if (!gcj) continue  // skip places with invalid coordinates
        const [gcjLng, gcjLat] = gcj
        const orderNumbers = dayOrderMap[place.id] ?? null
        const pck = place.google_place_id || place.osm_id || `${place.lat},${place.lng}`
        const photoUrl = (pck && photoUrls[pck]) || getAssetUrl(place.image_url) || null
        const selected = place.id === selectedPlaceId
        const el = createMarkerElement(place as Place & { category_color?: string; category_icon?: string }, photoUrl, orderNumbers, selected)

        // Click handler
        el.addEventListener('click', (ev: Event) => {
          ev.stopPropagation()
          onClickRefs.current.marker?.(place.id)
        })

        // Hover handlers
        el.addEventListener('mouseenter', () => {
          if (isTouchDevice) return
          setHoveredPlace(place)
          try {
            const pixel = map.lngLatToContainer(new AMap.LngLat(gcjLng, gcjLat))
            if (pixel) {
              const containerRect = containerRef.current?.getBoundingClientRect()
              if (containerRect) {
                setTooltipPos({ x: containerRect.left + pixel.getX() + 14, y: containerRect.top + pixel.getY() - 10 })
              }
            }
          } catch { /* ignore */ }
        })
        el.addEventListener('mouseleave', () => {
          setHoveredPlace(null)
        })

        // Remove existing marker for this place and recreate
        const existing = markersRef.current.get(place.id)
        if (existing) {
          try { existing.setMap(null) } catch {}
        }

        // Per-marker try-catch: MarkerCluster internal processing may throw
        // Invalid Object: Pixel(NaN) even with valid position coords
        try {
          const marker = new AMap.Marker({
            position: new AMap.LngLat(gcjLng, gcjLat),
            content: el,
            offset: new AMap.Pixel(0, 0),
            anchor: 'center',
            zIndex: selected ? 200 : 100,
          })
          marker.setMap(map)
          markersRef.current.set(place.id, marker)
          markerList.push(marker)
        } catch {
          // Silently skip markers that fail (e.g. cluster internal error)
        }
      }

      // ── Clustering DISABLED ────────────────────────────────────────
      // MarkerCluster internally calls lngLatToContainer on every map interaction
      // (zoom, pan, mouse move). If any marker has a position that produces NaN
      // during cluster internal processing, it throws Uncaught Error continuously,
      // which locks up the entire map interaction.
      // For travel planning (typically <100 places), clustering is unnecessary.
      if (clusterRef.current) {
        try { clusterRef.current.setMap(null) } catch {}
        clusterRef.current = null
      }
      // cluster intentionally not created — markers render directly on map
    } catch { /* noop — AMap SDK internal errors suppressed */ }
  }, [places, selectedPlaceId, dayOrderMap, photoUrls])

  // ── Route polyline rendering ─────────────────────────────────────────
  useEffect(() => {
    const AMap = AMapRef.current
    const map = mapRef.current
    if (!AMap || !map) return

    // Clear existing route polylines
    routePolylinesRef.current.forEach(p => { try { p.setMap(null) } catch {} })
    routePolylinesRef.current = []

    if (!route || route.length === 0) return

    for (const seg of route) {
      if (!seg || seg.length < 2) continue
      // 防御性清洗：过滤掉非 [number, number] 格式的坐标
      const cleanSeg = seg.filter((c): c is [number, number] => Array.isArray(c) && c.length === 2 && typeof c[0] === 'number' && typeof c[1] === 'number')
      if (cleanSeg.length < 2) continue
      // Convert all coordinates WGS-84 → GCJ-02
      const gcjPath = wgs84ToGcj02Batch(cleanSeg.map(([lat, lng]) => [lng, lat]))
      const path = gcjPath.map(([lng, lat]) => new AMap.LngLat(lng, lat))
      const polyline = new AMap.Polyline({
        path,
        strokeColor: '#111827',
        strokeWeight: 3,
        strokeOpacity: 0.9,
        strokeStyle: 'dashed',
        strokeDasharray: [6, 5],
        lineJoin: 'round',
        lineCap: 'round',
        zIndex: 50,
      })
      polyline.setMap(map)
      routePolylinesRef.current.push(polyline)
    }
  }, [route])

  // ── Route segment labels (walking/driving time pills) ────────────────
  useEffect(() => {
    const AMap = AMapRef.current
    const map = mapRef.current
    if (!AMap || !map) return

    try {
      // Guard: skip if map not ready
      const mapSize = map.getSize()
      if (!mapSize || mapSize.getWidth() <= 0 || mapSize.getHeight() <= 0) return

      // Clear existing
      routeLabelMarkersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
      routeLabelMarkersRef.current = []

      for (const seg of routeSegments) {
        if (!seg.mid || (!seg.walkingText && !seg.drivingText)) continue
        const gcjMid = safeGcj(seg.mid[1], seg.mid[0])
        if (!gcjMid) continue
        const el = document.createElement('div')
        el.style.pointerEvents = 'none'
        el.innerHTML = `<div style="display:flex;align-items:center;gap:5px;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);color:#fff;border-radius:99px;padding:3px 9px;font-size:9px;font-weight:600;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,0.3);">
          <span style="display:flex;align-items:center;gap:2px"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="M7 21l3-7"/><path d="M10 14l5-5"/><path d="M15 9l-4 7"/><path d="M18 18l-3-7"/></svg>${seg.walkingText ?? ''}</span>
          <span style="opacity:0.3">|</span>
          <span style="display:flex;align-items:center;gap:2px"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2-4H7L5 10l-2.5 1.1C1.7 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>${seg.drivingText ?? ''}</span>
        </div>`

        try {
          const marker = new AMap.Marker({
            position: new AMap.LngLat(gcjMid[0], gcjMid[1]),
            content: el,
            offset: new AMap.Pixel(0, 0),
            anchor: 'center',
            zIndex: 250,
          })
          marker.setMap(map)
          routeLabelMarkersRef.current.push(marker)
        } catch { /* skip */ }
      }
    } catch { /* noop */ }

    return () => {
      routeLabelMarkersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
      routeLabelMarkersRef.current = []
    }
  }, [routeSegments])

  // ── GPX route geometries ─────────────────────────────────────────────
  useEffect(() => {
    const AMap = AMapRef.current
    const map = mapRef.current
    if (!AMap || !map) return

    // Clear existing
    gpxPolylinesRef.current.forEach(p => { try { p.setMap(null) } catch {} })
    gpxPolylinesRef.current = []

    for (const place of places) {
      if (!place.route_geometry) continue
      try {
        const coords = JSON.parse(place.route_geometry) as [number, number][]
        if (!coords || coords.length < 2) continue
        // Convert WGS-84 → GCJ-02
        const gcjPath = wgs84ToGcj02Batch(coords.map(([lat, lng]) => [lng, lat]))
        const path = gcjPath.map(([lng, lat]) => new AMap.LngLat(lng, lat))
        const polyline = new AMap.Polyline({
          path,
          strokeColor: (place as any).category_color || '#3b82f6',
          strokeWeight: 3.5,
          strokeOpacity: 0.75,
          lineJoin: 'round',
          lineCap: 'round',
          zIndex: 40,
        })
        polyline.setMap(map)
        gpxPolylinesRef.current.push(polyline)
      } catch { /* skip invalid geometry */ }
    }

    return () => {
      gpxPolylinesRef.current.forEach(p => { try { p.setMap(null) } catch {} })
      gpxPolylinesRef.current = []
    }
  }, [places])

  // ── Fit bounds on fitKey change ──────────────────────────────────────
  const paddingOpts = useMemo(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    if (isMobile) return { top: 40, right: 20, bottom: 40, left: 20 }
    const top = 60
    const bottom = hasInspector ? 320 : hasDayDetail ? 280 : 60
    return { top, right: rightWidth + 40, bottom, left: leftWidth + 40 }
  }, [leftWidth, rightWidth, hasInspector, hasDayDetail])

  const prevFitKey = useRef(-1)
  useEffect(() => {
    if (fitKey === prevFitKey.current) return
    prevFitKey.current = fitKey
    const AMap = AMapRef.current
    const map = mapRef.current
    if (!AMap || !map) return
    try {
      const target = dayPlaces.length > 0 ? dayPlaces : places
      const gcjCoords: [number, number][] = []
      for (const p of target) {
        const gcj = safeGcj(p.lng, p.lat)
        if (gcj) gcjCoords.push(gcj)
      }
      if (gcjCoords.length === 0) return

      // ── Use setZoomAndCenter instead of setBounds ──────────────────
      // AMap's setBounds() internally calculates zoom/center from bounds
      // + padding, which can produce NaN values that corrupt the map's
      // internal coordinate system permanently. setZoomAndCenter() sets
      // values directly without the problematic calculation.
      //
      // Calculate center and zoom manually from the coordinates:
      const avgLng = gcjCoords.reduce((s, c) => s + c[0], 0) / gcjCoords.length
      const avgLat = gcjCoords.reduce((s, c) => s + c[1], 0) / gcjCoords.length

      // Calculate appropriate zoom from the coordinate spread
      const lngSpread = Math.max(...gcjCoords.map(c => c[0])) - Math.min(...gcjCoords.map(c => c[0]))
      const latSpread = Math.max(...gcjCoords.map(c => c[1])) - Math.min(...gcjCoords.map(c => c[1]))
      const maxSpread = Math.max(lngSpread, latSpread)

      // Heuristic zoom from spread (roughly matches AMap's zoom levels)
      let zoom: number
      if (maxSpread > 50) zoom = 3
      else if (maxSpread > 20) zoom = 4
      else if (maxSpread > 10) zoom = 5
      else if (maxSpread > 5) zoom = 6
      else if (maxSpread > 2) zoom = 7
      else if (maxSpread > 1) zoom = 8
      else if (maxSpread > 0.5) zoom = 9
      else if (maxSpread > 0.2) zoom = 10
      else if (maxSpread > 0.1) zoom = 11
      else if (maxSpread > 0.05) zoom = 12
      else if (maxSpread > 0.02) zoom = 13
      else if (maxSpread > 0.01) zoom = 14
      else zoom = 15

      // Don't zoom out further than current zoom if only one place
      if (gcjCoords.length === 1) {
        zoom = Math.max(map.getZoom() || 10, 12)
      }

      map.setZoomAndCenter(zoom, [avgLng, avgLat], false, 400)

      if (hasDayDetail) {
        setTimeout(() => {
          try { map.panBy(0, 150) } catch {}
        }, 500)
      }
    } catch { /* noop */ }
  }, [fitKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pan to selected place ────────────────────────────────────────────
  const prevSelectedId = useRef<number | null>(null)
  useEffect(() => {
    const AMap = AMapRef.current
    const map = mapRef.current
    if (!AMap || !map || !selectedPlaceId) return
    if (selectedPlaceId === prevSelectedId.current) return
    prevSelectedId.current = selectedPlaceId
    const target = places.find(p => p.id === selectedPlaceId) || dayPlaces.find(p => p.id === selectedPlaceId)
    const gcj = safeGcj(target?.lng, target?.lat)
    if (!gcj) return
    try {
      map.setZoomAndCenter(Math.max(map.getZoom(), 14), gcj, false, 400)
    } catch { /* noop */ }
  }, [selectedPlaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── External center/zoom prop changes ────────────────────────────────
  const prevCenter = useRef(center)
  useEffect(() => {
    const AMap = AMapRef.current
    const map = mapRef.current
    if (!AMap || !map) return
    if (prevCenter.current[0] === center[0] && prevCenter.current[1] === center[1]) return
    prevCenter.current = center
    const gcj = safeGcj(center[1], center[0])
    if (!gcj) return
    try { map.setCenter(gcj) } catch { /* noop */ }
  }, [center[0], center[1]]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Location blue dot ────────────────────────────────────────────────
  function clearLocationMarkers() {
    const loc = locationMarkersRef.current
    if (loc.dot) { try { loc.dot.setMap(null) } catch {} loc.dot = null }
    if (loc.heading) { try { loc.heading.setMap(null) } catch {} loc.heading = null }
    if (loc.accuracy) { try { loc.accuracy.setMap(null) } catch {} loc.accuracy = null }
  }

  const centeredRef = useRef(false)
  useEffect(() => {
    if (trackingMode === 'off') { centeredRef.current = false; clearLocationMarkers(); return }
  }, [trackingMode])

  useEffect(() => {
    const AMap = AMapRef.current
    const map = mapRef.current
    if (!AMap || !map) return
    if (trackingMode === 'off' || !userPosition) {
      clearLocationMarkers()
      return
    }

    const gcj = safeGcj(userPosition.lng, userPosition.lat)
    if (!gcj) { clearLocationMarkers(); return }
    const [gcjLng, gcjLat] = gcj

    // Accuracy circle
    if (userPosition.accuracy < 500) {
      if (!locationMarkersRef.current.accuracy) {
        locationMarkersRef.current.accuracy = new AMap.Circle({
          center: new AMap.LngLat(gcjLng, gcjLat),
          radius: userPosition.accuracy,
          strokeColor: '#3b82f6',
          strokeWeight: 1,
          strokeOpacity: 0.35,
          fillColor: '#3b82f6',
          fillOpacity: 0.12,
          zIndex: 80,
        })
        locationMarkersRef.current.accuracy.setMap(map)
      } else {
        locationMarkersRef.current.accuracy.setCenter(new AMap.LngLat(gcjLng, gcjLat))
        locationMarkersRef.current.accuracy.setRadius(userPosition.accuracy)
      }
    }

    // Heading indicator
    if (userPosition.heading !== null && !Number.isNaN(userPosition.heading)) {
      const headingEl = document.createElement('div')
      headingEl.style.cssText = `
        width:60px;height:60px;
        transform:rotate(${userPosition.heading}deg);transition:transform 120ms ease-out;
        background:conic-gradient(from -30deg, rgba(59,130,246,0) 0deg, rgba(59,130,246,0.35) 15deg, rgba(59,130,246,0) 60deg, rgba(59,130,246,0) 360deg);
        border-radius:50%;
        -webkit-mask:radial-gradient(circle, transparent 12px, black 13px);
        mask:radial-gradient(circle, transparent 12px, black 13px);
        pointer-events:none;
      `
      if (!locationMarkersRef.current.heading) {
        locationMarkersRef.current.heading = new AMap.Marker({
          position: new AMap.LngLat(gcjLng, gcjLat),
          content: headingEl,
          offset: new AMap.Pixel(-30, -30),
          zIndex: 90,
        })
        locationMarkersRef.current.heading.setMap(map)
      } else {
        locationMarkersRef.current.heading.setPosition(new AMap.LngLat(gcjLng, gcjLat))
        locationMarkersRef.current.heading.setContent(headingEl)
      }
    } else if (locationMarkersRef.current.heading) {
      try { locationMarkersRef.current.heading.setMap(null) } catch {}
      locationMarkersRef.current.heading = null
    }

    // Blue dot
    const dotEl = document.createElement('div')
    dotEl.style.cssText = `
      width:16px;height:16px;border-radius:50%;
      border:3px solid white;background:#3b82f6;
      box-shadow:0 0 4px rgba(59,130,246,0.5);
      pointer-events:none;
    `
    if (!locationMarkersRef.current.dot) {
      locationMarkersRef.current.dot = new AMap.Marker({
        position: new AMap.LngLat(gcjLng, gcjLat),
        content: dotEl,
        offset: new AMap.Pixel(-8, -8),
        zIndex: 95,
      })
      locationMarkersRef.current.dot.setMap(map)
    } else {
      locationMarkersRef.current.dot.setPosition(new AMap.LngLat(gcjLng, gcjLat))
      locationMarkersRef.current.dot.setContent(dotEl)
    }

    // Follow mode: center map on user
    if (trackingMode === 'follow') {
      try {
        map.setZoomAndCenter(Math.max(map.getZoom(), 16), [gcjLng, gcjLat], false, 350)
      } catch { /* noop */ }
    }

    // First fix in 'show' mode: pan to it
    if (!centeredRef.current && trackingMode === 'show') {
      try {
        map.setZoomAndCenter(Math.max(map.getZoom(), 15), [gcjLng, gcjLat])
        centeredRef.current = true
      } catch { /* noop */ }
    }
  }, [userPosition, trackingMode])

  // ── Reservation overlay ──────────────────────────────────────────────
  const visibleReservations = useMemo(() => {
    if (!visibleConnectionIds || visibleConnectionIds.length === 0) return []
    const set = new Set(visibleConnectionIds)
    return reservations.filter(r => set.has(r.id))
  }, [reservations, visibleConnectionIds])

  function clearReservationOverlays() {
    reservationPolylinesRef.current.forEach(p => { try { p.setMap(null) } catch {} })
    reservationPolylinesRef.current = []
    reservationEndpointMarkersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
    reservationEndpointMarkersRef.current = []
    reservationStatsMarkersRef.current.forEach(s => { try { s.marker.setMap(null) } catch {} })
    reservationStatsMarkersRef.current = []
  }

  function updateReservationStatsRotation() {
    const AMap = AMapRef.current
    const map = mapRef.current
    if (!AMap || !map) return
    for (const entry of reservationStatsMarkersRef.current) {
      const { marker, arc } = entry
      if (arc.length < 2) continue
      const midIdx = Math.floor(arc.length / 2)
      const a = arc[Math.max(0, midIdx - 2)]
      const b = arc[Math.min(arc.length - 1, midIdx + 2)]
      if (!a || !b) continue
      try {
        const gcjA = safeGcj(a[1], a[0])
        const gcjB = safeGcj(b[1], b[0])
        if (!gcjA || !gcjB) continue
        const pixelA = map.lngLatToContainer(new AMap.LngLat(gcjA[0], gcjA[1]))
        const pixelB = map.lngLatToContainer(new AMap.LngLat(gcjB[0], gcjB[1]))
        if (!pixelA || !pixelB) continue
        let angle = Math.atan2(pixelB.getY() - pixelA.getY(), pixelB.getX() - pixelA.getX()) * 180 / Math.PI
        if (angle > 90) angle -= 180
        if (angle < -90) angle += 180
        const el = marker.getContent() as HTMLElement
        const inner = el?.querySelector?.('.trek-stats-inner') as HTMLElement | null
        if (inner) inner.style.transform = `rotate(${angle}deg)`
      } catch { /* map not ready */ }
    }
  }

  useEffect(() => {
    const AMap = AMapRef.current
    const map = mapRef.current
    if (!AMap || !map) return

    try {
      // Guard: skip if map not ready
      const mapSize = map.getSize()
      if (!mapSize || mapSize.getWidth() <= 0 || mapSize.getHeight() <= 0) return

      // Clear previous
      clearReservationOverlays()

      const items = buildReservationItems(visibleReservations)
      if (items.length === 0) return

      // Visible filter: pixel distance between endpoints — skip items with invalid coords
      const visibleItems = items.filter(item => {
        const gcjFrom = safeGcj(item.from.lng, item.from.lat)
        const gcjTo = safeGcj(item.to.lng, item.to.lat)
        if (!gcjFrom || !gcjTo) return true // show if coords invalid
        try {
          const fromPx = map.lngLatToContainer(new AMap.LngLat(gcjFrom[0], gcjFrom[1]))
          const toPx = map.lngLatToContainer(new AMap.LngLat(gcjTo[0], gcjTo[1]))
          if (!fromPx || !toPx) return true
          const dx = fromPx.getX() - toPx.getX(), dy = fromPx.getY() - toPx.getY()
          const dist = Math.sqrt(dx * dx + dy * dy)
          const minPx = item.type === 'flight' ? 50 : item.type === 'cruise' ? 150 : item.type === 'car' ? 80 : 200
          return dist >= minPx
        } catch { return true }
      })

      // Label visibility threshold
      const labelVisibleIds = new Set<number>()
      for (const item of visibleItems) {
        const gcjFrom = safeGcj(item.from.lng, item.from.lat)
        const gcjTo = safeGcj(item.to.lng, item.to.lat)
        if (!gcjFrom || !gcjTo) continue
        try {
          const fromPx = map.lngLatToContainer(new AMap.LngLat(gcjFrom[0], gcjFrom[1]))
          const toPx = map.lngLatToContainer(new AMap.LngLat(gcjTo[0], gcjTo[1]))
          if (!fromPx || !toPx) continue
          const dx = fromPx.getX() - toPx.getX(), dy = fromPx.getY() - toPx.getY()
          const dist = Math.sqrt(dx * dx + dy * dy)
          const minPx = item.type === 'flight' ? 50 : item.type === 'cruise' ? 300 : item.type === 'car' ? 150 : 400
          if (dist >= minPx) labelVisibleIds.add(item.res.id)
        } catch { /* ignore */ }
      }

      // ── Draw polylines ───────────────────────────────────────────────
      for (const item of visibleItems) {
        for (const seg of item.arcs) {
          if (!seg || seg.length < 2) continue
          const gcjPath = wgs84ToGcj02Batch(seg.map(([lat, lng]) => [lng, lat]))
          const path = gcjPath.map(([lng, lat]) => new AMap.LngLat(lng, lat))
          const isConfirmed = item.res.status === 'confirmed'
          const polyline = new AMap.Polyline({
            path,
            strokeColor: TRANSPORT_COLOR,
            strokeWeight: 2.5,
            strokeOpacity: isConfirmed ? 0.75 : 0.55,
            strokeStyle: isConfirmed ? 'solid' : 'dashed',
            strokeDasharray: isConfirmed ? undefined : [6, 6],
            lineJoin: 'round',
            lineCap: 'round',
            zIndex: 60,
          })
          polyline.setMap(map)
          reservationPolylinesRef.current.push(polyline)
        }
      }

      // ── Endpoint markers ─────────────────────────────────────────────
      for (const item of visibleItems) {
        const showLabel = showEndpointLabels && labelVisibleIds.has(item.res.id)
        for (const ep of [item.from, item.to]) {
          const gcjEp = safeGcj(ep.lng, ep.lat)
          if (!gcjEp) continue // skip endpoints without valid coordinates
          const label = showLabel ? (ep.code || cleanName(ep.name)) : null
          const el = document.createElement('div')
          el.innerHTML = endpointMarkerHtml(item.type, label)
          const node = el.firstElementChild as HTMLElement || el
          node.title = ep.name || ''
          if (onReservationClickRef.current) {
            node.addEventListener('click', (ev: Event) => {
              ev.stopPropagation()
              onReservationClickRef.current?.(item.res.id)
            })
          }
          try {
            const marker = new AMap.Marker({
              position: new AMap.LngLat(gcjEp[0], gcjEp[1]),
              content: node,
              offset: new AMap.Pixel(0, 0),
              anchor: 'center',
              zIndex: 150,
            })
            marker.setMap(map)
            reservationEndpointMarkersRef.current.push(marker)
          } catch { /* skip */ }
        }
      }

      // ── Stats labels (flights only) ──────────────────────────────────
      if (showReservationStats) {
        for (const item of visibleItems) {
          if (item.type !== 'flight') continue
          if (!labelVisibleIds.has(item.res.id)) continue
          if (!item.mainLabel && !item.subLabel) continue
          const arc = item.primaryArc
          if (arc.length < 2) continue
          const mid = arc[Math.floor(arc.length / 2)]
          if (!mid) continue
          const { html, width, height } = buildStatsHtml(item.mainLabel, item.subLabel)
          const el = document.createElement('div')
          el.style.cssText = `width:${width}px;height:${height}px;pointer-events:none;`
          el.innerHTML = html
          const gcjMid = safeGcj(mid[1], mid[0])
          if (!gcjMid) continue
          try {
            const marker = new AMap.Marker({
              position: new AMap.LngLat(gcjMid[0], gcjMid[1]),
              content: el,
              offset: new AMap.Pixel(0, 0),
              anchor: 'center',
              zIndex: 160,
            })
            marker.setMap(map)
            reservationStatsMarkersRef.current.push({ marker, arc })
          } catch { /* skip */ }
        }
        // Prime rotation
        updateReservationStatsRotation()
      }
    } catch { /* noop — AMap SDK internal errors suppressed */ }

    return () => {
      clearReservationOverlays()
    }
  }, [visibleReservations, showReservationStats, showEndpointLabels])

  // ── 多边形区域搜索：处理函数 ────────────────────────────────────────

  // 清理所有多边形搜索相关的临时图形
  function clearPolygonSearchOverlays() {
    if (polygonRef.current) { try { polygonRef.current.setMap(null) } catch {} polygonRef.current = null }
    polygonVertexMarkersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
    polygonVertexMarkersRef.current = []
    searchResultMarkersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
    searchResultMarkersRef.current = []
    if (polygonInfoWindowRef.current) { try { polygonInfoWindowRef.current.close() } catch {} polygonInfoWindowRef.current = null }
  }

  // 切换区域搜索模式（按钮点击）
  function handleTogglePolygonSearch() {
    if (polygonSearchActive) {
      handleCancelPolygonSearch()
    } else {
      // 开始新的搜索：清理之前的结果
      clearPolygonSearchOverlays()
      setSearchResults([])
      setSearchKeywords('')
      setPolygonPoints([])
      setShowKeywordInput(false)
      setPolygonSearchActive(true)
    }
  }

  // 完成绘制，显示关键词输入框
  function handleCompletePolygonSearch() {
    if (polygonPoints.length < 3) return
    setShowKeywordInput(true)
  }

  // 执行区域搜索
  async function handlePerformSearch() {
    if (!searchKeywords.trim() || polygonPoints.length < 3) return
    setSearchLoading(true)
    // 清理旧的搜索结果标记
    searchResultMarkersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
    searchResultMarkersRef.current = []

    try {
      // GCJ-02 → WGS-84 转换后传给后端 API
      const wgsPolygon = polygonPoints.map(([lng, lat]) => {
        const [wgsLng, wgsLat] = gcj02ToWgs84(lng, lat)
        return { lat: wgsLat, lng: wgsLng }
      })
      const data = await mapsApi.searchPolygonAmap(wgsPolygon, searchKeywords.trim())
      let places = (data?.places || []) as any[]

      // 按距离当前定位由近到远排序
      if (userPosition && places.length > 0) {
        const userLat = userPosition.lat
        const userLng = userPosition.lng
        places = places.map(p => {
          // 计算距离（简化版 haversine，单位 km）
          const R = 6371
          const dLat = (p.lat - userLat) * Math.PI / 180
          const dLng = (p.lng - userLng) * Math.PI / 180
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(userLat * Math.PI / 180) * Math.cos(p.lat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2)
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
          return { ...p, _distance: dist }
        }).sort((a, b) => (a._distance || 0) - (b._distance || 0))
      }

      setSearchResults(places)
      setShowResultsPanel(true)

      // 清理多边形绘制图形（保留搜索结果标记）
      if (polygonRef.current) { try { polygonRef.current.setMap(null) } catch {} polygonRef.current = null }
      polygonVertexMarkersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
      polygonVertexMarkersRef.current = []

      // 退出绘制模式
      setPolygonSearchActive(false)
      setShowKeywordInput(false)

      // 在地图上添加搜索结果标记（蓝色圆点样式）
      const AMap = AMapRef.current
      const map = mapRef.current
      if (!AMap || !map) return

      // 创建/重置信息窗口
      if (polygonInfoWindowRef.current) { try { polygonInfoWindowRef.current.close() } catch {} }
      polygonInfoWindowRef.current = new AMap.InfoWindow({
        offset: new AMap.Pixel(0, -16),
        closeWhenClickMap: true,
      })

      for (const place of places) {
        if (!place.lat || !place.lng) continue
        // 后端返回的坐标是 GCJ-02（来自高德 API），可直接用于 AMap
        const gcjLng = place.lng
        const gcjLat = place.lat

        const el = document.createElement('div')
        el.style.cssText = `
          width:14px;height:14px;border-radius:50%;
          background:#3b82f6;border:2px solid white;
          box-shadow:0 1px 4px rgba(0,0,0,0.3);
          cursor:pointer;
        `
        try {
          const marker = new AMap.Marker({
            position: new AMap.LngLat(gcjLng, gcjLat),
            content: el,
            offset: new AMap.Pixel(-7, -7),
            zIndex: 110,
          })
          marker.setMap(map)

          // 点击标记显示信息窗口
          marker.on('click', () => {
            if (!polygonInfoWindowRef.current) return
            const html = `
              <div style="padding:4px;min-width:180px;max-width:260px;font-family:-apple-system,system-ui,sans-serif;">
                <div style="font-weight:600;font-size:13px;color:#111827;margin-bottom:4px;">${place.name || '未知'}</div>
                ${place.address ? `<div style="font-size:11px;color:#6b7280;margin-bottom:2px;">${place.address}</div>` : ''}
                ${place.category ? `<div style="font-size:11px;color:#9ca3af;">${place.category}</div>` : ''}
              </div>
            `
            polygonInfoWindowRef.current.setContent(html)
            polygonInfoWindowRef.current.open(map, new AMap.LngLat(gcjLng, gcjLat))
          })

          searchResultMarkersRef.current.push(marker)
        } catch { /* skip */ }
      }
    } catch (err) {
      console.error('Polygon search failed:', err)
      alert('搜索失败，请重试')
    } finally {
      setSearchLoading(false)
    }
  }

  // 取消搜索，清理所有临时图形
  function handleCancelPolygonSearch() {
    setPolygonSearchActive(false)
    setPolygonPoints([])
    setSearchKeywords('')
    setSearchResults([])
    setShowKeywordInput(false)
    clearPolygonSearchOverlays()
  }

  // 清除搜索结果
  function handleClearSearchResults() {
    setSearchResults([])
    searchResultMarkersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
    searchResultMarkersRef.current = []
    if (polygonInfoWindowRef.current) { try { polygonInfoWindowRef.current.close() } catch {} }
  }

  // 点击结果列表项：地图居中并显示信息窗口
  function handleResultItemClick(place: any) {
    const AMap = AMapRef.current
    const map = mapRef.current
    if (!AMap || !map || !place.lat || !place.lng) return
    try {
      // 后端返回的坐标已经是 GCJ-02（来自高德 API），可直接用于 AMap
      const gcjLng = place.lng
      const gcjLat = place.lat
      map.setZoomAndCenter(16, [gcjLng, gcjLat])
      // 打开信息窗口
      if (polygonInfoWindowRef.current) {
        const distText = place._distance != null
          ? (place._distance < 1 ? `${Math.round(place._distance * 1000)}m` : `${place._distance.toFixed(1)}km`)
          : ''
        const navUrl = `https://uri.amap.com/navigation?to=${gcjLng},${gcjLat},${encodeURIComponent(place.name || '目的地')}&mode=car&src=trek&coordinate=gaode&callnative=1`
        const html = `
          <div style="padding:4px;min-width:180px;max-width:260px;font-family:-apple-system,system-ui,sans-serif;">
            <div style="font-weight:600;font-size:13px;color:#111827;margin-bottom:4px;">${place.name || '未知'}</div>
            ${place.address ? `<div style="font-size:11px;color:#6b7280;margin-bottom:2px;">${place.address}</div>` : ''}
            ${place.category ? `<div style="font-size:11px;color:#9ca3af;margin-bottom:4px;">${place.category}</div>` : ''}
            ${distText ? `<div style="font-size:11px;color:#3b82f6;margin-bottom:6px;">距您 ${distText}</div>` : ''}
            <a href="${navUrl}" target="_blank" style="display:inline-block;padding:4px 12px;background:#3b82f6;color:white;text-decoration:none;border-radius:6px;font-size:12px;">导航前往</a>
          </div>
        `
        polygonInfoWindowRef.current.setContent(html)
        polygonInfoWindowRef.current.open(map, new AMap.LngLat(gcjLng, gcjLat))
      }
    } catch { /* ignore */ }
  }

  // 导航到指定地点（调用高德导航）
  function handleNavigate(place: any) {
    if (!place.lat || !place.lng) return
    const gcjLng = place.lng
    const gcjLat = place.lat
    // 使用高德 URI API 唤起导航，callnative=1 会尝试唤起高德地图 App
    // 坐标已是 GCJ-02，使用 coordinate=gaode
    const navUrl = `https://uri.amap.com/navigation?to=${gcjLng},${gcjLat},${encodeURIComponent(place.name || '目的地')}&mode=car&src=trek&coordinate=gaode&callnative=1`
    window.open(navUrl, '_blank')
  }

  // ── No AMap key placeholder ──────────────────────────────────────────
  if (!amapKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-center px-6">
        <div className="text-sm text-zinc-500">
          No AMap key configured.<br />
          <span className="text-xs">Settings → Map → AMap</span>
        </div>
      </div>
    )
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const locationButtonBottom = 'calc(var(--bottom-nav-h, 84px) + 12px)'

  // ── Tooltip overlay ──────────────────────────────────────────────────
  const TooltipOverlay = hoveredPlace && tooltipPos && !isTouchDevice
  const CatIcon = TooltipOverlay ? getCategoryIcon(hoveredPlace.category_icon) : null

  return (
    <>
      <div className="w-full h-full relative" style={{ isolation: 'isolate', transform: 'translateZ(0)' }}>
        <div ref={containerRef} className="w-full h-full" />
        {/* 功能按钮栏 - 顶部居中横向排列 */}
        <div style={{
          position: 'absolute',
          top: isMobile ? 8 : 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          display: 'flex',
          gap: 4,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: isMobile ? 8 : 10,
          padding: isMobile ? '3px 4px' : '4px 6px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        }}>
          {/* Polygon search button */}
          <button
            onClick={handleTogglePolygonSearch}
            style={{
              width: isMobile ? 32 : 36,
              height: isMobile ? 32 : 36,
              borderRadius: 6,
              border: 'none',
              background: polygonSearchActive ? '#3b82f6' : 'transparent',
              color: polygonSearchActive ? 'white' : '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            title={polygonSearchActive ? '退出区域搜索' : '区域搜索'}
          >
            <Search size={isMobile ? 16 : 18} />
          </button>
          {/* Subway button */}
          <button
            onClick={() => setShowSubway(true)}
            style={{
              width: isMobile ? 32 : 36,
              height: isMobile ? 32 : 36,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            title="地铁图"
          >
            <Train size={isMobile ? 16 : 18} />
          </button>
        </div>
        {isMobile && (
          <LocationButton
            mode={trackingMode}
            error={trackingError}
            onClick={cycleTrackingMode}
            bottomOffset={locationButtonBottom as unknown as number}
          />
        )}

        {/* 多边形区域搜索 - 顶部工具栏（在按钮栏下方，避免被底部tab栏和右侧栏遮挡） */}
        {polygonSearchActive && (
          <div style={{
            position: 'absolute',
            top: isMobile ? 48 : 56,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            background: 'rgba(255,255,255,0.98)',
            borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            padding: isMobile ? '8px 10px' : '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 6 : 10,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
            maxWidth: isMobile ? '92%' : '90%',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            {!showKeywordInput ? (
              <>
                <span style={{ fontSize: isMobile ? 11 : 13, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  已添加 {polygonPoints.length} 个顶点{polygonPoints.length < 3 ? '（至少3个）' : ''}
                </span>
                <button
                  onClick={handleCompletePolygonSearch}
                  disabled={polygonPoints.length < 3}
                  style={{
                    padding: isMobile ? '5px 10px' : '6px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: polygonPoints.length >= 3 ? '#3b82f6' : '#d1d5db',
                    color: 'white',
                    fontSize: isMobile ? 11 : 13,
                    fontWeight: 600,
                    cursor: polygonPoints.length >= 3 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Search size={isMobile ? 12 : 14} />
                  完成搜索
                </button>
                <button
                  onClick={handleCancelPolygonSearch}
                  style={{
                    padding: isMobile ? '5px 10px' : '6px 14px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    background: 'white',
                    color: '#374151',
                    fontSize: isMobile ? 11 : 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <X size={isMobile ? 12 : 14} />
                  取消
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={searchKeywords}
                  onChange={e => setSearchKeywords(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && searchKeywords.trim() && !searchLoading) handlePerformSearch() }}
                  placeholder="输入关键词，如：餐厅、酒店"
                  autoFocus
                  style={{
                    flex: 1,
                    minWidth: isMobile ? 120 : 200,
                    padding: isMobile ? '5px 8px' : '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    fontSize: isMobile ? 12 : 13,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handlePerformSearch}
                  disabled={!searchKeywords.trim() || searchLoading}
                  style={{
                    padding: isMobile ? '5px 10px' : '6px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: searchKeywords.trim() && !searchLoading ? '#3b82f6' : '#d1d5db',
                    color: 'white',
                    fontSize: isMobile ? 11 : 13,
                    fontWeight: 600,
                    cursor: searchKeywords.trim() && !searchLoading ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {searchLoading ? <Loader2 size={isMobile ? 12 : 14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={isMobile ? 12 : 14} />}
                  {searchLoading ? '搜索中' : '搜索'}
                </button>
                <button
                  onClick={() => { setShowKeywordInput(false); setSearchKeywords('') }}
                  style={{
                    padding: isMobile ? '5px 10px' : '6px 14px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    background: 'white',
                    color: '#374151',
                    fontSize: isMobile ? 11 : 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  返回
                </button>
              </>
            )}
          </div>
        )}

        {/* 搜索结果列表面板 - 底部居中弹窗（位于底部tab栏上方，避免被遮挡） */}
        {searchResults.length > 0 && !polygonSearchActive && (
          <div style={{
            position: 'absolute',
            // 手机端：使用 CSS 变量确保在底部 tab 栏上方
            // 电脑端：底部无 tab 栏，定位在底部 20px
            bottom: isMobile ? 'calc(var(--bottom-nav-h, 84px) + 12px)' : 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 150,
            width: isMobile ? 'calc(100% - 24px)' : 420,
            // 手机端：使用可拖动调整的高度；电脑端：最多显示6个结果
            maxHeight: isMobile ? resultsPanelHeight : 360,
            background: 'rgba(255,255,255,0.98)',
            borderRadius: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            transition: isMobile ? 'max-height 0.15s ease-out' : 'none',
          }}>
            {/* 手机端可拖动调整高度的把手 */}
            {isMobile && (
              <div
                style={{
                  height: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'ns-resize',
                  background: '#f9fafb',
                  flexShrink: 0,
                  touchAction: 'none',
                }}
                onTouchStart={(e) => {
                  const startY = e.touches[0].clientY
                  const startH = resultsPanelHeight
                  const onMove = (ev: TouchEvent) => {
                    const delta = startY - ev.touches[0].clientY
                    const newH = Math.max(120, Math.min(window.innerHeight * 0.7, startH + delta))
                    setResultsPanelHeight(newH)
                  }
                  const onEnd = () => {
                    document.removeEventListener('touchmove', onMove)
                    document.removeEventListener('touchend', onEnd)
                  }
                  document.addEventListener('touchmove', onMove, { passive: false })
                  document.addEventListener('touchend', onEnd)
                }}
              >
                <div style={{ width: 36, height: 4, borderRadius: 2, background: '#d1d5db' }} />
              </div>
            )}
            <div
              style={{
                padding: isMobile ? '8px 12px' : '10px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: showResultsPanel ? '1px solid #f0f0f0' : 'none',
                background: '#f9fafb',
                flexShrink: 0,
              }}
              onClick={() => setShowResultsPanel(!showResultsPanel)}
            >
              <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: '#111827' }}>
                搜索结果 ({searchResults.length})
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleClearSearchResults() }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="清除结果"
                >
                  <X size={14} />
                </button>
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                  {showResultsPanel ? '收起 ▲' : '展开 ▼'}
                </span>
              </div>
            </div>
            {showResultsPanel && (
              <div style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
                {searchResults.map((place, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleResultItemClick(place)}
                    style={{
                      padding: isMobile ? '6px 12px' : '8px 14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f5f5f5',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0f7ff'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {place.name || '未知'}
                      </div>
                      {place.address && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {place.address}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {place._distance != null && (
                          <span style={{ fontSize: isMobile ? 9 : 10, color: '#3b82f6' }}>
                            {place._distance < 1 ? `${Math.round(place._distance * 1000)}m` : `${place._distance.toFixed(1)}km`}
                          </span>
                        )}
                        {place.category && (
                          <span style={{ fontSize: isMobile ? 9 : 10, color: '#9ca3af' }}>
                            {place.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleNavigate(place) }}
                      style={{
                        border: 'none',
                        background: '#3b82f6',
                        color: 'white',
                        cursor: 'pointer',
                        borderRadius: 6,
                        padding: isMobile ? '4px 8px' : '4px 10px',
                        fontSize: 11,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      导航
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {TooltipOverlay && (
        <div data-testid="tooltip" style={{
          position: 'fixed',
          left: tooltipPos.x + 14,
          top: tooltipPos.y - 10,
          zIndex: 9999,
          pointerEvents: 'none',
          background: 'white',
          borderRadius: 8,
          boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
          padding: '6px 10px',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
          maxWidth: 220,
          whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {hoveredPlace.name}
          </div>
          {hoveredPlace.category_name && CatIcon && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
              <CatIcon size={10} style={{ color: hoveredPlace.category_color || '#6b7280', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#6b7280' }}>{hoveredPlace.category_name}</span>
            </div>
          )}
          {hoveredPlace.address && (
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {hoveredPlace.address}
            </div>
          )}
        </div>
      )}

      {/* 地铁图视图 */}
      {showSubway && <SubwayMapView onClose={() => setShowSubway(false)} />}
    </>
  )
})
