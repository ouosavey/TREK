import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  getStats,
  getCountryPlaces,
  markCountryVisited,
  unmarkCountryVisited,
  markRegionVisited,
  unmarkRegionVisited,
  getVisitedRegions,
  getRegionGeo,
  listBucketList,
  createBucketItem,
  updateBucketItem,
  deleteBucketItem,
} from '../services/atlasService';

const router = express.Router();
router.use(authenticate);

router.get('/stats', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const data = await getStats(userId);
  res.json(data);
});

router.get('/regions', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  res.setHeader('Cache-Control', 'no-cache, no-store');
  const data = await getVisitedRegions(userId);
  res.json(data);
});

router.get('/regions/geo', async (req: Request, res: Response) => {
  const countries = (req.query.countries as string || '').split(',').filter(Boolean);
  if (countries.length === 0) return res.json({ type: 'FeatureCollection', features: [] });
  const geo = await getRegionGeo(countries);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.json(geo);
});

// Proxy world GeoJSON — avoids CSP and network issues in Docker
const WORLD_GEOJSON_URLS = [
  'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson',
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
];
let worldGeoJsonCache: { data: any; ts: number } | null = null;
const GEOJSON_CACHE_TTL = 3600000; // 1 hour
const fs = require('fs');
const path = require('path');

router.get('/geojson/world', async (req: Request, res: Response) => {
  // Return cached version if fresh enough
  if (worldGeoJsonCache && Date.now() - worldGeoJsonCache.ts < GEOJSON_CACHE_TTL) {
    return res.setHeader('Cache-Control', 'public, max-age=300').json(worldGeoJsonCache.data);
  }

  // Try local file first (bundled with Docker image)
  const localPath = path.join(__dirname, '../../public/geo/world.geojson');
  if (fs.existsSync(localPath)) {
    try {
      const json = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      if (json?.features) {
        // Override Taiwan properties to merge with China
        for (const f of json.features) {
          const name = (f.properties?.NAME || f.properties?.ADMIN || '').toLowerCase()
          const isoA2 = f.properties?.ISO_A2
          const isoA2EH = f.properties?.ISO_A2_EH
          const adm0A3 = f.properties?.ADM0_A3
          // Match Taiwan: ISO_A2 can be "TW", "CN-TW", or "-99"; ISO_A2_EH is "TW"; ADM0_A3 is "TWN"
          if (adm0A3 === 'TWN' || isoA2EH === 'TW' || isoA2 === 'TW' || isoA2 === 'CN-TW' || name.includes('taiwan')) {
            f.properties.ADM0_A3 = 'CHN';
            f.properties.ISO_A3 = 'CHN';
            f.properties.ISO_A2 = 'CN';
            f.properties.ISO_A2_EH = 'CN';
            if (f.properties['ISO3166-1-Alpha-3']) f.properties['ISO3166-1-Alpha-3'] = 'CHN';
            if (f.properties.NAME) f.properties.NAME = 'China';
            if (f.properties.ADMIN) f.properties.ADMIN = 'China';
          }
        }
        worldGeoJsonCache = { data: json, ts: Date.now() };
        return res.setHeader('Cache-Control', 'public, max-age=300').json(json);
      }
    } catch (e) {
      console.warn('Failed to read local GeoJSON:', e);
    }
  }

  // Fallback to external URLs
  for (const url of WORLD_GEOJSON_URLS) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) continue;
      const json = await response.json();
      if (!json?.features) continue;

      // Override Taiwan properties to merge with China
      for (const f of json.features) {
        const name = (f.properties?.NAME || f.properties?.ADMIN || '').toLowerCase()
        const isoA2 = f.properties?.ISO_A2
        const isoA2EH = f.properties?.ISO_A2_EH
        const adm0A3 = f.properties?.ADM0_A3
        if (adm0A3 === 'TWN' || isoA2EH === 'TW' || isoA2 === 'TW' || isoA2 === 'CN-TW' || name.includes('taiwan')) {
          f.properties.ADM0_A3 = 'CHN';
          f.properties.ISO_A3 = 'CHN';
          f.properties.ISO_A2 = 'CN';
          f.properties.ISO_A2_EH = 'CN';
          if (f.properties['ISO3166-1-Alpha-3']) f.properties['ISO3166-1-Alpha-3'] = 'CHN';
          if (f.properties.NAME) f.properties.NAME = 'China';
          if (f.properties.ADMIN) f.properties.ADMIN = 'China';
        }
      }

      worldGeoJsonCache = { data: json, ts: Date.now() };
      return res.setHeader('Cache-Control', 'public, max-age=300').json(json);
    } catch {
      continue;
    }
  }

  res.status(502).json({ error: 'Failed to load world GeoJSON from all sources' });
});

router.get('/country/:code', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const code = req.params.code.toUpperCase();
  res.json(getCountryPlaces(userId, code));
});

router.post('/country/:code/mark', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  markCountryVisited(userId, req.params.code.toUpperCase());
  res.json({ success: true });
});

router.delete('/country/:code/mark', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  unmarkCountryVisited(userId, req.params.code.toUpperCase());
  res.json({ success: true });
});

router.post('/region/:code/mark', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const { name, country_code } = req.body;
  if (!name || !country_code) return res.status(400).json({ error: 'name and country_code are required' });
  markRegionVisited(userId, req.params.code.toUpperCase(), name, country_code.toUpperCase());
  res.json({ success: true });
});

router.delete('/region/:code/mark', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  unmarkRegionVisited(userId, req.params.code.toUpperCase());
  res.json({ success: true });
});

// ── Bucket List ─────────────────────────────────────────────────────────────

router.get('/bucket-list', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  res.json({ items: listBucketList(userId) });
});

router.post('/bucket-list', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const { name, lat, lng, country_code, notes, target_date } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const item = createBucketItem(userId, { name, lat, lng, country_code, notes, target_date });
  res.status(201).json({ item });
});

router.put('/bucket-list/:id', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const { name, notes, lat, lng, country_code, target_date } = req.body;
  const item = updateBucketItem(userId, req.params.id, { name, notes, lat, lng, country_code, target_date });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({ item });
});

router.delete('/bucket-list/:id', (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const deleted = deleteBucketItem(userId, req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Item not found' });
  res.json({ success: true });
});

export default router;
