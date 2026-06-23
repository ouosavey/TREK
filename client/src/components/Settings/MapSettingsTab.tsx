import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Map, Save, Layers, Box, ChevronDown, Check } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { useSettingsStore } from '../../store/settingsStore'
import { useToast } from '../shared/Toast'
import CustomSelect from '../shared/CustomSelect'
import { MapView } from '../Map/MapView'
import { MapViewAMap } from '../Map/MapViewAMap'
import MapboxPreview from './MapboxPreview'
import Section from './Section'
import ToggleSwitch from './ToggleSwitch'
import type { Place } from '../../types'

interface MapPreset {
  name: string
  url: string
}

const MAP_PRESETS: MapPreset[] = [
  { name: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { name: 'OpenStreetMap DE', url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png' },
  { name: 'CartoDB Light', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  { name: 'CartoDB Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  { name: 'Stadia Smooth', url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png' },
]

interface StylePreset {
  name: string
  url: string
  tags: string[]
}

const MAPBOX_STYLE_PRESETS: StylePreset[] = [
  { name: 'Mapbox Standard',          url: 'mapbox://styles/mapbox/standard',            tags: ['3D', 'Apple-like'] },
  { name: 'Standard Satellite',       url: 'mapbox://styles/mapbox/standard-satellite',  tags: ['3D', 'Satellite'] },
  { name: 'Streets',                  url: 'mapbox://styles/mapbox/streets-v12',         tags: ['3D', 'Classic'] },
  { name: 'Outdoors',                 url: 'mapbox://styles/mapbox/outdoors-v12',        tags: ['3D', 'Terrain'] },
  { name: 'Light',                    url: 'mapbox://styles/mapbox/light-v11',           tags: ['3D', 'Minimal'] },
  { name: 'Dark',                     url: 'mapbox://styles/mapbox/dark-v11',            tags: ['3D', 'Dark'] },
  { name: 'Satellite',                url: 'mapbox://styles/mapbox/satellite-v9',        tags: ['3D', 'Satellite'] },
  { name: 'Satellite Streets',        url: 'mapbox://styles/mapbox/satellite-streets-v12', tags: ['3D', 'Satellite'] },
  { name: 'Navigation Day',           url: 'mapbox://styles/mapbox/navigation-day-v1',   tags: ['3D', 'Apple-like'] },
  { name: 'Navigation Night',         url: 'mapbox://styles/mapbox/navigation-night-v1', tags: ['3D', 'Dark'] },
]

// Tag → chip color mapping. Keeps the dropdown readable at a glance so a
// user scanning the list can spot 3D / Satellite / Apple-like styles.
const TAG_STYLES: Record<string, string> = {
  '3D': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  '2D': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'Satellite': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Apple-like': 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  'Modern': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  'Dark': 'bg-zinc-800 text-zinc-100 dark:bg-zinc-900 dark:text-zinc-300',
  'Minimal': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  'Hillshading': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'Terrain': 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300',
  'Realistic': 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  'Navigation': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'Classic': 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  'Hybrid': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  'No labels': 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
}

function TagChip({ tag }: { tag: string }) {
  const cls = TAG_STYLES[tag] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  return (
    <span className={`text-[9px] font-semibold tracking-wide uppercase px-1.5 py-[3px] rounded leading-none ${cls}`}>
      {tag}
    </span>
  )
}

function StyleDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const selected = MAPBOX_STYLE_PRESETS.find(p => p.url === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 hover:border-slate-400 focus:ring-2 focus:ring-slate-400 focus:border-transparent"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-slate-900 dark:text-white truncate">
            {selected ? selected.name : t('settings.mapStylePlaceholder')}
          </span>
          {selected && (
            <span className="flex items-center gap-1 flex-shrink-0">
              {selected.tags.map(t => <TagChip key={t} tag={t} />)}
            </span>
          )}
        </span>
        <ChevronDown size={14} className="flex-shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-80 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
          {MAPBOX_STYLE_PRESETS.map(preset => {
            const isActive = preset.url === value
            return (
              <button
                key={preset.url}
                type="button"
                onClick={() => { onChange(preset.url); setOpen(false) }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${isActive ? 'bg-slate-50 dark:bg-slate-800' : ''}`}
              >
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-900 dark:text-white font-medium">{preset.name}</span>
                  {preset.tags.map(t => <TagChip key={t} tag={t} />)}
                </span>
                {isActive && <Check size={14} className="flex-shrink-0 text-slate-900 dark:text-white" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

type Provider = 'leaflet' | 'mapbox-gl' | 'amap'

export default function MapSettingsTab(): React.ReactElement {
  const { settings, updateSettings } = useSettingsStore()
  const { t } = useTranslation()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [provider, setProvider] = useState<Provider>((settings.map_provider as Provider) || 'amap')
  const [mapTileUrl, setMapTileUrl] = useState<string>(settings.map_tile_url || '')
  const [mapboxToken, setMapboxToken] = useState<string>(settings.mapbox_access_token || '')
  const [mapboxStyle, setMapboxStyle] = useState<string>(settings.mapbox_style || 'mapbox://styles/mapbox/standard')
  const [mapbox3d, setMapbox3d] = useState<boolean>(settings.mapbox_3d_enabled !== false)
  const [mapboxQuality, setMapboxQuality] = useState<boolean>(settings.mapbox_quality_mode === true)
  const [defaultLat, setDefaultLat] = useState<number | string>(settings.default_lat || 48.8566)
  const [defaultLng, setDefaultLng] = useState<number | string>(settings.default_lng || 2.3522)
  const [defaultZoom, setDefaultZoom] = useState<number | string>(settings.default_zoom || 10)
  const [amapKey, setAmapKey] = useState<string>('')
  const [amapSecurityCode, setAmapSecurityCode] = useState<string>('')
  const [amapWebServiceKey, setAmapWebServiceKey] = useState<string>('')
  const [amapKeyGlobal, setAmapKeyGlobal] = useState<boolean>(false)
  const [amapSecurityCodeGlobal, setAmapSecurityCodeGlobal] = useState<boolean>(false)
  const [amapWebServiceKeyGlobal, setAmapWebServiceKeyGlobal] = useState<boolean>(false)

  const [searchProvider, setSearchProvider] = useState<'auto' | 'amap' | 'google'>((settings.search_provider as 'auto' | 'amap' | 'google') || 'auto')

  useEffect(() => {
    setProvider((settings.map_provider as Provider) || 'amap')
    setMapTileUrl(settings.map_tile_url || '')
    setMapboxToken(settings.mapbox_access_token || '')
    setMapboxStyle(settings.mapbox_style || 'mapbox://styles/mapbox/standard')
    setMapbox3d(settings.mapbox_3d_enabled !== false)
    setMapboxQuality(settings.mapbox_quality_mode === true)
    setDefaultLat(settings.default_lat || 48.8566)
    setDefaultLng(settings.default_lng || 2.3522)
    setDefaultZoom(settings.default_zoom || 10)
    // AMap keys: don't show global key values, only show user's own keys
    setAmapKeyGlobal(!!settings.amap_key_global)
    setAmapSecurityCodeGlobal(!!settings.amap_security_code_global)
    setAmapWebServiceKeyGlobal(!!settings.amap_web_service_key_global)
    // If user has their own keys (not from global), show them
    setAmapKey(settings.amap_key && !settings.amap_key_global ? settings.amap_key : '')
    setAmapSecurityCode(settings.amap_security_code && !settings.amap_security_code_global ? settings.amap_security_code : '')
    setAmapWebServiceKey(settings.amap_web_service_key && !settings.amap_web_service_key_global ? settings.amap_web_service_key : '')

    setSearchProvider((settings.search_provider as 'auto' | 'amap' | 'google') || 'auto')
  }, [settings])

  const handleMapClick = useCallback((mapInfo) => {
    setDefaultLat(mapInfo.latlng.lat)
    setDefaultLng(mapInfo.latlng.lng)
  }, [])

  const mapPlaces = useMemo((): Place[] => [{
    id: 1,
    trip_id: 1,
    name: 'Default map center',
    description: '',
    lat: defaultLat as number,
    lng: defaultLng as number,
    address: '',
    category_id: 0,
    icon: null,
    price: null,
    image_url: null,
    google_place_id: null,
    osm_id: null,
    route_geometry: null,
    place_time: null,
    end_time: null,
    created_at: Date(),
  }], [defaultLat, defaultLng])

  const saveMapSettings = async (): Promise<void> => {
    setSaving(true)
    try {
      await updateSettings({
        map_provider: provider,
        search_provider: searchProvider,
        map_tile_url: mapTileUrl,
        mapbox_access_token: mapboxToken,
        mapbox_style: mapboxStyle,
        mapbox_3d_enabled: mapbox3d,
        mapbox_quality_mode: mapboxQuality,
        amap_key: amapKey,
        amap_security_code: amapSecurityCode,
        amap_web_service_key: amapWebServiceKey,
        default_lat: parseFloat(String(defaultLat)),
        default_lng: parseFloat(String(defaultLng)),
        default_zoom: parseInt(String(defaultZoom)),
      })
      toast.success(t('settings.toast.mapSaved'))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  // 3D is available on every style now — pure satellite uses the
  // mapbox-streets-v8 tileset as a fallback building source.
  const supports3d = true

  return (
    <Section title={t('settings.map')} icon={Map}>
      {/* Provider picker — big cards so the choice is obvious */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">{t('settings.mapProvider')}</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setProvider('leaflet')}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
              provider === 'leaflet'
                ? 'border-slate-900 bg-slate-50 dark:bg-slate-800 dark:border-slate-200'
                : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
            }`}
          >
            <Layers size={18} className="mt-0.5 flex-shrink-0 text-slate-700 dark:text-slate-300" />
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Leaflet</div>
              <div className="hidden sm:block text-xs text-slate-500 mt-0.5">{t('settings.mapLeafletSubtitle')}</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setProvider('mapbox-gl')}
            className={`relative flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
              provider === 'mapbox-gl'
                ? 'border-slate-900 bg-slate-50 dark:bg-slate-800 dark:border-slate-200'
                : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
            }`}
          >
            <Box size={18} className="mt-0.5 flex-shrink-0 text-slate-700 dark:text-slate-300" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                <span className="sm:hidden">Mapbox</span>
                <span className="hidden sm:inline">Mapbox GL</span>
              </div>
              <div className="hidden sm:block text-xs text-slate-500 mt-0.5">{t('settings.mapMapboxSubtitle')}</div>
            </div>
            {/* Experimental badge only on ≥sm; on mobile there's no room next to the title. */}
            <span className="hidden sm:inline-block absolute top-2 right-2 text-[9px] font-semibold tracking-wide uppercase px-1.5 py-[3px] rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 leading-none">
              {t('settings.mapExperimental')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setProvider('amap')}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
              provider === 'amap'
                ? 'border-slate-900 bg-slate-50 dark:bg-slate-800 dark:border-slate-200'
                : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
            }`}
          >
            <Map size={18} className="mt-0.5 flex-shrink-0 text-slate-700 dark:text-slate-300" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                <span className="sm:hidden">高德地图</span>
                <span className="hidden sm:inline">AMap 高德地图</span>
              </div>
              <div className="hidden sm:block text-xs text-slate-500 mt-0.5">国内地图服务，无需代理</div>
            </div>
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          {t('settings.mapProviderHint')}
        </p>
      </div>

      {/* Leaflet settings */}
      {provider === 'leaflet' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('settings.mapTemplate')}</label>
          <CustomSelect
            value={mapTileUrl}
            onChange={(value: string) => { if (value) setMapTileUrl(value) }}
            placeholder={t('settings.mapTemplatePlaceholder.select')}
            options={MAP_PRESETS.map(p => ({ value: p.url, label: p.name }))}
            size="sm"
            style={{ marginBottom: 8 }}
          />
          <input
            type="text"
            value={mapTileUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMapTileUrl(e.target.value)}
            placeholder="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
          <p className="text-xs text-slate-400 mt-1">{t('settings.mapDefaultHint')}</p>
        </div>
      )}

      {/* Mapbox GL settings */}
      {provider === 'mapbox-gl' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('settings.mapMapboxToken')}</label>
            <input
              type="text"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
              placeholder="pk.eyJ1Ijoi..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            />
            <p className="text-xs text-slate-400 mt-1">
              {t('settings.mapMapboxTokenHint')}{' '}
              <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noreferrer" className="underline">
                {t('settings.mapMapboxTokenLink')}
              </a>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('settings.mapStyle')}</label>
            <div className="mb-2">
              <StyleDropdown value={mapboxStyle} onChange={setMapboxStyle} />
            </div>
            <input
              type="text"
              value={mapboxStyle}
              onChange={(e) => setMapboxStyle(e.target.value)}
              placeholder="mapbox://styles/mapbox/standard"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            />
            <p className="text-xs text-slate-400 mt-1">
              {t('settings.mapStyleHint')}
            </p>
          </div>

          <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
            supports3d
              ? 'border-slate-200 dark:border-slate-700'
              : 'border-slate-200 opacity-60 dark:border-slate-700'
          }`}>
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900 dark:text-white">{t('settings.map3dBuildings')}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {t('settings.map3dHint')}
              </div>
            </div>
            <ToggleSwitch
              on={mapbox3d && supports3d}
              onToggle={() => { if (supports3d) setMapbox3d(!mapbox3d) }}
            />
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900 dark:text-white flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                <span className="order-2 sm:order-1">{t('settings.mapHighQuality')}</span>
                <span className="order-1 sm:order-2 text-[9px] font-semibold tracking-wide uppercase px-1.5 py-[3px] rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 leading-none">
                  {t('settings.mapExperimental')}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {t('settings.mapHighQualityHint')}{' '}
                <span className="text-amber-600 dark:text-amber-400">{t('settings.mapHighQualityWarning')}</span>
              </div>
            </div>
            <ToggleSwitch on={mapboxQuality} onToggle={() => setMapboxQuality(!mapboxQuality)} />
          </div>

          <div className="text-xs text-slate-400 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <strong className="text-slate-600 dark:text-slate-300">{t('settings.mapTipLabel')}</strong> {t('settings.mapTip')}
          </div>
        </div>
      )}

      {/* AMap 高德地图 settings */}
      {provider === 'amap' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">API Key</label>
            <input
              type="text"
              value={amapKey}
              onChange={(e) => setAmapKey(e.target.value)}
              placeholder={amapKeyGlobal ? '已使用全局配置，输入自定义 Key 可覆盖' : '在高德开放平台申请的 Key'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            />
            {amapKeyGlobal && !amapKey && (
              <p className="text-xs text-emerald-600 mt-1">已使用全局配置</p>
            )}
            {amapKey && (
              <button
                onClick={() => setAmapKey('')}
                className="text-xs text-slate-400 mt-1 hover:text-slate-600 underline"
              >
                清除个人配置（回退到全局）
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">安全密钥</label>
            <input
              type="text"
              value={amapSecurityCode}
              onChange={(e) => setAmapSecurityCode(e.target.value)}
              placeholder={amapSecurityCodeGlobal ? '已使用全局配置，输入自定义密钥可覆盖' : '安全密钥 (JS API 2.0 必填)'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            />
            {amapSecurityCodeGlobal && !amapSecurityCode && (
              <p className="text-xs text-emerald-600 mt-1">已使用全局配置</p>
            )}
            {amapSecurityCode && (
              <button
                onClick={() => setAmapSecurityCode('')}
                className="text-xs text-slate-400 mt-1 hover:text-slate-600 underline"
              >
                清除个人配置（回退到全局）
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Web服务 Key</label>
            <input
              type="text"
              value={amapWebServiceKey}
              onChange={(e) => setAmapWebServiceKey(e.target.value)}
              placeholder={amapWebServiceKeyGlobal ? '已使用全局配置，输入自定义 Key 可覆盖' : '后端搜索/地理编码专用 Key（服务平台选「Web服务」）'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            />
            {amapWebServiceKeyGlobal && !amapWebServiceKey && (
              <p className="text-xs text-emerald-600 mt-1">已使用全局配置</p>
            )}
            {amapWebServiceKey && (
              <button
                onClick={() => setAmapWebServiceKey('')}
                className="text-xs text-slate-400 mt-1 hover:text-slate-600 underline"
              >
                清除个人配置（回退到全局）
              </button>
            )}
            <p className="text-xs text-slate-400 mt-1">
              用于后端 POI 搜索、逆地理编码、输入提示等 HTTP API。需在控制台单独创建一个「Web服务」类型的 Key。
            </p>
          </div>

          <div className="text-xs text-slate-400 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <strong className="text-slate-600 dark:text-slate-300">提示：</strong> 管理员已在管理页配置全局高德地图 Key，所有用户可直接使用。如需使用自己的 Key，在上方输入后保存即可覆盖全局配置。如需申请 Key 和密钥，请前往{' '}
            <a href="https://lbs.amap.com/" target="_blank" rel="noreferrer" className="underline text-blue-500 hover:text-blue-600">
              高德开放平台
            </a>
            {' '}注册。高德地图使用 GCJ-02 坐标系，系统会自动将 WGS-84 坐标转换为 GCJ-02，无需手动处理。
          </div>
        </div>
      )}

      {/* 搜索服务提供商 — applies regardless of map provider */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">搜索服务</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setSearchProvider('auto')}
            className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-colors ${
              searchProvider === 'auto'
                ? 'border-slate-900 bg-slate-50 dark:bg-slate-800 dark:border-slate-200'
                : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
            }`}
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-white">自动</div>
              <div className="text-xs text-slate-500 mt-0.5">中文用高德，其他用 Google</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSearchProvider('amap')}
            className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-colors ${
              searchProvider === 'amap'
                ? 'border-slate-900 bg-slate-50 dark:bg-slate-800 dark:border-slate-200'
                : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
            }`}
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-white">高德搜索</div>
              <div className="text-xs text-slate-500 mt-0.5">始终使用高德 POI 搜索</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSearchProvider('google')}
            className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-colors ${
              searchProvider === 'google'
                ? 'border-slate-900 bg-slate-50 dark:bg-slate-800 dark:border-slate-200'
                : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
            }`}
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-white">Google / OSM</div>
              <div className="text-xs text-slate-500 mt-0.5">始终使用 Google 或 OSM</div>
            </div>
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          选择地点搜索使用的服务。「自动」模式下输入中文自动使用高德，输入其他语言使用 Google/OSM。国内环境建议选择「高德搜索」。
        </p>
      </div>

      {/* Default map position — applies regardless of provider */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('settings.latitude')}</label>
          <input
            type="number"
            step="any"
            value={defaultLat}
            onChange={(e) => setDefaultLat(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('settings.longitude')}</label>
          <input
            type="number"
            step="any"
            value={defaultLng}
            onChange={(e) => setDefaultLng(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <div style={{ position: 'relative', inset: 0, height: '200px', width: '100%' }}>
          {provider === 'mapbox-gl' ? (
            <MapboxPreview
              token={mapboxToken}
              style={mapboxStyle}
              lat={parseFloat(String(defaultLat)) || 48.8566}
              lng={parseFloat(String(defaultLng)) || 2.3522}
              // Zoom in close so the style's character (3D buildings,
              // satellite texture, label density) is immediately visible.
              zoom={Math.max(parseInt(String(defaultZoom)) || 10, 16)}
              enable3d={mapbox3d && supports3d}
              quality={mapboxQuality}
              onClick={(ll) => { setDefaultLat(ll.lat); setDefaultLng(ll.lng) }}
            />
          ) : provider === 'amap' ? (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            React.createElement(MapViewAMap as any, {
              places: mapPlaces,
              dayPlaces: [],
              route: null,
              routeSegments: null,
              selectedPlaceId: null,
              onMarkerClick: null,
              onMapClick: handleMapClick,
              onMapContextMenu: null,
              center: [settings.default_lat, settings.default_lng],
              zoom: defaultZoom,
              tileUrl: mapTileUrl,
              fitKey: null,
              dayOrderMap: [],
              leftWidth: 0,
              rightWidth: 0,
              hasInspector: false,
            })
          ) : (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            React.createElement(MapView as any, {
              places: mapPlaces,
              dayPlaces: [],
              route: null,
              routeSegments: null,
              selectedPlaceId: null,
              onMarkerClick: null,
              onMapClick: handleMapClick,
              onMapContextMenu: null,
              center: [settings.default_lat, settings.default_lng],
              zoom: defaultZoom,
              tileUrl: mapTileUrl,
              fitKey: null,
              dayOrderMap: [],
              leftWidth: 0,
              rightWidth: 0,
              hasInspector: false,
            })
          )}
        </div>
      </div>

      <button
        onClick={saveMapSettings}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-700 disabled:bg-slate-400"
      >
        {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
        {t('settings.saveMap')}
      </button>
    </Section>
  )
}
