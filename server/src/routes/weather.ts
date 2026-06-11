import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { getWeather, getDetailedWeather, ApiError } from '../services/weatherService';

const router = express.Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const { lat, lng, date, lang = 'de' } = req.query as { lat: string; lng: string; date?: string; lang?: string };
  const authReq = req as AuthRequest;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  try {
    const result = await getWeather(lat, lng, date, lang, authReq.user.id);
    res.json(result);
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Weather error:', err);
    res.status(500).json({ error: 'Error fetching weather data' });
  }
});

router.get('/detailed', authenticate, async (req: Request, res: Response) => {
  const { lat, lng, date, lang = 'de' } = req.query as { lat: string; lng: string; date: string; lang?: string };
  const authReq = req as AuthRequest;

  if (!lat || !lng || !date) {
    return res.status(400).json({ error: 'Latitude, longitude, and date are required' });
  }

  try {
    const result = await getDetailedWeather(lat, lng, date, lang, authReq.user.id);
    res.json(result);
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Detailed weather error:', err);
    res.status(500).json({ error: 'Error fetching detailed weather data' });
  }
});

export default router;
