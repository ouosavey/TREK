import { forwardRef, useImperativeHandle, useRef } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import JourneyMap, { type JourneyMapHandle } from './JourneyMap'
import JourneyMapGL, { type JourneyMapGLHandle } from './JourneyMapGL'
import JourneyMapAMap, { type JourneyMapAMapHandle } from './JourneyMapAMap'

// Unified handle — both providers expose the same three methods.
export type JourneyMapAutoHandle = JourneyMapHandle

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

const JourneyMapAuto = forwardRef<JourneyMapAutoHandle, Props>(function JourneyMapAuto(props, ref) {
  const provider = useSettingsStore(s => s.settings.map_provider)
  const token = useSettingsStore(s => s.settings.mapbox_access_token)
  const amapKey = useSettingsStore(s => s.settings.amap_key)
  const leafletRef = useRef<JourneyMapHandle>(null)
  const glRef = useRef<JourneyMapGLHandle>(null)
  const amapRef = useRef<JourneyMapAMapHandle>(null)

  // Priority: amap (with key) > mapbox-gl (with token) > leaflet (fallback)
  const useAMap = provider === 'amap' && !!amapKey
  // Fall back to Leaflet when the user selected Mapbox GL but hasn't
  // supplied a token yet — otherwise the map would just show a stub.
  const useGL = !useAMap && provider === 'mapbox-gl' && !!token

  useImperativeHandle(ref, () => ({
    highlightMarker: (id) => (useAMap ? amapRef.current : useGL ? glRef.current : leafletRef.current)?.highlightMarker(id),
    focusMarker: (id) => (useAMap ? amapRef.current : useGL ? glRef.current : leafletRef.current)?.focusMarker(id),
    invalidateSize: () => (useAMap ? amapRef.current : useGL ? glRef.current : leafletRef.current)?.invalidateSize(),
  }), [useAMap, useGL])

  if (useAMap) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <JourneyMapAMap ref={amapRef} {...(props as any)} />
  }
  if (useGL) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <JourneyMapGL ref={glRef} {...(props as any)} />
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <JourneyMap ref={leafletRef} {...(props as any)} />
})

export default JourneyMapAuto
