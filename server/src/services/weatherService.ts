
// ── AMap (高德) 天气优先 + Open-Meteo 回退 ──────────────────────────────

import { db } from '../db/database';

function getAmapKey(): string | null {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'amap_web_service_key'").get() as { value: string } | undefined;
  return row?.value || null;
}

// WGS-84 → GCJ-02 坐标转换（与前端 coordTransform.ts 逻辑一致）
const PI = Math.PI;
const AMAP_A = 6378245.0;
const AMAP_EE = 0.00669342162296594323;

function outOfChina(lng: number, lat: number): boolean {
  return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
}

function amapTransformLat(lng: number, lat: number): number {
  let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function amapTransformLng(lng: number, lat: number): number {
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  if (outOfChina(lng, lat)) return [lng, lat];
  let dLat = amapTransformLat(lng - 105.0, lat - 35.0);
  let dLng = amapTransformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - AMAP_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((AMAP_A * (1 - AMAP_EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (AMAP_A / sqrtMagic * Math.cos(radLat) * PI);
  return [lng + dLng, lat + dLat];
}

// 高德天气描述 → 标准 main 类型映射
const AMAP_WEATHER_MAP: Record<string, string> = {
  '晴': 'Clear', '多云': 'Clouds', '阴': 'Clouds',
  '阵雨': 'Rain', '雷阵雨': 'Thunderstorm', '雷阵雨伴有冰雹': 'Thunderstorm',
  '小雨': 'Rain', '中雨': 'Rain', '大雨': 'Rain', '暴雨': 'Rain',
  '大暴雨': 'Rain', '特大暴雨': 'Rain',
  '强阵雨': 'Rain', '极端降雨': 'Rain',
  '小雪': 'Snow', '中雪': 'Snow', '大雪': 'Snow', '暴雪': 'Snow',
  '雨夹雪': 'Snow', '雨雪天气': 'Snow', '阵雨夹雪': 'Snow',
  '雾': 'Fog', '浓雾': 'Fog', '强浓雾': 'Fog', '轻雾': 'Fog', '大雾': 'Fog',
  '特强浓雾': 'Fog',
  '霾': 'Fog', '中度霾': 'Fog', '重度霾': 'Fog', '严重霾': 'Fog',
  '扬沙': 'Fog', '浮尘': 'Fog', '沙尘暴': 'Fog', '强沙尘暴': 'Fog',
  '未知': 'Clouds',
};

// adcode 缓存（经纬度 → adcode），避免重复请求
const adcodeCache = new Map<string, { adcode: string; expiresAt: number }>();
const ADCODE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getAdcode(lat: string, lng: string): Promise<string | null> {
  const key = `${parseFloat(lat).toFixed(2)}_${parseFloat(lng).toFixed(2)}`;
  const cached = adcodeCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.adcode;

  const amapKey = getAmapKey();
  if (!amapKey) return null;

  // WGS-84 → GCJ-02 后再请求高德逆地理编码
  const [gcjLng, gcjLat] = wgs84ToGcj02(parseFloat(lng), parseFloat(lat));
  const params = new URLSearchParams({
    key: amapKey,
    location: `${gcjLng},${gcjLat}`,
    extensions: 'base',
    output: 'JSON',
  });

  try {
    const response = await fetch(`https://restapi.amap.com/v3/geocode/regeo?${params}`);
    if (!response.ok) return null;
    const data = await response.json() as {
      status: string;
      regeocode?: { addressComponent?: { adcode?: string } };
    };
    if (data.status !== '1' || !data.regeocode?.addressComponent?.adcode) return null;
    const adcode = data.regeocode.addressComponent.adcode;
    adcodeCache.set(key, { adcode, expiresAt: Date.now() + ADCODE_TTL });
    return adcode;
  } catch {
    return null;
  }
}

// 高德天气 API：获取实时天气（extensions=base）
async function getAmapCurrentWeather(lat: string, lng: string): Promise<WeatherResult | null> {
  const amapKey = getAmapKey();
  if (!amapKey) return null;

  const adcode = await getAdcode(lat, lng);
  if (!adcode) return null;

  const params = new URLSearchParams({
    key: amapKey,
    city: adcode,
    extensions: 'base',
    output: 'JSON',
  });

  try {
    const response = await fetch(`https://restapi.amap.com/v3/weather/weatherInfo?${params}`);
    if (!response.ok) return null;
    const data = await response.json() as {
      status: string;
      lives?: { weather?: string; temperature?: string; winddirection?: string; windpower?: string; humidity?: string; reporttime?: string }[];
    };
    if (data.status !== '1' || !data.lives?.length) return null;

    const live = data.lives[0];
    const main = AMAP_WEATHER_MAP[live.weather || ''] || 'Clouds';
    return {
      temp: parseInt(live.temperature || '0', 10) || 0,
      main,
      description: live.weather || '',
      type: 'current',
    };
  } catch {
    return null;
  }
}

// 高德天气 API：获取预报天气（extensions=all，未来3天）
async function getAmapForecastWeather(lat: string, lng: string, date: string): Promise<WeatherResult | null> {
  const amapKey = getAmapKey();
  if (!amapKey) return null;

  const adcode = await getAdcode(lat, lng);
  if (!adcode) return null;

  const params = new URLSearchParams({
    key: amapKey,
    city: adcode,
    extensions: 'all',
    output: 'JSON',
  });

  try {
    const response = await fetch(`https://restapi.amap.com/v3/weather/weatherInfo?${params}`);
    if (!response.ok) return null;
    const data = await response.json() as {
      status: string;
      forecasts?: { casts?: { date?: string; dayweather?: string; nightweather?: string; daytemp?: string; nighttemp?: string; daywind?: string; nightwind?: string; daypower?: string; nightpower?: string }[] }[];
    };
    if (data.status !== '1' || !data.forecasts?.length) return null;

    const casts = data.forecasts[0].casts || [];
    const dateStr = date.slice(0, 10);
    const cast = casts.find(c => c.date === dateStr);
    if (!cast) return null;

    const dayTemp = parseInt(cast.daytemp || '0', 10) || 0;
    const nightTemp = parseInt(cast.nighttemp || '0', 10) || 0;
    const weather = cast.dayweather || cast.nightweather || '';
    const main = AMAP_WEATHER_MAP[weather] || 'Clouds';

    return {
      temp: Math.round((dayTemp + nightTemp) / 2),
      temp_max: dayTemp,
      temp_min: nightTemp,
      main,
      description: weather,
      type: 'forecast',
    };
  } catch {
    return null;
  }
}

// 高德天气 API：获取详细预报（含逐小时估算）
async function getAmapDetailedWeather(lat: string, lng: string, date: string): Promise<WeatherResult | null> {
  const amapKey = getAmapKey();
  if (!amapKey) return null;

  const adcode = await getAdcode(lat, lng);
  if (!adcode) return null;

  const params = new URLSearchParams({
    key: amapKey,
    city: adcode,
    extensions: 'all',
    output: 'JSON',
  });

  try {
    const response = await fetch(`https://restapi.amap.com/v3/weather/weatherInfo?${params}`);
    if (!response.ok) return null;
    const data = await response.json() as {
      status: string;
      forecasts?: { casts?: { date?: string; dayweather?: string; nightweather?: string; daytemp?: string; nighttemp?: string; daywind?: string; nightwind?: string; daypower?: string; nightpower?: string }[] }[];
    };
    if (data.status !== '1' || !data.forecasts?.length) return null;

    const casts = data.forecasts[0].casts || [];
    const dateStr = date.slice(0, 10);
    const cast = casts.find(c => c.date === dateStr);
    if (!cast) return null;

    const dayTemp = parseInt(cast.daytemp || '0', 10) || 0;
    const nightTemp = parseInt(cast.nighttemp || '0', 10) || 0;
    const weather = cast.dayweather || cast.nightweather || '';
    const main = AMAP_WEATHER_MAP[weather] || 'Clouds';
    const windPower = parseInt(cast.daypower || '0', 10) || 0;
    // 风力等级 → 大致风速 (m/s)：1级≈1, 2级≈2, 3级≈4, 4级≈7, 5级≈10, 6级≈13
    const windSpeedMap = [0, 1, 2, 4, 7, 10, 13, 16, 20, 24, 28, 33, 38];
    const windMax = windSpeedMap[Math.min(windPower, 12)] || 0;

    // 高德不提供逐小时数据，用日间/夜间温度估算 8 个时段
    const hourly: HourlyEntry[] = [];
    for (let h = 0; h < 24; h += 3) {
      const isDay = h >= 6 && h < 18;
      const baseTemp = isDay ? dayTemp : nightTemp;
      // 简单正弦插值模拟日变化
      const hourOffset = Math.round(Math.sin(((h - 6) / 12) * PI) * ((dayTemp - nightTemp) / 2));
      hourly.push({
        hour: h,
        temp: baseTemp + hourOffset,
        precipitation: 0,
        precipitation_probability: 0,
        main,
        wind: windMax,
        humidity: 0,
      });
    }

    return {
      type: 'forecast',
      temp: Math.round((dayTemp + nightTemp) / 2),
      temp_max: dayTemp,
      temp_min: nightTemp,
      main,
      description: weather,
      wind_max: windMax,
      hourly,
    };
  } catch {
    return null;
  }
}

// ── Interfaces ──────────────────────────────────────────────────────────

export interface WeatherResult {
  temp: number;
  temp_max?: number;
  temp_min?: number;
  main: string;
  description: string;
  type: string;
  sunrise?: string | null;
  sunset?: string | null;
  precipitation_sum?: number;
  precipitation_probability_max?: number;
  wind_max?: number;
  hourly?: HourlyEntry[];
  error?: string;
}

export interface HourlyEntry {
  hour: number;
  temp: number;
  precipitation: number;
  precipitation_probability: number;
  main: string;
  wind: number;
  humidity: number;
}

interface OpenMeteoForecast {
  error?: boolean;
  reason?: string;
  current?: { temperature_2m: number; weathercode: number };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weathercode: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    windspeed_10m_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    weathercode?: number[];
    windspeed_10m?: number[];
    relativehumidity_2m?: number[];
  };
}

// ── WMO code mappings ───────────────────────────────────────────────────

const WMO_MAP: Record<number, string> = {
  0: 'Clear', 1: 'Clear', 2: 'Clouds', 3: 'Clouds',
  45: 'Fog', 48: 'Fog',
  51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 56: 'Drizzle', 57: 'Drizzle',
  61: 'Rain', 63: 'Rain', 65: 'Rain', 66: 'Rain', 67: 'Rain',
  71: 'Snow', 73: 'Snow', 75: 'Snow', 77: 'Snow',
  80: 'Rain', 81: 'Rain', 82: 'Rain',
  85: 'Snow', 86: 'Snow',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

const WMO_DESCRIPTION_DE: Record<number, string> = {
  0: 'Klar', 1: 'Uberwiegend klar', 2: 'Teilweise bewolkt', 3: 'Bewolkt',
  45: 'Nebel', 48: 'Nebel mit Reif',
  51: 'Leichter Nieselregen', 53: 'Nieselregen', 55: 'Starker Nieselregen',
  56: 'Gefrierender Nieselregen', 57: 'Starker gefr. Nieselregen',
  61: 'Leichter Regen', 63: 'Regen', 65: 'Starker Regen',
  66: 'Gefrierender Regen', 67: 'Starker gefr. Regen',
  71: 'Leichter Schneefall', 73: 'Schneefall', 75: 'Starker Schneefall', 77: 'Schneekorner',
  80: 'Leichte Regenschauer', 81: 'Regenschauer', 82: 'Starke Regenschauer',
  85: 'Leichte Schneeschauer', 86: 'Starke Schneeschauer',
  95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Starkes Gewitter mit Hagel',
};

const WMO_DESCRIPTION_EN: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Heavy freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snowfall', 73: 'Snowfall', 75: 'Heavy snowfall', 77: 'Snow grains',
  80: 'Light rain showers', 81: 'Rain showers', 82: 'Heavy rain showers',
  85: 'Light snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm with hail',
};

// ── Cache management ────────────────────────────────────────────────────

const weatherCache = new Map<string, { data: WeatherResult; expiresAt: number }>();
const inFlight = new Map<string, Promise<WeatherResult>>();
const CACHE_MAX_ENTRIES = 1000;
const CACHE_PRUNE_TARGET = 500;
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of weatherCache) {
    if (now > entry.expiresAt) weatherCache.delete(key);
  }
  if (weatherCache.size > CACHE_MAX_ENTRIES) {
    const entries = [...weatherCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toDelete = entries.slice(0, entries.length - CACHE_PRUNE_TARGET);
    toDelete.forEach(([key]) => weatherCache.delete(key));
  }
}, CACHE_CLEANUP_INTERVAL);

const TTL_FORECAST_MS = 60 * 60 * 1000;      // 1 hour
const TTL_CURRENT_MS  = 15 * 60 * 1000;      // 15 minutes
const TTL_CLIMATE_MS  = 24 * 60 * 60 * 1000; // 24 hours

export function cacheKey(lat: string, lng: string, date?: string): string {
  const rlat = parseFloat(lat).toFixed(2);
  const rlng = parseFloat(lng).toFixed(2);
  return `${rlat}_${rlng}_${date || 'current'}`;
}

function getCached(key: string): WeatherResult | null {
  const entry = weatherCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    weatherCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: WeatherResult, ttlMs: number): void {
  weatherCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ── Helpers ─────────────────────────────────────────────────────────────

export function estimateCondition(tempAvg: number, precipMm: number): string {
  if (precipMm > 5) return tempAvg <= 0 ? 'Snow' : 'Rain';
  if (precipMm > 1) return tempAvg <= 0 ? 'Snow' : 'Drizzle';
  if (precipMm > 0.3) return 'Clouds';
  return tempAvg > 15 ? 'Clear' : 'Clouds';
}

// ── getWeather ──────────────────────────────────────────────────────────

async function _getWeatherImpl(
  lat: string,
  lng: string,
  date: string | undefined,
  lang: string,
): Promise<WeatherResult> {
  const ck = cacheKey(lat, lng, date);

  // ── 高德天气优先（仅中国境内 + 有 amap_web_service_key）──
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const inChina = lngNum > 73.66 && lngNum < 135.05 && latNum > 3.86 && latNum < 53.55;
  if (inChina) {
    try {
      let amapResult: WeatherResult | null = null;
      if (date) {
        const targetDate = new Date(date);
        const now = new Date();
        const diffDays = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        // 高德只提供未来3天预报，且不支持历史天气
        if (diffDays >= -1 && diffDays <= 3) {
          amapResult = await getAmapForecastWeather(lat, lng, date);
        }
      } else {
        amapResult = await getAmapCurrentWeather(lat, lng);
      }
      if (amapResult) {
        setCache(ck, amapResult, date ? TTL_FORECAST_MS : TTL_CURRENT_MS);
        return amapResult;
      }
    } catch (err) {
      console.warn('[Weather] AMap weather failed, falling back to Open-Meteo:', err);
    }
  }

  if (date) {
    const cached = getCached(ck);
    if (cached) return cached;

    const targetDate = new Date(date);
    const now = new Date();
    const diffDays = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    // Forecast range (-1 .. +16 days)
    if (diffDays >= -1 && diffDays <= 16) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=16`;
      const response = await fetch(url);
      const data = await response.json() as OpenMeteoForecast;

      if (!response.ok || data.error) {
        throw new ApiError(response.status || 500, data.reason || 'Open-Meteo API error');
      }

      const dateStr = targetDate.toISOString().slice(0, 10);
      const idx = (data.daily?.time || []).indexOf(dateStr);

      if (idx !== -1) {
        const code = data.daily!.weathercode[idx];
        const descriptions = lang === 'de' ? WMO_DESCRIPTION_DE : WMO_DESCRIPTION_EN;

        const result: WeatherResult = {
          temp: Math.round((data.daily!.temperature_2m_max[idx] + data.daily!.temperature_2m_min[idx]) / 2),
          temp_max: Math.round(data.daily!.temperature_2m_max[idx]),
          temp_min: Math.round(data.daily!.temperature_2m_min[idx]),
          main: WMO_MAP[code] || 'Clouds',
          description: descriptions[code] || '',
          type: 'forecast',
        };

        setCache(ck, result, TTL_FORECAST_MS);
        return result;
      }
    }

    // Past date: use archive API for the actual date
    if (diffDays < -1) {
      const dateStr = targetDate.toISOString().slice(0, 10);
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${dateStr}&end_date=${dateStr}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum&timezone=auto`;
      const response = await fetch(url);
      const data = await response.json() as OpenMeteoForecast;

      if (!response.ok || data.error) {
        throw new ApiError(response.status || 500, data.reason || 'Open-Meteo Archive API error');
      }

      const daily = data.daily;
      if (daily && daily.time && daily.time.length > 0 && daily.temperature_2m_max[0] != null) {
        const code = daily.weathercode?.[0];
        const descriptions = lang === 'de' ? WMO_DESCRIPTION_DE : WMO_DESCRIPTION_EN;
        const tMax = daily.temperature_2m_max[0];
        const tMin = daily.temperature_2m_min[0];
        const result: WeatherResult = {
          temp: Math.round((tMax + tMin) / 2),
          temp_max: Math.round(tMax),
          temp_min: Math.round(tMin),
          main: WMO_MAP[code!] || estimateCondition((tMax + tMin) / 2, daily.precipitation_sum?.[0] || 0),
          description: descriptions[code!] || '',
          type: 'forecast',
        };
        setCache(ck, result, TTL_CLIMATE_MS);
        return result;
      }
      return { temp: 0, main: '', description: '', type: '', error: 'no_forecast' };
    }

    // Climate / archive fallback (far-future dates)
    if (diffDays > -1) {
      const month = targetDate.getMonth() + 1;
      const day = targetDate.getDate();
      let refYear = targetDate.getFullYear() - 1;
      // Archive API only has data up to yesterday — go back further if needed
      const yesterday = new Date(now.getTime() - 86400000);
      if (new Date(refYear, month - 1, day + 2) > yesterday) refYear--;
      const startDate = new Date(refYear, month - 1, day - 2);
      const endDate = new Date(refYear, month - 1, day + 2);
      const startStr = startDate.toISOString().slice(0, 10);
      const endStr = endDate.toISOString().slice(0, 10);

      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
      const response = await fetch(url);
      const data = await response.json() as OpenMeteoForecast;

      if (!response.ok || data.error) {
        throw new ApiError(response.status || 500, data.reason || 'Open-Meteo Climate API error');
      }

      const daily = data.daily;
      if (!daily || !daily.time || daily.time.length === 0) {
        return { temp: 0, main: '', description: '', type: '', error: 'no_forecast' };
      }

      let sumMax = 0, sumMin = 0, sumPrecip = 0, count = 0;
      for (let i = 0; i < daily.time.length; i++) {
        if (daily.temperature_2m_max[i] != null && daily.temperature_2m_min[i] != null) {
          sumMax += daily.temperature_2m_max[i];
          sumMin += daily.temperature_2m_min[i];
          sumPrecip += daily.precipitation_sum![i] || 0;
          count++;
        }
      }

      if (count === 0) {
        return { temp: 0, main: '', description: '', type: '', error: 'no_forecast' };
      }

      const avgMax = sumMax / count;
      const avgMin = sumMin / count;
      const avgTemp = (avgMax + avgMin) / 2;
      const avgPrecip = sumPrecip / count;
      const main = estimateCondition(avgTemp, avgPrecip);

      const result: WeatherResult = {
        temp: Math.round(avgTemp),
        temp_max: Math.round(avgMax),
        temp_min: Math.round(avgMin),
        main,
        description: '',
        type: 'climate',
      };

      setCache(ck, result, TTL_CLIMATE_MS);
      return result;
    }

    return { temp: 0, main: '', description: '', type: '', error: 'no_forecast' };
  }

  // No date supplied -> current weather
  const cached = getCached(ck);
  if (cached) return cached;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode&timezone=auto`;
  const response = await fetch(url);
  const data = await response.json() as OpenMeteoForecast;

  if (!response.ok || data.error) {
    throw new ApiError(response.status || 500, data.reason || 'Open-Meteo API error');
  }

  const code = data.current!.weathercode;
  const descriptions = lang === 'de' ? WMO_DESCRIPTION_DE : WMO_DESCRIPTION_EN;

  const result: WeatherResult = {
    temp: Math.round(data.current!.temperature_2m),
    main: WMO_MAP[code] || 'Clouds',
    description: descriptions[code] || '',
    type: 'current',
  };

  setCache(ck, result, TTL_CURRENT_MS);
  return result;
}

export async function getWeather(
  lat: string,
  lng: string,
  date: string | undefined,
  lang: string,
): Promise<WeatherResult> {
  const ck = cacheKey(lat, lng, date);
  const cached = getCached(ck);
  if (cached) return cached;

  const inFlightKey = `${ck}:${lang}`;
  const existing = inFlight.get(inFlightKey);
  if (existing) return existing;
  const promise = _getWeatherImpl(lat, lng, date, lang);
  inFlight.set(inFlightKey, promise);
  try { return await promise; } finally { inFlight.delete(inFlightKey); }
}

// ── getDetailedWeather ──────────────────────────────────────────────────

async function _getDetailedWeatherImpl(
  lat: string,
  lng: string,
  date: string,
  lang: string,
): Promise<WeatherResult> {
  const ck = `detailed_${cacheKey(lat, lng, date)}`;

  const cached = getCached(ck);
  if (cached) return cached;

  // ── 高德天气优先（仅中国境内 + 有 amap_web_service_key）──
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const inChina = lngNum > 73.66 && lngNum < 135.05 && latNum > 3.86 && latNum < 53.55;
  if (inChina) {
    const targetDate = new Date(date);
    const now = new Date();
    const diffDays = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    // 高德只提供未来3天预报
    if (diffDays >= -1 && diffDays <= 3) {
      try {
        const amapResult = await getAmapDetailedWeather(lat, lng, date);
        if (amapResult) {
          setCache(ck, amapResult, TTL_FORECAST_MS);
          return amapResult;
        }
      } catch (err) {
        console.warn('[Weather] AMap detailed weather failed, falling back to Open-Meteo:', err);
      }
    }
  }

  const targetDate = new Date(date);
  const now = new Date();
  const diffDays = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const dateStr = targetDate.toISOString().slice(0, 10);
  const descriptions = lang === 'de' ? WMO_DESCRIPTION_DE : WMO_DESCRIPTION_EN;

  // Climate / archive path (> 16 days out)
  if (diffDays > 16) {
    let refYear = targetDate.getFullYear() - 1;
    // Archive API only has data up to yesterday — go back further if needed
    const yesterday = new Date(now.getTime() - 86400000);
    if (new Date(refYear, targetDate.getMonth(), targetDate.getDate()) > yesterday) refYear--;
    const refDateStr = `${refYear}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}`
      + `&start_date=${refDateStr}&end_date=${refDateStr}`
      + `&hourly=temperature_2m,precipitation,weathercode,windspeed_10m,relativehumidity_2m`
      + `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max,sunrise,sunset`
      + `&timezone=auto`;
    const response = await fetch(url);
    const data = await response.json() as OpenMeteoForecast;

    if (!response.ok || data.error) {
      throw new ApiError(response.status || 500, data.reason || 'Open-Meteo Climate API error');
    }

    const daily = data.daily;
    const hourly = data.hourly;
    if (!daily || !daily.time || daily.time.length === 0) {
      return { temp: 0, main: '', description: '', type: '', error: 'no_forecast' };
    }

    const idx = 0;
    const code = daily.weathercode?.[idx];
    const avgMax = daily.temperature_2m_max[idx];
    const avgMin = daily.temperature_2m_min[idx];

    const hourlyData: HourlyEntry[] = [];
    if (hourly?.time) {
      for (let i = 0; i < hourly.time.length; i++) {
        const hour = new Date(hourly.time[i]).getHours();
        const hCode = hourly.weathercode?.[i];
        hourlyData.push({
          hour,
          temp: Math.round(hourly.temperature_2m[i]),
          precipitation: hourly.precipitation?.[i] || 0,
          precipitation_probability: 0,
          main: WMO_MAP[hCode!] || 'Clouds',
          wind: Math.round(hourly.windspeed_10m?.[i] || 0),
          humidity: hourly.relativehumidity_2m?.[i] || 0,
        });
      }
    }

    let sunrise: string | null = null, sunset: string | null = null;
    if (daily.sunrise?.[idx]) sunrise = daily.sunrise[idx].split('T')[1]?.slice(0, 5);
    if (daily.sunset?.[idx]) sunset = daily.sunset[idx].split('T')[1]?.slice(0, 5);

    const result: WeatherResult = {
      type: 'climate',
      temp: Math.round((avgMax + avgMin) / 2),
      temp_max: Math.round(avgMax),
      temp_min: Math.round(avgMin),
      main: WMO_MAP[code!] || estimateCondition((avgMax + avgMin) / 2, daily.precipitation_sum?.[idx] || 0),
      description: descriptions[code!] || '',
      precipitation_sum: Math.round((daily.precipitation_sum?.[idx] || 0) * 10) / 10,
      wind_max: Math.round(daily.windspeed_10m_max?.[idx] || 0),
      sunrise,
      sunset,
      hourly: hourlyData,
    };

    setCache(ck, result, TTL_CLIMATE_MS);
    return result;
  }

  // Forecast path (<= 16 days)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
    + `&hourly=temperature_2m,precipitation_probability,precipitation,weathercode,windspeed_10m,relativehumidity_2m`
    + `&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset,precipitation_probability_max,precipitation_sum,windspeed_10m_max`
    + `&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;

  const response = await fetch(url);
  const data = await response.json() as OpenMeteoForecast;

  if (!response.ok || data.error) {
    throw new ApiError(response.status || 500, data.reason || 'Open-Meteo API error');
  }

  const daily = data.daily;
  const hourly = data.hourly;

  if (!daily || !daily.time || daily.time.length === 0) {
    return { temp: 0, main: '', description: '', type: '', error: 'no_forecast' };
  }

  const dayIdx = 0;
  const code = daily.weathercode[dayIdx];

  const formatTime = (isoStr: string) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const hourlyData: HourlyEntry[] = [];
  if (hourly && hourly.time) {
    for (let i = 0; i < hourly.time.length; i++) {
      const h = new Date(hourly.time[i]).getHours();
      hourlyData.push({
        hour: h,
        temp: Math.round(hourly.temperature_2m[i]),
        precipitation_probability: hourly.precipitation_probability![i] || 0,
        precipitation: hourly.precipitation![i] || 0,
        main: WMO_MAP[hourly.weathercode![i]] || 'Clouds',
        wind: Math.round(hourly.windspeed_10m![i] || 0),
        humidity: Math.round(hourly.relativehumidity_2m![i] || 0),
      });
    }
  }

  const result: WeatherResult = {
    type: 'forecast',
    temp: Math.round((daily.temperature_2m_max[dayIdx] + daily.temperature_2m_min[dayIdx]) / 2),
    temp_max: Math.round(daily.temperature_2m_max[dayIdx]),
    temp_min: Math.round(daily.temperature_2m_min[dayIdx]),
    main: WMO_MAP[code] || 'Clouds',
    description: descriptions[code] || '',
    sunrise: formatTime(daily.sunrise![dayIdx]),
    sunset: formatTime(daily.sunset![dayIdx]),
    precipitation_sum: daily.precipitation_sum![dayIdx] || 0,
    precipitation_probability_max: daily.precipitation_probability_max![dayIdx] || 0,
    wind_max: Math.round(daily.windspeed_10m_max![dayIdx] || 0),
    hourly: hourlyData,
  };

  setCache(ck, result, TTL_FORECAST_MS);
  return result;
}

export async function getDetailedWeather(
  lat: string,
  lng: string,
  date: string,
  lang: string,
): Promise<WeatherResult> {
  const ck = `detailed_${cacheKey(lat, lng, date)}`;
  const cached = getCached(ck);
  if (cached) return cached;

  const inFlightKey = `${ck}:${lang}`;
  const existing = inFlight.get(inFlightKey);
  if (existing) return existing;
  const promise = _getDetailedWeatherImpl(lat, lng, date, lang);
  inFlight.set(inFlightKey, promise);
  try { return await promise; } finally { inFlight.delete(inFlightKey); }
}

// ── ApiError ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
