import { db } from '../db/database';
import { decrypt_api_key } from './apiKeyCrypto';
import { checkSsrf } from '../utils/ssrfGuard';
import { getAppUrl } from './notifications';

// ── Google API call counter ───────────────────────────────────────────────────

let googleApiCallCount = 0;

export function getGoogleApiCallCount(): number { return googleApiCallCount; }
export function resetGoogleApiCallCount(): void { googleApiCallCount = 0; }

function googleFetch(endpoint: string, label: string, init?: RequestInit): Promise<Response> {
  googleApiCallCount++;
  console.debug(`[Google API] #${googleApiCallCount} ${label} → ${endpoint}`);
  const referer = process.env.APP_URL ? getAppUrl() : undefined;
  return fetch(endpoint, {
    ...init,
    headers: { ...(referer ? { Referer: referer } : {}), ...(init?.headers as Record<string, string> ?? {}) },
  });
}

// ── Interfaces ───────────────────────────────────────────────────────────────

interface NominatimResult {
  osm_type: string;
  osm_id: string;
  name?: string;
  display_name?: string;
  lat: string;
  lon: string;
}

interface OverpassElement {
  tags?: Record<string, string>;
}

interface WikiCommonsPage {
  imageinfo?: { url?: string; extmetadata?: { Artist?: { value?: string } } }[];
}

interface GooglePlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  types?: string[];
}

interface GoogleAutocompleteSuggestion {
  placePrediction?: {
    placeId: string;
    structuredFormat?: {
      mainText?: { text: string };
      secondaryText?: { text: string };
    };
  };
}

interface AmapPoi {
  id: string
  name: string
  type?: string
  address?: string
  location?: string  // "lng,lat" format (GCJ-02)
  pname?: string     // province
  cityname?: string  // city
  adname?: string    // district
  tel?: string
  website?: string
  photos?: { url?: string }[]
  biz_ext?: { rating?: string; cost?: string }
}

interface GooglePlaceDetails extends GooglePlaceResult {
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
  googleMapsUri?: string;
  editorialSummary?: { text: string };
  reviews?: { authorAttribution?: { displayName?: string; photoUri?: string }; rating?: number; text?: { text?: string }; relativePublishTimeDescription?: string }[];
  photos?: { name: string; authorAttributions?: { displayName?: string }[] }[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const UA = 'TREK Travel Planner (https://github.com/mauriceboe/TREK)';

// ── Photo cache (disk-backed) ────────────────────────────────────────────────
import * as placePhotoCache from './placePhotoCache';

// ── Concurrency limiter for outbound photo fetches ───────────────────────────
// Caps simultaneous Wikimedia/Google photo requests so a bulk import of hundreds
// of places cannot monopolise the event loop or trigger external API rate limits.
const MAX_CONCURRENT_PHOTO_FETCHES = 5;
let photoFetchActive = 0;
const photoFetchQueue: Array<() => void> = [];

function acquirePhotoFetchSlot(): Promise<void> {
  if (photoFetchActive < MAX_CONCURRENT_PHOTO_FETCHES) {
    photoFetchActive++;
    return Promise.resolve();
  }
  return new Promise(resolve => photoFetchQueue.push(resolve));
}

function releasePhotoFetchSlot(): void {
  const next = photoFetchQueue.shift();
  if (next) {
    next();
  } else {
    photoFetchActive--;
  }
}

// ── API key retrieval ────────────────────────────────────────────────────────

export function getMapsKey(userId: number): string | null {
  const user = db.prepare('SELECT maps_api_key FROM users WHERE id = ?').get(userId) as { maps_api_key: string | null } | undefined;
  const user_key = decrypt_api_key(user?.maps_api_key);
  if (user_key) return user_key;
  const admin = db.prepare("SELECT maps_api_key FROM users WHERE role = 'admin' AND maps_api_key IS NOT NULL AND maps_api_key != '' LIMIT 1").get() as { maps_api_key: string } | undefined;
  return decrypt_api_key(admin?.maps_api_key) || null;
}

export function getAmapKey(userId?: number): string | null {
  // 1. 优先从 app_settings 读取 Web Service Key（全局配置）
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'amap_web_service_key'").get() as { value: string } | undefined
  if (row?.value) return row.value
  // 2. 回退到用户级别的 Web Service Key
  if (userId) {
    const userRow = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'amap_web_service_key'").get(userId) as { value: string } | undefined
    if (userRow?.value) return userRow.value
  }
  // 3. 最后回退：尝试 amap_key（JS API Key，部分用户可能只配置了这一个）
  const jsKeyRow = db.prepare("SELECT value FROM app_settings WHERE key = 'amap_key'").get() as { value: string } | undefined
  if (jsKeyRow?.value) return jsKeyRow.value
  if (userId) {
    const userJsKeyRow = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'amap_key'").get(userId) as { value: string } | undefined
    if (userJsKeyRow?.value) return userJsKeyRow.value
  }
  return null
}

// ── Nominatim search ─────────────────────────────────────────────────────────

export async function searchNominatim(query: string, lang?: string) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: '10',
    'accept-language': lang || 'en',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': UA },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Nominatim API error: ${response.status} ${response.statusText}${text ? ' - ' + text.substring(0, 200) : ''}`);
  }
  const data = await response.json() as NominatimResult[];
  return data.map(item => ({
    google_place_id: null,
    osm_id: `${item.osm_type}:${item.osm_id}`,
    name: item.name || item.display_name?.split(',')[0] || '',
    address: item.display_name || '',
    lat: parseFloat(item.lat) || null,
    lng: parseFloat(item.lon) || null,
    rating: null,
    website: null,
    phone: null,
    source: 'openstreetmap',
  }));
}

// ── Nominatim lookup (by OSM ID) ────────────────────────────────────────────

export async function lookupNominatim(osmType: string, osmId: string, lang?: string): Promise<{
  name: string; address: string; lat: number | null; lng: number | null;
} | null> {
  const typePrefix = osmType.charAt(0).toUpperCase(); // N, W, R
  const params = new URLSearchParams({
    osm_ids: `${typePrefix}${osmId}`,
    format: 'json',
    'accept-language': lang || 'en',
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/lookup?${params}`, {
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) return null;
    const data = await res.json() as NominatimResult[];
    const item = data[0];
    if (!item) return null;
    return {
      name: item.name || item.display_name?.split(',')[0] || '',
      address: item.display_name || '',
      lat: parseFloat(item.lat) || null,
      lng: parseFloat(item.lon) || null,
    };
  } catch { return null; }
}

// ── Overpass API (OSM details) ───────────────────────────────────────────────

export async function fetchOverpassDetails(osmType: string, osmId: string): Promise<OverpassElement | null> {
  const typeMap: Record<string, string> = { node: 'node', way: 'way', relation: 'rel' };
  const oType = typeMap[osmType];
  if (!oType) return null;
  const query = `[out:json][timeout:5];${oType}(${osmId});out tags;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) return null;
    const data = await res.json() as { elements?: OverpassElement[] };
    return data.elements?.[0] || null;
  } catch { return null; }
}

// ── Opening hours parsing ────────────────────────────────────────────────────

export function parseOpeningHours(ohString: string): { weekdayDescriptions: string[]; openNow: boolean | null } {
  const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const result: string[] = LONG.map(d => `${d}: ?`);

  // Parse segments like "Mo-Fr 09:00-18:00; Sa 10:00-14:00"
  for (const segment of ohString.split(';')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+(.+)$/i);
    if (!match) continue;
    const [, daysPart, timePart] = match;
    const dayIndices = new Set<number>();
    for (const range of daysPart.split(',')) {
      const parts = range.trim().split('-').map(d => DAYS.indexOf(d.trim()));
      if (parts.length === 2 && parts[0] >= 0 && parts[1] >= 0) {
        for (let i = parts[0]; i !== (parts[1] + 1) % 7; i = (i + 1) % 7) dayIndices.add(i);
        dayIndices.add(parts[1]);
      } else if (parts[0] >= 0) {
        dayIndices.add(parts[0]);
      }
    }
    for (const idx of dayIndices) {
      result[idx] = `${LONG[idx]}: ${timePart.trim()}`;
    }
  }

  // Compute openNow
  let openNow: boolean | null = null;
  try {
    const now = new Date();
    const jsDay = now.getDay();
    const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
    const todayLine = result[dayIdx];
    const timeRanges = [...todayLine.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)];
    if (timeRanges.length > 0) {
      const nowMins = now.getHours() * 60 + now.getMinutes();
      openNow = timeRanges.some(m => {
        const start = parseInt(m[1]) * 60 + parseInt(m[2]);
        const end = parseInt(m[3]) * 60 + parseInt(m[4]);
        return end > start ? nowMins >= start && nowMins < end : nowMins >= start || nowMins < end;
      });
    }
  } catch { /* best effort */ }

  return { weekdayDescriptions: result, openNow };
}

// ── Build standardized OSM details ───────────────────────────────────────────

export function buildOsmDetails(tags: Record<string, string>, osmType: string, osmId: string) {
  let opening_hours: string[] | null = null;
  let open_now: boolean | null = null;
  if (tags.opening_hours) {
    const parsed = parseOpeningHours(tags.opening_hours);
    const hasData = parsed.weekdayDescriptions.some(line => !line.endsWith('?'));
    if (hasData) {
      opening_hours = parsed.weekdayDescriptions;
      open_now = parsed.openNow;
    }
  }
  return {
    website: tags['contact:website'] || tags.website || null,
    phone: tags['contact:phone'] || tags.phone || null,
    opening_hours,
    open_now,
    osm_url: `https://www.openstreetmap.org/${osmType}/${osmId}`,
    summary: tags.description || null,
    source: 'openstreetmap' as const,
  };
}

// ── Wikimedia Commons photo lookup ───────────────────────────────────────────

export async function fetchWikimediaPhoto(lat: number, lng: number, name?: string): Promise<{ photoUrl: string; attribution: string | null } | null> {
  // Strategy 1: Search Wikipedia for the place name -> get the article image
  if (name) {
    try {
      const searchParams = new URLSearchParams({
        action: 'query', format: 'json',
        titles: name,
        prop: 'pageimages',
        piprop: 'thumbnail',
        pithumbsize: '400',
        pilimit: '1',
        redirects: '1',
      });
      const res = await fetch(`https://en.wikipedia.org/w/api.php?${searchParams}`, { headers: { 'User-Agent': UA } });
      if (res.ok) {
        const data = await res.json() as { query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } };
        const pages = data.query?.pages;
        if (pages) {
          for (const page of Object.values(pages)) {
            if (page.thumbnail?.source) {
              return { photoUrl: page.thumbnail.source, attribution: 'Wikipedia' };
            }
          }
        }
      }
    } catch { /* fall through to geosearch */ }
  }

  // Strategy 2: Wikimedia Commons geosearch by coordinates
  const params = new URLSearchParams({
    action: 'query', format: 'json',
    generator: 'geosearch',
    ggsprimary: 'all',
    ggsnamespace: '6',
    ggsradius: '300',
    ggscoord: `${lat}|${lng}`,
    ggslimit: '5',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: '400',
  });
  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const data = await res.json() as { query?: { pages?: Record<string, WikiCommonsPage & { imageinfo?: { mime?: string }[] }> } };
    const pages = data.query?.pages;
    if (!pages) return null;
    for (const page of Object.values(pages)) {
      const info = page.imageinfo?.[0];
      // Only use actual photos (JPEG/PNG), skip SVGs and PDFs
      const mime = (info as { mime?: string })?.mime || '';
      if (info?.url && (mime.startsWith('image/jpeg') || mime.startsWith('image/png'))) {
        const attribution = info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').trim() || null;
        return { photoUrl: info.url, attribution };
      }
    }
    return null;
  } catch { return null; }
}

// ── Search places (Google or Nominatim fallback) ─────────────────────────────

export async function searchPlaces(userId: number, query: string, lang?: string): Promise<{ places: Record<string, unknown>[]; source: string }> {
  const apiKey = getMapsKey(userId);
  const amapKey = getAmapKey(userId);

  // Prefer AMap when key is available (better for China)
  if (amapKey) {
    return searchAmap(query, undefined, lang, userId);
  }

  if (!apiKey) {
    const places = await searchNominatim(query, lang);
    return { places, source: 'openstreetmap' };
  }

  const response = await googleFetch('https://places.googleapis.com/v1/places:searchText', 'searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.websiteUri,places.nationalPhoneNumber,places.types',
    },
    body: JSON.stringify({ textQuery: query, languageCode: lang || 'en' }),
  });

  const data = await response.json() as { places?: GooglePlaceResult[]; error?: { message?: string } };

  if (!response.ok) {
    const err = new Error(data.error?.message || 'Google Places API error') as Error & { status: number };
    err.status = response.status;
    throw err;
  }

  const places = (data.places || []).map((p: GooglePlaceResult) => ({
    google_place_id: p.id,
    name: p.displayName?.text || '',
    address: p.formattedAddress || '',
    lat: p.location?.latitude || null,
    lng: p.location?.longitude || null,
    rating: p.rating || null,
    website: p.websiteUri || null,
    phone: p.nationalPhoneNumber || null,
    source: 'google',
  }));

  return { places, source: 'google' };
}

// ── Autocomplete (Google or Nominatim fallback) ─────────────────────────────

export async function autocompletePlaces(
  userId: number,
  input: string,
  lang?: string,
  locationBias?: { low: { lat: number; lng: number }; high: { lat: number; lng: number } },
): Promise<{ suggestions: { placeId: string; mainText: string; secondaryText: string; lat?: number; lng?: number; address?: string }[]; source: string }> {
  const apiKey = getMapsKey(userId);
  const amapKey = getAmapKey(userId);

  // Prefer AMap when key is available (better for China)
  if (amapKey) {
    return autocompleteAmap(input, undefined, userId);
  }

  if (!apiKey) {
    return autocompleteNominatim(input, lang);
  }

  const body: Record<string, unknown> = {
    input,
    languageCode: lang || 'en',
  };
  if (locationBias) {
    body.locationBias = {
      rectangle: {
        low: { latitude: locationBias.low.lat, longitude: locationBias.low.lng },
        high: { latitude: locationBias.high.lat, longitude: locationBias.high.lng },
      },
    };
  }

  const response = await googleFetch('https://places.googleapis.com/v1/places:autocomplete', 'autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json() as { suggestions?: GoogleAutocompleteSuggestion[]; error?: { message?: string } };

  if (!response.ok) {
    const err = new Error(data.error?.message || 'Google Places Autocomplete error') as Error & { status: number };
    err.status = response.status;
    throw err;
  }

  const suggestions = (data.suggestions || [])
    .filter((s) => s.placePrediction)
    .slice(0, 5)
    .map((s) => ({
      placeId: s.placePrediction!.placeId,
      mainText: s.placePrediction!.structuredFormat?.mainText?.text || '',
      secondaryText: s.placePrediction!.structuredFormat?.secondaryText?.text || '',
    }));

  return { suggestions, source: 'google' };
}

async function autocompleteNominatim(
  input: string,
  lang?: string,
): Promise<{ suggestions: { placeId: string; mainText: string; secondaryText: string }[]; source: string }> {
  try {
    const places = await searchNominatim(input, lang);
    const suggestions = places
      .filter((p) => p.osm_id && p.osm_id.includes(':') && p.osm_id.split(':')[1] !== '')
      .slice(0, 5)
      .map((p) => {
        const parts = (p.address || '').split(',').map((s) => s.trim());
        return {
          placeId: p.osm_id,
          mainText: p.name || parts[0] || '',
          secondaryText: parts.slice(1).join(', '),
        };
      });
    return { suggestions, source: 'nominatim' };
  } catch (err) {
    console.error('Nominatim autocomplete failed:', err);
    return { suggestions: [], source: 'nominatim' };
  }
}

// ── Place details (Google or OSM) ────────────────────────────────────────────

export async function getPlaceDetails(userId: number, placeId: string, lang?: string): Promise<{ place: Record<string, unknown> }> {
  // AMap POI details: placeId is "amap:BVXXX..."
  if (placeId.startsWith('amap:')) {
    const amapId = placeId.slice(5);
    const amapKey = getAmapKey(userId);
    if (!amapKey) throw Object.assign(new Error('AMap API key not configured'), { status: 400 });
    const params = new URLSearchParams({ key: amapKey, id: amapId, output: 'JSON', extensions: 'all' });
    const response = await fetch(`https://restapi.amap.com/v3/place/detail?${params}`);
    if (!response.ok) throw new Error('AMap POI detail API error');
    const data = await response.json() as { status: string; pois?: AmapPoi[]; info?: string };
    if (data.status !== '1' || !data.pois?.[0]) throw new Error(data.info || 'AMap POI not found');
    const poi = data.pois[0];
    const [lngStr, latStr] = (poi.location || ',').split(',');
    const rawLng = parseFloat(lngStr) || null;
    const rawLat = parseFloat(latStr) || null;
    const [wgsLng, wgsLat] = rawLng && rawLat ? routeGcj02ToWgs84(rawLng, rawLat) : [rawLng, rawLat];
    return {
      place: {
        google_place_id: null,
        osm_id: placeId,
        name: poi.name || '',
        address: [poi.pname, poi.cityname, poi.adname, poi.address].filter(Boolean).join('') || '',
        lat: wgsLat,
        lng: wgsLng,
        rating: poi.biz_ext?.rating ? parseFloat(poi.biz_ext.rating) : null,
        rating_count: null,
        website: poi.website || null,
        phone: (Array.isArray(poi.tel) ? poi.tel.join(',') : poi.tel) || null,
        opening_hours: poi.biz_ext?.open_time ? [poi.biz_ext.open_time] : null,
        open_now: null,
        google_maps_url: null,
        category: poi.type || null,
        amap_typecode: poi.typecode || null,
        summary: poi.type || null,
        reviews: [],
        source: 'amap',
        cached_at: Date.now(),
      },
    };
  }

  // OSM details: placeId is "node:123456" or "way:123456" etc.
  if (placeId.includes(':')) {
    const [osmType, osmId] = placeId.split(':');
    const element = await fetchOverpassDetails(osmType, osmId);
    const details = buildOsmDetails(element?.tags || {}, osmType, osmId);

    // Fetch Nominatim only when Overpass lacks coordinates or address
    const d = details as Record<string, unknown>;
    const needsNominatim = !d.lat || !d.lng || !d.address;
    const nominatim = needsNominatim ? await lookupNominatim(osmType, osmId, lang) : null;

    return {
      place: {
        ...details,
        name: (d.name as string) || nominatim?.name || element?.tags?.name || '',
        address: (d.address as string) || nominatim?.address || '',
        lat: d.lat ?? nominatim?.lat ?? null,
        lng: d.lng ?? nominatim?.lng ?? null,
        osm_id: placeId,
      },
    };
  }

  // Google details
  const langKey = lang || 'de';
  const apiKey = getMapsKey(userId);
  if (!apiKey) {
    throw Object.assign(new Error('Google Maps API key not configured'), { status: 400 });
  }

  // Check DB cache first (lean mask, expanded=0) — 7-day TTL
  const DETAILS_TTL = 7 * 24 * 60 * 60 * 1000;
  const cached = db.prepare(
    'SELECT payload_json, fetched_at FROM place_details_cache WHERE place_id = ? AND lang = ? AND expanded = 0'
  ).get(placeId, langKey) as { payload_json: string; fetched_at: number } | undefined;
  if (cached && Date.now() - cached.fetched_at < DETAILS_TTL) return { place: JSON.parse(cached.payload_json) };

  const response = await googleFetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=${langKey}`, `getPlaceDetails(${placeId})`, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,userRatingCount,websiteUri,nationalPhoneNumber,regularOpeningHours,googleMapsUri',
    },
  });

  const data = await response.json() as GooglePlaceDetails & { error?: { message?: string } };

  if (!response.ok) {
    const err = new Error(data.error?.message || 'Google Places API error') as Error & { status: number };
    err.status = response.status;
    throw err;
  }

  const place = {
    google_place_id: data.id,
    name: data.displayName?.text || '',
    address: data.formattedAddress || '',
    lat: data.location?.latitude || null,
    lng: data.location?.longitude || null,
    rating: data.rating || null,
    rating_count: data.userRatingCount || null,
    website: data.websiteUri || null,
    phone: data.nationalPhoneNumber || null,
    opening_hours: data.regularOpeningHours?.weekdayDescriptions || null,
    open_now: data.regularOpeningHours?.openNow ?? null,
    google_maps_url: data.googleMapsUri || null,
    summary: null,
    reviews: [],
    source: 'google' as const,
    cached_at: Date.now(),
  };

  try {
    db.prepare(
      'INSERT OR REPLACE INTO place_details_cache (place_id, lang, expanded, payload_json, fetched_at) VALUES (?, ?, 0, ?, ?)'
    ).run(placeId, langKey, JSON.stringify(place), Date.now());
  } catch (dbErr) {
    console.error('Failed to cache place details:', dbErr);
  }

  return { place };
}

export async function getPlaceDetailsExpanded(userId: number, placeId: string, lang?: string, refresh = false): Promise<{ place: Record<string, unknown> }> {
  // AMap: expanded details use the same POI detail API (already returns rich info)
  if (placeId.startsWith('amap:')) {
    return getPlaceDetails(userId, placeId, lang);
  }

  const langKey = lang || 'de';
  const apiKey = getMapsKey(userId);
  if (!apiKey) throw Object.assign(new Error('Google Maps API key not configured'), { status: 400 });

  // Check DB cache for expanded result
  if (!refresh) {
    const cached = db.prepare(
      'SELECT payload_json FROM place_details_cache WHERE place_id = ? AND lang = ? AND expanded = 1'
    ).get(placeId, langKey) as { payload_json: string } | undefined;
    if (cached) return { place: JSON.parse(cached.payload_json) };
  }

  const response = await googleFetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=${langKey}`, `getPlaceDetailsExpanded(${placeId})`, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,userRatingCount,websiteUri,nationalPhoneNumber,regularOpeningHours,googleMapsUri,reviews,editorialSummary',
    },
  });

  const data = await response.json() as GooglePlaceDetails & { error?: { message?: string } };

  if (!response.ok) {
    const err = new Error(data.error?.message || 'Google Places API error') as Error & { status: number };
    err.status = response.status;
    throw err;
  }

  const place = {
    google_place_id: data.id,
    name: data.displayName?.text || '',
    address: data.formattedAddress || '',
    lat: data.location?.latitude || null,
    lng: data.location?.longitude || null,
    rating: data.rating || null,
    rating_count: data.userRatingCount || null,
    website: data.websiteUri || null,
    phone: data.nationalPhoneNumber || null,
    opening_hours: data.regularOpeningHours?.weekdayDescriptions || null,
    open_now: data.regularOpeningHours?.openNow ?? null,
    google_maps_url: data.googleMapsUri || null,
    summary: data.editorialSummary?.text || null,
    reviews: (data.reviews || []).slice(0, 5).map((r: NonNullable<GooglePlaceDetails['reviews']>[number]) => ({
      author: r.authorAttribution?.displayName || null,
      rating: r.rating || null,
      text: r.text?.text || null,
      time: r.relativePublishTimeDescription || null,
      photo: r.authorAttribution?.photoUri || null,
    })),
    source: 'google' as const,
    cached_at: Date.now(),
  };

  try {
    db.prepare(
      'INSERT OR REPLACE INTO place_details_cache (place_id, lang, expanded, payload_json, fetched_at) VALUES (?, ?, 1, ?, ?)'
    ).run(placeId, langKey, JSON.stringify(place), Date.now());
  } catch (dbErr) {
    console.error('Failed to cache expanded place details:', dbErr);
  }

  return { place };
}

// ── Place photo (Google or Wikimedia, disk-cached) ────────────────────────────

export async function getPlacePhoto(
  userId: number,
  placeId: string,
  lat: number,
  lng: number,
  name?: string,
): Promise<{ photoUrl: string; attribution: string | null }> {
  // Disk cache hit — serve immediately, no Google call
  const diskHit = placePhotoCache.get(placeId);
  if (diskHit) return { photoUrl: diskHit.photoUrl, attribution: diskHit.attribution };

  // Recent error — don't hammer the API
  if (placePhotoCache.getErrored(placeId)) {
    throw Object.assign(new Error('(Cache) No photo available'), { status: 404 });
  }

  // Deduplicate concurrent requests for the same placeId
  const existing = placePhotoCache.getInFlight(placeId);
  if (existing) {
    const result = await existing;
    if (!result) throw Object.assign(new Error('(Cache) No photo available'), { status: 404 });
    return { photoUrl: `/api/maps/place-photo/${encodeURIComponent(placeId)}/bytes`, attribution: result.attribution };
  }

  const fetchPromise = (async (): Promise<{ filePath: string; attribution: string | null } | null> => {
    await acquirePhotoFetchSlot();
    try {
    const apiKey = getMapsKey(userId);
    const isCoordLookup = placeId.startsWith('coords:');
    const isAmapLookup = placeId.startsWith('amap:');

    // No Google key, coordinate-only, or AMap lookup → try AMap POI photo, then Wikimedia
    if (!apiKey || isCoordLookup || isAmapLookup) {
      if (!isNaN(lat) && !isNaN(lng)) {
        // AMap 地点：优先通过 AMap POI 详情 API 获取图片
        if (isAmapLookup) {
          const amapKey = getAmapKey(userId);
          const amapId = placeId.slice(5); // 去掉 "amap:" 前缀
          if (amapKey && amapId) {
            try {
              const detailParams = new URLSearchParams({
                key: amapKey, id: amapId, output: 'JSON', extensions: 'all',
              });
              const detailRes = await fetch(`https://restapi.amap.com/v3/place/detail?${detailParams}`);
              if (detailRes.ok) {
                const detailData = await detailRes.json() as { status: string; pois?: AmapPoi[] };
                if (detailData.status === '1' && detailData.pois?.[0]?.photos?.[0]?.url) {
                  const photoUrl = detailData.pois[0].photos[0].url;
                  const ssrf = await checkSsrf(photoUrl, true);
                  if (ssrf.allowed) {
                    const imgRes = await fetch(photoUrl);
                    if (imgRes.ok) {
                      const bytes = Buffer.from(await imgRes.arrayBuffer());
                      if (bytes.length > 100) {
                        const cached = await placePhotoCache.put(placeId, bytes, 'AMap');
                        return { filePath: cached.filePath, attribution: cached.attribution };
                      }
                    }
                  }
                }
              }
            } catch { /* fall through to Wikipedia */ }
          }
        }

        // AMap 地点：尝试中文维基百科
        if (isAmapLookup && name) {
          try {
            const searchParams = new URLSearchParams({
              action: 'query', format: 'json',
              titles: name,
              prop: 'pageimages',
              piprop: 'thumbnail',
              pithumbsize: '400',
              pilimit: '1',
              redirects: '1',
            });
            const res = await fetch(`https://zh.wikipedia.org/w/api.php?${searchParams}`, { headers: { 'User-Agent': UA } });
            if (res.ok) {
              const data = await res.json() as { query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } };
              const pages = data.query?.pages;
              if (pages) {
                for (const page of Object.values(pages)) {
                  if (page.thumbnail?.source) {
                    const ssrf = await checkSsrf(page.thumbnail.source, true);
                    if (ssrf.allowed) {
                      const imgRes = await fetch(page.thumbnail.source);
                      if (imgRes.ok) {
                        const bytes = Buffer.from(await imgRes.arrayBuffer());
                        const cached = await placePhotoCache.put(placeId, bytes, 'Wikipedia中文');
                        return { filePath: cached.filePath, attribution: cached.attribution };
                      }
                    }
                  }
                }
              }
            }
          } catch { /* fall through to English Wikipedia */ }
        }

        try {
          const wiki = await fetchWikimediaPhoto(lat, lng, name);
          if (wiki) {
            // Wikimedia photos: fetch bytes and cache to disk
            const ssrf = await checkSsrf(wiki.photoUrl, true);
            if (!ssrf.allowed) throw Object.assign(new Error('Photo URL blocked'), { status: 403 });
            const imgRes = await fetch(wiki.photoUrl);
            if (imgRes.ok) {
              const bytes = Buffer.from(await imgRes.arrayBuffer());
              const cached = await placePhotoCache.put(placeId, bytes, wiki.attribution);
              return { filePath: cached.filePath, attribution: cached.attribution };
            }
          }
        } catch { /* fall through */ }
      }
      placePhotoCache.markError(placeId);
      return null;
    }

    // Reject URL-shaped placeIds — legacy DBs may store raw photo URLs in image_url
    if (/^https?:\/\//i.test(placeId)) {
      placePhotoCache.markError(placeId);
      return null;
    }

    // Google Photos — fetch details to get photo name
    const detailsRes = await googleFetch(`https://places.googleapis.com/v1/places/${placeId}`, `getPlacePhoto/details(${placeId})`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'photos',
      },
    });
    const body = await detailsRes.text();
    if (!detailsRes.ok) {
      console.error('Google Places photo details error:', detailsRes.status, body.slice(0, 200));
      placePhotoCache.markError(placeId);
      return null;
    }
    let details: GooglePlaceDetails & { error?: { message?: string } };
    try { details = body ? JSON.parse(body) : { photos: [] }; }
    catch { placePhotoCache.markError(placeId); return null; }

    if (!details.photos?.length) {
      placePhotoCache.markError(placeId);
      return null;
    }

    const photo = details.photos[0];
    const photoName = photo.name;
    const attribution = photo.authorAttributions?.[0]?.displayName || null;

    // Fetch actual image bytes
    const mediaRes = await googleFetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400`,
      `getPlacePhoto/media(${placeId})`,
      { headers: { 'X-Goog-Api-Key': apiKey } }
    );

    if (!mediaRes.ok) {
      placePhotoCache.markError(placeId);
      return null;
    }

    const bytes = Buffer.from(await mediaRes.arrayBuffer());
    if (!bytes.length) {
      placePhotoCache.markError(placeId);
      return null;
    }

    const cached = await placePhotoCache.put(placeId, bytes, attribution);

    // Persist stable proxy URL to database
    try {
      db.prepare(
        'UPDATE places SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE google_place_id = ? AND (image_url IS NULL OR image_url = \'\')'
      ).run(cached.photoUrl, placeId);
    } catch (dbErr) {
      console.error('Failed to persist photo URL to database:', dbErr);
    }

    return { filePath: cached.filePath, attribution };
    } finally {
      releasePhotoFetchSlot();
    }
  })();

  placePhotoCache.setInFlight(placeId, fetchPromise);

  const result = await fetchPromise;
  if (!result) throw Object.assign(new Error('No photo available'), { status: 404 });
  return { photoUrl: `/api/maps/place-photo/${encodeURIComponent(placeId)}/bytes`, attribution: result.attribution };
}

// ── Reverse geocoding ────────────────────────────────────────────────────────

export async function reverseGeocode(lat: string, lng: string, lang?: string): Promise<{ name: string | null; address: string | null }> {
  const params = new URLSearchParams({
    lat, lon: lng, format: 'json', addressdetails: '1', zoom: '18',
    'accept-language': lang || 'en',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { 'User-Agent': UA },
  });
  if (!response.ok) return { name: null, address: null };
  const data = await response.json() as { name?: string; display_name?: string; address?: Record<string, string> };
  const addr = data.address || {};
  const name = data.name || addr.tourism || addr.amenity || addr.shop || addr.building || addr.road || null;
  return { name, address: data.display_name || null };
}

// ── AMap (高德地图) search ──────────────────────────────────────────────────

export async function searchAmap(query: string, city?: string, lang?: string, userId?: number): Promise<{ places: Record<string, unknown>[]; source: string }> {
  const amapKey = getAmapKey(userId)
  if (!amapKey) return { places: [], source: 'amap' }

  const params = new URLSearchParams({
    key: amapKey,
    keywords: query,
    output: 'JSON',
    offset: '10',
    extensions: 'all',
  })
  if (city) params.set('city', city)

  const response = await fetch(`https://restapi.amap.com/v3/place/text?${params}`)
  if (!response.ok) throw new Error('AMap search API error')
  const data = await response.json() as { status: string; pois?: AmapPoi[]; info?: string }
  if (data.status !== '1') {
    console.warn('[AMap] search API error:', data.status, data.info, 'key:', amapKey ? `${amapKey.slice(0, 4)}****` : 'null', 'query:', query)
    return { places: [], source: 'amap' }
  }

  const places = (data.pois || []).map(poi => {
    const [lngStr, latStr] = (poi.location || ',').split(',')
    const rawLng = parseFloat(lngStr) || null
    const rawLat = parseFloat(latStr) || null
    const [wgsLng, wgsLat] = rawLng && rawLat ? routeGcj02ToWgs84(rawLng, rawLat) : [rawLng, rawLat]
    return {
      google_place_id: null,
      osm_id: `amap:${poi.id}`,
      name: poi.name || '',
      address: [poi.pname, poi.cityname, poi.adname, poi.address].filter(Boolean).join('') || '',
      lat: wgsLat,
      lng: wgsLng,
      rating: poi.biz_ext?.rating ? parseFloat(poi.biz_ext.rating) : null,
      website: poi.website || null,
      phone: (Array.isArray(poi.tel) ? poi.tel.join(',') : poi.tel) || null,
      category: poi.type || null,
      amap_typecode: poi.typecode || null,
      photo_url: poi.photos?.[0]?.url || null,
      source: 'amap',
    }
  })
  return { places, source: 'amap' }
}

export async function reverseGeocodeAmap(lat: string, lng: string, userId?: number): Promise<{ name: string | null; address: string | null; city: string | null; poiId: string | null; poiName: string | null; photoUrl: string | null }> {
  const amapKey = getAmapKey(userId)
  if (!amapKey) return { name: null, address: null, city: null, poiId: null, poiName: null, photoUrl: null }

  const params = new URLSearchParams({
    key: amapKey,
    location: `${lng},${lat}`,  // AMap uses "lng,lat" order
    extensions: 'all',  // 返回附近POI信息（含id、name、photos）
    output: 'JSON',
  })
  try {
    const response = await fetch(`https://restapi.amap.com/v3/geocode/regeo?${params}`)
    if (!response.ok) return { name: null, address: null, city: null, poiId: null, poiName: null, photoUrl: null }
    const data = await response.json() as {
      status: string;
      regeocode?: {
        formatted_address?: string;
        addressComponent?: {
          township?: string;
          neighborhood?: { name?: string };
          city?: string | string[] | { name?: string };
          province?: string;
        };
        pois?: { id?: string; name?: string; photos?: { url?: string }[] }[];
      }
    }
    if (data.status !== '1') return { name: null, address: null, city: null, poiId: null, poiName: null, photoUrl: null }
    const addr = data.regeocode
    const name = addr?.addressComponent?.neighborhood?.name || addr?.addressComponent?.township || null
    // city 可能是字符串、对象或数组（高德 API 版本差异）
    // ⚠️ 直辖市（北京/上海/天津/重庆）的 city 字段可能为空数组或空字符串，需回退到 province
    const cityRaw = addr?.addressComponent?.city
    let city: string | null = null
    if (typeof cityRaw === 'string' && cityRaw) {
      city = cityRaw
    } else if (Array.isArray(cityRaw) && cityRaw.length > 0 && cityRaw[0]) {
      city = String(cityRaw[0])
    } else if (cityRaw && typeof cityRaw === 'object' && (cityRaw as any)?.name) {
      city = (cityRaw as any).name
    }
    // 直辖市回退：city 为空时使用 province（北京/上海/天津/重庆）
    if (!city && addr?.addressComponent?.province) {
      city = addr.addressComponent.province.replace(/市$/, '') // 去掉"北京市"的"市"保持一致性
    }
    // extensions=all 时返回附近 POI 列表，取第一个作为参考地点
    const nearestPoi = addr?.pois?.[0]
    const poiId = nearestPoi?.id ? `amap:${nearestPoi.id}` : null
    const poiName = nearestPoi?.name || null
    const photoUrl = nearestPoi?.photos?.[0]?.url || null
    return { name, address: addr?.formatted_address || null, city, poiId, poiName, photoUrl }
  } catch { return { name: null, address: null, city: null, poiId: null, poiName: null, photoUrl: null } }
}

export async function autocompleteAmap(input: string, city?: string, userId?: number): Promise<{ suggestions: { placeId: string; mainText: string; secondaryText: string }[]; source: string }> {
  const amapKey = getAmapKey(userId)
  if (!amapKey) return { suggestions: [], source: 'amap' }

  const params = new URLSearchParams({
    key: amapKey,
    keywords: input,
    output: 'JSON',
    datatype: 'poi',
  })
  if (city) params.set('city', city)

  try {
    const response = await fetch(`https://restapi.amap.com/v3/assistant/inputtips?${params}`)
    if (!response.ok) return { suggestions: [], source: 'amap' }
    const data = await response.json() as { status: string; info?: string; tips?: { id?: string; name?: string; address?: string; district?: string; location?: string }[] }
    if (data.status !== '1') {
      console.warn('[AMap] autocomplete API error:', data.status, data.info, 'key:', amapKey ? `${amapKey.slice(0, 4)}****` : 'null')
      return { suggestions: [], source: 'amap' }
    }

    const suggestions = (data.tips || [])
      .filter(t => t.id && t.location && t.location.includes(','))  // must have valid "lng,lat"
      .slice(0, 5)
      .map(t => {
        const [lngStr, latStr] = (t.location || '').split(',')
        const rawLng = parseFloat(lngStr) || null
        const rawLat = parseFloat(latStr) || null
        const [wgsLng, wgsLat] = rawLng && rawLat ? routeGcj02ToWgs84(rawLng, rawLat) : [rawLng, rawLat]
        return {
          placeId: `amap:${t.id}`,
          mainText: t.name || '',
          secondaryText: t.district && t.address ? `${t.district} ${t.address}` : t.address || t.district || '',
          lat: wgsLat,
          lng: wgsLng,
          address: t.district && t.address ? `${t.district}${t.address}` : t.address || '',
        }
      })
    return { suggestions, source: 'amap' }
  } catch { return { suggestions: [], source: 'amap' } }
}

// ── AMap (高德地图) 路线规划 ──────────────────────────────────────────────

export interface AmapRouteResult {
  coordinates: [number, number][];  // [lat, lng] in WGS-84
  distance: number;   // meters
  duration: number;   // seconds
  distanceText: string;
  durationText: string;
  walkingText: string;
  drivingText: string;
  source: 'amap';
}

export interface AmapSegmentResult {
  mid: [number, number];
  from: [number, number];
  to: [number, number];
  walkingText: string;
  drivingText: string;
}

// WGS-84 → GCJ-02（与 weatherService.ts 和前端 coordTransform.ts 逻辑一致）
const ROUTE_PI = Math.PI;
const ROUTE_A = 6378245.0;
const ROUTE_EE = 0.00669342162296594323;

function routeOutOfChina(lng: number, lat: number): boolean {
  return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
}

function routeTransformLat(lng: number, lat: number): number {
  let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * ROUTE_PI) + 20.0 * Math.sin(2.0 * lng * ROUTE_PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lat * ROUTE_PI) + 40.0 * Math.sin(lat / 3.0 * ROUTE_PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(lat / 12.0 * ROUTE_PI) + 320 * Math.sin(lat * ROUTE_PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function routeTransformLng(lng: number, lat: number): number {
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * ROUTE_PI) + 20.0 * Math.sin(2.0 * lng * ROUTE_PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lng * ROUTE_PI) + 40.0 * Math.sin(lng / 3.0 * ROUTE_PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(lng / 12.0 * ROUTE_PI) + 300.0 * Math.sin(lng / 30.0 * ROUTE_PI)) * 2.0 / 3.0;
  return ret;
}

function routeWgs84ToGcj02(lng: number, lat: number): [number, number] {
  if (routeOutOfChina(lng, lat)) return [lng, lat];
  let dLat = routeTransformLat(lng - 105.0, lat - 35.0);
  let dLng = routeTransformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * ROUTE_PI;
  let magic = Math.sin(radLat);
  magic = 1 - ROUTE_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((ROUTE_A * (1 - ROUTE_EE)) / (magic * sqrtMagic) * ROUTE_PI);
  dLng = (dLng * 180.0) / (ROUTE_A / sqrtMagic * Math.cos(radLat) * ROUTE_PI);
  return [lng + dLng, lat + dLat];
}

function routeGcj02ToWgs84(lng: number, lat: number): [number, number] {
  if (routeOutOfChina(lng, lat)) return [lng, lat];
  let dLat = routeTransformLat(lng - 105.0, lat - 35.0);
  let dLng = routeTransformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * ROUTE_PI;
  let magic = Math.sin(radLat);
  magic = 1 - ROUTE_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((ROUTE_A * (1 - ROUTE_EE)) / (magic * sqrtMagic) * ROUTE_PI);
  dLng = (dLng * 180.0) / (ROUTE_A / sqrtMagic * Math.cos(radLat) * ROUTE_PI);
  return [lng - dLng, lat - dLat];
}

function formatRouteDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatRouteDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export async function calculateAmapRoute(
  waypoints: { lat: number; lng: number }[],
  profile: 'driving' | 'walking' | 'cycling' = 'driving',
  userId?: number,
): Promise<AmapRouteResult> {
  const amapKey = getAmapKey(userId);
  if (!amapKey) throw new Error('AMap web service key not configured');

  if (waypoints.length < 2) throw new Error('At least 2 waypoints required');

  // WGS-84 → GCJ-02
  const gcjPoints = waypoints.map(p => routeWgs84ToGcj02(p.lng, p.lat));

  const origin = `${gcjPoints[0][0]},${gcjPoints[0][1]}`;
  const dest = `${gcjPoints[gcjPoints.length - 1][0]},${gcjPoints[gcjPoints.length - 1][1]}`;

  const params = new URLSearchParams({
    key: amapKey,
    origin,
    destination: dest,
    extensions: 'base',
    output: 'JSON',
  });

  // 途经点（最多16个）
  if (gcjPoints.length > 2) {
    const viaPoints = gcjPoints.slice(1, -1).map(p => `${p[0]},${p[1]}`).join(';');
    params.set('waypoints', viaPoints);
  }

  let apiPath: string;
  if (profile === 'walking') {
    apiPath = 'https://restapi.amap.com/v3/direction/walking';
  } else if (profile === 'cycling') {
    apiPath = 'https://restapi.amap.com/v4/direction/bicycling';
  } else {
    apiPath = 'https://restapi.amap.com/v3/direction/driving';
  }

  const response = await fetch(`${apiPath}?${params}`);
  if (!response.ok) throw new Error('AMap route API error');

  const data = await response.json() as {
    status: string;
    route?: {
      paths?: { distance?: string; duration?: string; steps?: { polyline?: string }[] }[];
    };
    data?: {  // v4 cycling format
      paths?: { distance?: string; duration?: string; steps?: { polyline?: string }[] }[];
    };
  };

  if (data.status !== '1') throw new Error('AMap route calculation failed');

  // v3 和 v4 返回格式不同
  const paths = data.route?.paths || (data as any).data?.paths;
  if (!paths?.length) throw new Error('No route found');

  const path = paths[0];
  const distance = parseInt(path.distance || '0', 10);
  const duration = parseInt(path.duration || '0', 10);

  // 从 steps 中提取坐标（GCJ-02），然后转回 WGS-84
  const coordinates: [number, number][] = [];
  if (path.steps) {
    for (const step of path.steps) {
      if (step.polyline) {
        const points = step.polyline.split(';');
        for (const point of points) {
          const parts = point.split(',');
          if (parts.length >= 2) {
            const gcjLng = parseFloat(parts[0]);
            const gcjLat = parseFloat(parts[1]);
            const [wgsLng, wgsLat] = routeGcj02ToWgs84(gcjLng, gcjLat);
            coordinates.push([wgsLat, wgsLng]); // [lat, lng] 格式
          }
        }
      }
    }
  }

  // 如果没有 polyline 数据，至少包含起终点
  if (coordinates.length === 0) {
    for (const wp of waypoints) {
      coordinates.push([wp.lat, wp.lng]);
    }
  }

  const walkingDuration = distance / (5000 / 3600);

  return {
    coordinates,
    distance,
    duration,
    distanceText: formatRouteDistance(distance),
    durationText: formatRouteDuration(duration),
    walkingText: formatRouteDuration(walkingDuration),
    drivingText: formatRouteDuration(duration),
    source: 'amap',
  };
}

export async function calculateAmapSegments(
  waypoints: { lat: number; lng: number }[],
  userId?: number,
): Promise<AmapSegmentResult[]> {
  const amapKey = getAmapKey(userId);
  if (!amapKey) throw new Error('AMap web service key not configured');
  if (waypoints.length < 2) return [];

  const results: AmapSegmentResult[] = [];

  // 逐段计算（高德不支持一次返回多段信息）
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];

    try {
      const route = await calculateAmapRoute([from, to], 'driving');
      const mid: [number, number] = [(from.lat + to.lat) / 2, (from.lng + to.lng) / 2];
      results.push({
        mid,
        from: [from.lat, from.lng],
        to: [to.lat, to.lng],
        walkingText: route.walkingText,
        drivingText: route.drivingText,
      });
    } catch {
      // 单段失败不阻断整体
      const mid: [number, number] = [(from.lat + to.lat) / 2, (from.lng + to.lng) / 2];
      results.push({
        mid,
        from: [from.lat, from.lng],
        to: [to.lat, to.lng],
        walkingText: '',
        drivingText: '',
      });
    }
  }

  return results;
}

// ── AMap Transit Route (公交/地铁) ──────────────────────────────────────────

export interface TransitSegment {
  type: 'walk' | 'bus' | 'subway';       // 段落类型
  instruction: string;                     // 段落描述
  distance: number;                        // 距离(米)
  duration: number;                        // 时间(秒)
  lineName?: string;                       // 公交/地铁线路名
  lineColor?: string;                      // 线路颜色(地铁)
  departureStop?: string;                  // 上车站
  arrivalStop?: string;                    // 下车站
  viaStops?: number;                       // 途经站数
  coordinates: [number, number][];         // WGS-84 [lat, lng]
}

export interface TransitRouteOption {
  duration: number;                        // 总时间(秒)
  distance: number;                        // 总距离(米)
  walkingDistance: number;                 // 步行距离(米)
  cost: number;                            // 费用(元)
  segments: TransitSegment[];              // 分段详情
  summary: string;                         // 摘要文字
}

export interface AmapTransitResult {
  origin: [number, number];               // WGS-84 起点 [lat, lng]
  destination: [number, number];           // WGS-84 终点 [lat, lng]
  options: TransitRouteOption[];           // 换乘方案列表
  source: 'amap';
}

export async function calculateAmapTransitRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  city: string,
  strategy: number = 0,
  userId?: number,
): Promise<AmapTransitResult> {
  const amapKey = getAmapKey(userId);
  if (!amapKey) throw new Error('AMap web service key not configured');

  // WGS-84 → GCJ-02
  const [gcjOrigLng, gcjOrigLat] = routeWgs84ToGcj02(origin.lng, origin.lat);
  const [gcjDestLng, gcjDestLat] = routeWgs84ToGcj02(destination.lng, destination.lat);

  const params = new URLSearchParams({
    key: amapKey,
    origin: `${gcjOrigLng},${gcjOrigLat}`,
    destination: `${gcjDestLng},${gcjDestLat}`,
    city,
    strategy: String(strategy),
    extensions: 'all',
    output: 'JSON',
    nightflag: '0',
  });

  const response = await fetch(`https://restapi.amap.com/v3/direction/transit/integrated?${params}`);
  if (!response.ok) throw new Error('AMap transit route API error');

  const data = await response.json() as {
    status: string;
    info?: string;
    route?: {
      transits?: Array<{
        duration?: string;
        distance?: string;
        walking_distance?: string;
        cost?: { transit_rail?: string; transit_bus?: string };
        segments?: Array<{
          walking?: {
            distance?: string;
            duration?: string;
            steps?: Array<{
              instruction?: string;
              road?: string;
              distance?: string;
              duration?: string;
              polyline?: string;
            }>;
          };
          bus?: {
            buslines?: Array<{
              name?: string;
              departure_stop?: { name?: string };
              arrival_stop?: { name?: string };
              via_num?: string;
              duration?: string;
              distance?: string;
              polyline?: string;
            }>;
          };
        }>;
      }>;
    };
  };

  if (data.status !== '1' || !data.route?.transits?.length) {
    // 不抛错，返回空结果（让前端优雅处理"无路线"的情况）
    return {
      origin: [origin.lat, origin.lng],
      destination: [destination.lat, destination.lng],
      options: [],
      source: 'amap',
    };
  }

  const options: TransitRouteOption[] = [];

  for (const transit of data.route.transits.slice(0, 3)) {
    const totalDuration = parseInt(transit.duration || '0', 10);
    const totalDistance = parseInt(transit.distance || '0', 10);
    const totalWalking = parseInt(transit.walking_distance || '0', 10);
    const segments: TransitSegment[] = [];

    if (transit.segments) {
      for (const seg of transit.segments) {
        // 步行段
        if (seg.walking && seg.walking.steps?.length) {
          const walkCoords: [number, number][] = [];
          let walkDist = 0;
          let walkDur = 0;
          const walkInstructions: string[] = [];
          for (const step of seg.walking.steps) {
            walkDist += parseInt(step.distance || '0', 10);
            walkDur += parseInt(step.duration || '0', 10);
            if (step.instruction) walkInstructions.push(step.instruction);
            if (step.polyline) {
              for (const point of step.polyline.split(';')) {
                const parts = point.split(',');
                if (parts.length >= 2) {
                  const [wgsLng, wgsLat] = routeGcj02ToWgs84(parseFloat(parts[0]), parseFloat(parts[1]));
                  walkCoords.push([wgsLat, wgsLng]);
                }
              }
            }
          }
          if (walkDist > 0) {
            segments.push({
              type: 'walk',
              instruction: walkInstructions.join('，') || `步行${formatRouteDistance(walkDist)}`,
              distance: walkDist,
              duration: walkDur,
              coordinates: walkCoords,
            });
          }
        }

        // 公交/地铁段
        if (seg.bus?.buslines?.length) {
          const busline = seg.bus.buslines[0]; // 取第一条线路
          const lineName = busline.name || '';
          const isSubway = /地铁|轻轨|磁悬浮|地铁线|轨道交通/.test(lineName);
          const busCoords: [number, number][] = [];
          if (busline.polyline) {
            for (const point of busline.polyline.split(';')) {
              const parts = point.split(',');
              if (parts.length >= 2) {
                const [wgsLng, wgsLat] = routeGcj02ToWgs84(parseFloat(parts[0]), parseFloat(parts[1]));
                busCoords.push([wgsLat, wgsLng]);
              }
            }
          }
          segments.push({
            type: isSubway ? 'subway' : 'bus',
            instruction: `乘坐${lineName}`,
            distance: parseInt(busline.distance || '0', 10),
            duration: parseInt(busline.duration || '0', 10),
            lineName,
            lineColor: isSubway ? (typeof busline.color === 'string' ? busline.color : undefined) : undefined,
            departureStop: busline.departure_stop?.name,
            arrivalStop: busline.arrival_stop?.name,
            viaStops: parseInt(busline.via_num || '0', 10),
            coordinates: busCoords,
          });
        }
      }
    }

    // 生成摘要 + 费用
    const subwayCount = segments.filter(s => s.type === 'subway').length;
    const busCount = segments.filter(s => s.type === 'bus').length;
    const parts: string[] = [];
    if (subwayCount > 0) parts.push(`地铁${subwayCount}条`);
    if (busCount > 0) parts.push(`公交${busCount}条`);
    // 费用计算
    const railCost = parseFloat(transit.cost?.transit_rail || '0');
    const busCost = parseFloat(transit.cost?.transit_bus || '0');
    const totalCost = Math.round((railCost + busCost) * 100) / 100;

    const summary = parts.length > 0
      ? `${formatRouteDuration(totalDuration)} | ${parts.join('，')}${totalWalking > 0 ? ` | 步行${formatRouteDistance(totalWalking)}` : ''}${totalCost > 0 ? ` | ¥${totalCost}` : ''}`
      : formatRouteDuration(totalDuration);

    options.push({
      duration: totalDuration,
      distance: totalDistance,
      walkingDistance: totalWalking,
      cost: totalCost,
      segments,
      summary,
    });
  }

  return {
    origin: [origin.lat, origin.lng],
    destination: [destination.lat, destination.lng],
    options,
    source: 'amap',
  };
}

// ── Resolve Google Maps URL ──────────────────────────────────────────────────

export async function resolveGoogleMapsUrl(url: string): Promise<{ lat: number; lng: number; name: string | null; address: string | null }> {
  let resolvedUrl = url;

  // Follow redirects for short URLs (goo.gl, maps.app.goo.gl) with SSRF protection
  const parsed = new URL(url);
  if (['goo.gl', 'maps.app.goo.gl'].includes(parsed.hostname)) {
    const ssrf = await checkSsrf(url, true);
    if (!ssrf.allowed) throw Object.assign(new Error('URL blocked by SSRF check'), { status: 403 });
    const redirectRes = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
    resolvedUrl = redirectRes.url;
  }

  // Extract coordinates from Google Maps URL patterns:
  // /@48.8566,2.3522,15z  or  /place/.../@48.8566,2.3522
  // ?q=48.8566,2.3522  or  ?ll=48.8566,2.3522
  let lat: number | null = null;
  let lng: number | null = null;
  let placeName: string | null = null;

  // Pattern: /@lat,lng
  const atMatch = resolvedUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) { lat = parseFloat(atMatch[1]); lng = parseFloat(atMatch[2]); }

  // Pattern: !3dlat!4dlng (Google Maps data params)
  if (!lat) {
    const dataMatch = resolvedUrl.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
    if (dataMatch) { lat = parseFloat(dataMatch[1]); lng = parseFloat(dataMatch[2]); }
  }

  // Pattern: ?q=lat,lng or &q=lat,lng
  if (!lat) {
    const qMatch = resolvedUrl.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (qMatch) { lat = parseFloat(qMatch[1]); lng = parseFloat(qMatch[2]); }
  }

  // Extract place name from URL path: /place/Place+Name/@...
  const placeMatch = resolvedUrl.match(/\/place\/([^/@]+)/);
  if (placeMatch) {
    placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
  }

  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    throw Object.assign(new Error('Could not extract coordinates from URL'), { status: 400 });
  }

  // Reverse geocode to get address
  const nominatimRes = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
    { headers: { 'User-Agent': 'TREK-Travel-Planner/1.0' }, signal: AbortSignal.timeout(8000) }
  );
  const nominatim = await nominatimRes.json() as { display_name?: string; name?: string; address?: Record<string, string> };

  const name = placeName || nominatim.name || nominatim.address?.tourism || nominatim.address?.building || null;
  const address = nominatim.display_name || null;

  return { lat, lng, name, address };
}

// ── AMap IP 定位 ─────────────────────────────────────────────────────────────

export async function ipLocateAmap(userId?: number): Promise<{
  province: string | null;
  city: string | null;
  adcode: string | null;
  center: { lat: number; lng: number } | null;
  rectangle: string | null;
}> {
  const amapKey = getAmapKey(userId);
  if (!amapKey) return { province: null, city: null, adcode: null, center: null, rectangle: null };

  const params = new URLSearchParams({ key: amapKey, output: 'JSON' });
  const response = await fetch(`https://restapi.amap.com/v3/ip?${params}`);
  if (!response.ok) throw new Error('AMap IP locate API error');
  const data = await response.json() as {
    status: string;
    info?: string;
    province?: string;
    city?: string | string[];
    adcode?: string;
    rectangle?: string;
  };

  if (data.status !== '1') {
    console.warn('[AMap] IP locate error:', data.status, data.info);
    return { province: null, city: null, adcode: null, center: null, rectangle: null };
  }

  // city 可能返回空数组 []
  const cityStr = Array.isArray(data.city) ? (data.city[0] || null) : (data.city || null);

  // 从 rectangle 解析中心点: "minLng,minLat;maxLng,maxLat"
  let center: { lat: number; lng: number } | null = null;
  if (data.rectangle) {
    const parts = data.rectangle.split(';');
    if (parts.length === 2) {
      const [minLng, minLat] = parts[0].split(',').map(Number);
      const [maxLng, maxLat] = parts[1].split(',').map(Number);
      if (Number.isFinite(minLng) && Number.isFinite(maxLng) && Number.isFinite(minLat) && Number.isFinite(maxLat)) {
        center = { lng: (minLng + maxLng) / 2, lat: (minLat + maxLat) / 2 };
      }
    }
  }

  return {
    province: data.province || null,
    city: cityStr,
    adcode: data.adcode || null,
    center,
    rectangle: data.rectangle || null,
  };
}

// ── AMap 公交线路查询 ────────────────────────────────────────────────────────

export async function getAmapBusLineInfo(
  city: string,
  lineName: string,
  userId?: number,
): Promise<{
  lineName: string | null;
  totalDistance: number | null;
  totalStops: number | null;
  firstTime: string | null;
  lastTime: string | null;
  stops: { name: string; lat: number; lng: number }[];
  basicStops: { name: string; lat: number; lng: number }[];
}> {
  const emptyResult = { lineName: null, totalDistance: null, totalStops: null, firstTime: null, lastTime: null, stops: [], basicStops: [] };

  try {
    const amapKey = getAmapKey(userId);
    if (!amapKey) return emptyResult;

    const params = new URLSearchParams({
      key: amapKey,
      city,
      keywords: lineName,
      output: 'JSON',
      extensions: 'all',
    });

    let response: Response;
    try {
      response = await fetch(`https://restapi.amap.com/v3/bus/linename?${params}`);
    } catch (fetchErr) {
      console.warn('[AMap] bus line fetch error:', fetchErr);
      return emptyResult;
    }
    if (!response.ok) {
      console.warn('[AMap] bus line API HTTP error:', response.status);
      return emptyResult;
    }

    let data: any;
    try {
      data = await response.json();
    } catch (jsonErr) {
      console.warn('[AMap] bus line response JSON parse error:', jsonErr);
      return emptyResult;
    }

    // 如果第一次查询失败，尝试去掉括号等方向信息后重试
    if (data.status !== '1' || !data.buslines?.length) {
      const cleanedLineName = lineName
        .replace(/\([^)]*\)/g, '')
        .replace(/——.*$/, '')
        .replace(/--.*$/, '')
        .trim();
      if (cleanedLineName && cleanedLineName !== lineName) {
        const retryParams = new URLSearchParams({
          key: amapKey,
          city,
          keywords: cleanedLineName,
          output: 'JSON',
          extensions: 'all',
        });
        try {
          const retryResponse = await fetch(`https://restapi.amap.com/v3/bus/linename?${retryParams}`);
          if (retryResponse.ok) {
            data = await retryResponse.json();
          }
        } catch (retryErr) {
          console.warn('[AMap] bus line retry error:', retryErr);
        }
      }
    }

    if (data.status !== '1' || !data.buslines?.length) {
      return emptyResult;
    }

    // 从所有返回的线路中找到最佳匹配
    // 高德 API 对 "1号线八通线" 的查询可能返回多条线路（1号线、八通线分开），需选最佳匹配
    const buslines: any[] = data.buslines;
    let line = buslines[0];

    // 去掉查询名中的"地铁"/"轨道"前缀，提取核心关键词
    const queryCore = lineName.replace(/^(地铁|轨道交通|轨道)/, '').trim();
    // 提取查询中的线路标识，如 "1号线八通线" → ["1号线", "八通线"]
    const queryParts = queryCore.match(/\d+号线|[^\d\s]+线/g) || [queryCore];

    // 评分函数：匹配度越高分数越大
    function scoreLine(bl: any): number {
      const name = (bl.name || '').replace(/^(地铁|轨道交通|轨道)/, '');
      // 去掉方向括号
      const nameCore = name.replace(/\([^)]*\)/g, '').trim();
      let score = 0;
      // 精确匹配
      if (nameCore === queryCore) score += 100;
      // 查询名包含在线路名中（或反过来）
      if (nameCore.includes(queryCore) || queryCore.includes(nameCore)) score += 50;
      // 每个查询关键词都在线路名中出现，加分
      let matchedParts = 0;
      for (const part of queryParts) {
        if (nameCore.includes(part)) matchedParts++;
      }
      score += matchedParts * 20;
      // 所有关键词都匹配，额外加分
      if (matchedParts === queryParts.length && queryParts.length > 1) score += 30;
      // 线路越长越可能是合并线路（如1号线八通线比单独1号线长）
      score += Math.min(parseInt(bl.total_distance || '0', 10) / 1000, 20);
      return score;
    }

    // 找评分最高的线路
    let bestScore = -1;
    for (const bl of buslines) {
      const s = scoreLine(bl);
      if (s > bestScore) {
        bestScore = s;
        line = bl;
      }
    }
    const parseStops = (stops: Array<{ name?: string; location?: string }>) =>
      (stops || []).map(s => {
        const [lngStr, latStr] = (s.location || ',').split(',');
        return { name: s.name || '', lat: parseFloat(latStr) || 0, lng: parseFloat(lngStr) || 0 };
      }).filter(s => s.lat && s.lng);

    // via_stops 是 "站名1,站名2,..." 格式的字符串
    let viaStopNames: string[] = [];
    if (line.via_stops && typeof line.via_stops === 'string') {
      viaStopNames = line.via_stops.split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    const allStops = parseStops(line.busstops || []);
    const basicStops = [
      ...parseStops(line.departure_stops || []),
      ...viaStopNames.map((name: string) => ({ name, lat: 0, lng: 0 })),
      ...parseStops(line.arrival_stops || []),
    ].filter(s => s.name);

    // start_time/end_time 可能是数字（如 600）或字符串，需先转为字符串再格式化
    const fmtTime = (t: unknown): string | null => {
      if (!t) return null;
      const s = typeof t === 'string' ? t : String(t);
      return s.replace(/^(\d{1,2})(\d{2})$/, '$1:$2');
    };

    return {
      lineName: line.name || lineName,
      totalDistance: line.total_distance || null,
      totalStops: allStops.length || viaStopNames.length + 2,
      firstTime: fmtTime(line.start_time),
      lastTime: fmtTime(line.end_time),
      stops: allStops,
      basicStops,
    };
  } catch (err) {
    console.error('[AMap] getAmapBusLineInfo unexpected error:', err);
    return emptyResult;
  }
}

// ── AMap 多边形区域搜索 ──────────────────────────────────────────────────────

export async function searchAmapPolygon(
  polygon: { lat: number; lng: number }[],
  keywords: string,
  types?: string,
  userId?: number,
): Promise<{ places: Record<string, unknown>[]; source: string }> {
  const amapKey = getAmapKey(userId);
  if (!amapKey) return { places: [], source: 'amap' };

  // 将 WGS-84 坐标转换为 GCJ-02 并格式化为高德需要的格式: "lng,lat|lng,lat|..."
  const gcjPoints = polygon.map(p => {
    const [lng, lat] = routeWgs84ToGcj02(p.lng, p.lat);
    return `${lng},${lat}`;
  });
  const polygonStr = gcjPoints.join('|');

  const params = new URLSearchParams({
    key: amapKey,
    keywords,
    polygon: polygonStr,
    output: 'JSON',
    offset: '20',
    extensions: 'all',
  });
  if (types) params.set('types', types);

  const response = await fetch(`https://restapi.amap.com/v3/place/polygon?${params}`);
  if (!response.ok) throw new Error('AMap polygon search API error');
  const data = await response.json() as { status: string; pois?: AmapPoi[]; info?: string };

  if (data.status !== '1') {
    console.warn('[AMap] polygon search error:', data.status, data.info);
    return { places: [], source: 'amap' };
  }

  const places = (data.pois || []).map(poi => {
    const [lngStr, latStr] = (poi.location || ',').split(',');
    return {
      google_place_id: null,
      osm_id: poi.id ? `amap:${poi.id}` : null,
      name: poi.name || '',
      address: [poi.pname, poi.cityname, poi.adname, poi.address].filter(Boolean).join('') || '',
      lat: parseFloat(latStr) || null,
      lng: parseFloat(lngStr) || null,
      category: poi.type || null,
      amap_typecode: poi.typecode || null,
      website: poi.website || null,
      phone: (Array.isArray(poi.tel) ? poi.tel.join(',') : poi.tel) || null,
      photo_url: poi.photos?.[0]?.url || null,
      image_url: poi.photos?.[0]?.url || null,
      rating: poi.biz_ext?.rating ? parseFloat(poi.biz_ext.rating) : null,
      price_level: null,
      opening_hours: poi.business_area || null,
      source: 'amap',
    };
  });

  return { places, source: 'amap' };
}
