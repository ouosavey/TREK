import type { RouteResult, RouteSegment, Waypoint } from '../../types'
import { mapsApi } from '../../api/client'
import { useSettingsStore } from '../../store/settingsStore'

const OSRM_BASE = 'https://router.project-osrm.org/route/v1'

/** 判断坐标是否在中国境内 */
function isInChina(lat: number, lng: number): boolean {
  return lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55
}

/** 判断是否应使用高德路线规划 */
function shouldUseAmap(waypoints: Waypoint[]): boolean {
  const mapProvider = useSettingsStore.getState().settings.map_provider
  if (mapProvider !== 'amap') return false
  // 所有途经点都在中国境内才使用高德
  return waypoints.every(p => p.lat && p.lng && isInChina(p.lat, p.lng))
}

/** Fetches a full route: 优先高德，失败回退 OSRM */
export async function calculateRoute(
  waypoints: Waypoint[],
  profile: 'driving' | 'walking' | 'cycling' = 'driving',
  { signal }: { signal?: AbortSignal } = {}
): Promise<RouteResult> {
  if (!waypoints || waypoints.length < 2) {
    throw new Error('At least 2 waypoints required')
  }

  // 高德优先
  if (shouldUseAmap(waypoints)) {
    try {
      const result = await mapsApi.routeAmap(
        waypoints.map(p => ({ lat: p.lat!, lng: p.lng! })),
        profile,
      )
      if (result && result.coordinates) {
        return {
          coordinates: result.coordinates,
          distance: result.distance,
          duration: result.duration,
          distanceText: result.distanceText,
          durationText: result.durationText,
          walkingText: result.walkingText,
          drivingText: result.drivingText,
        }
      }
    } catch (err) {
      console.warn('[Route] AMap route failed, falling back to OSRM:', err)
    }
  }

  // OSRM 回退
  return calculateOsmRoute(waypoints, profile, { signal })
}

/** OSRM 路线计算（原始逻辑） */
async function calculateOsmRoute(
  waypoints: Waypoint[],
  profile: 'driving' | 'walking' | 'cycling' = 'driving',
  { signal }: { signal?: AbortSignal } = {}
): Promise<RouteResult> {
  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `${OSRM_BASE}/${profile}/${coords}?overview=full&geometries=geojson&steps=false`

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error('Route could not be calculated')
  }

  const data = await response.json()

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error('No route found')
  }

  const route = data.routes[0]
  const coordinates: [number, number][] = route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng])

  const distance: number = route.distance
  let duration: number
  if (profile === 'walking') {
    duration = distance / (5000 / 3600)
  } else if (profile === 'cycling') {
    duration = distance / (15000 / 3600)
  } else {
    duration = route.duration
  }

  const walkingDuration = distance / (5000 / 3600)
  const drivingDuration: number = route.duration

  return {
    coordinates,
    distance,
    duration,
    distanceText: formatDistance(distance),
    durationText: formatDuration(duration),
    walkingText: formatDuration(walkingDuration),
    drivingText: formatDuration(drivingDuration),
  }
}

export function generateGoogleMapsUrl(places: Waypoint[]): string | null {
  const valid = places.filter((p) => p.lat && p.lng)
  if (valid.length === 0) return null
  if (valid.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${valid[0].lat},${valid[0].lng}`
  }
  const stops = valid.map((p) => `${p.lat},${p.lng}`).join('/')
  return `https://www.google.com/maps/dir/${stops}`
}

/** 生成高德地图导航链接 */
export function generateAmapUrl(places: Waypoint[]): string | null {
  const valid = places.filter((p) => p.lat && p.lng)
  if (valid.length === 0) return null
  if (valid.length === 1) {
    return `https://uri.amap.com/marker?position=${valid[0].lng},${valid[0].lat}&src=TREK`
  }
  const origin = `${valid[0].lng},${valid[0].lat}`
  const dest = `${valid[valid.length - 1].lng},${valid[valid.length - 1].lat}`
  const via = valid.slice(1, -1).map((p) => `${p.lng},${p.lat}`).join(';')
  return `https://uri.amap.com/navigation?from=${origin}&to=${dest}${via ? '&via=' + via : ''}&src=TREK`
}

/** Reorders waypoints using a nearest-neighbor heuristic to minimize total Euclidean distance. */
export function optimizeRoute(places: Waypoint[]): Waypoint[] {
  const valid = places.filter((p) => p.lat && p.lng)
  if (valid.length <= 2) return places

  const visited = new Set<number>()
  const result: Waypoint[] = []
  let current = valid[0]
  visited.add(0)
  result.push(current)

  while (result.length < valid.length) {
    let nearestIdx = -1
    let minDist = Infinity
    for (let i = 0; i < valid.length; i++) {
      if (visited.has(i)) continue
      const d = Math.sqrt(
        Math.pow(valid[i].lat - current.lat, 2) + Math.pow(valid[i].lng - current.lng, 2)
      )
      if (d < minDist) { minDist = d; nearestIdx = i }
    }
    if (nearestIdx === -1) break
    visited.add(nearestIdx)
    current = valid[nearestIdx]
    result.push(current)
  }
  return result
}

/** Fetches per-leg distance/duration: 优先高德，失败回退 OSRM */
export async function calculateSegments(
  waypoints: Waypoint[],
  { signal }: { signal?: AbortSignal } = {}
): Promise<RouteSegment[]> {
  if (!waypoints || waypoints.length < 2) return []

  // 高德优先
  if (shouldUseAmap(waypoints)) {
    try {
      const result = await mapsApi.segmentsAmap(
        waypoints.map(p => ({ lat: p.lat!, lng: p.lng! })),
      )
      if (result && Array.isArray(result) && result.length > 0) {
        return result as RouteSegment[]
      }
    } catch (err) {
      console.warn('[Route] AMap segments failed, falling back to OSRM:', err)
    }
  }

  // OSRM 回退
  return calculateOsmSegments(waypoints, { signal })
}

/** OSRM 段落计算（原始逻辑） */
async function calculateOsmSegments(
  waypoints: Waypoint[],
  { signal }: { signal?: AbortSignal } = {}
): Promise<RouteSegment[]> {
  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `${OSRM_BASE}/driving/${coords}?overview=false&geometries=geojson&steps=false&annotations=distance,duration`

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Route could not be calculated')

  const data = await response.json()
  if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('No route found')

  const legs = data.routes[0].legs
  return legs.map((leg: { distance: number; duration: number }, i: number): RouteSegment => {
    const from: [number, number] = [waypoints[i].lat, waypoints[i].lng]
    const to: [number, number] = [waypoints[i + 1].lat, waypoints[i + 1].lng]
    const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
    const walkingDuration = leg.distance / (5000 / 3600)
    return {
      mid, from, to,
      walkingText: formatDuration(walkingDuration),
      drivingText: formatDuration(leg.duration),
    }
  })
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) {
    return `${h} h ${m} min`
  }
  return `${m} min`
}
