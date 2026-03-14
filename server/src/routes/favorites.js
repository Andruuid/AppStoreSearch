import { Router } from 'express';
import { saveFavoriteApp, removeFavoriteApp, listFavoriteApps, listFavoriteIds } from '../db/queries.js';

const router = Router();

router.get('/favorites', async (_req, res) => {
  try {
    const favorites = await listFavoriteApps();
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get favorites', message: err.message });
  }
});

router.get('/favorites/ids', async (_req, res) => {
  try {
    const ids = await listFavoriteIds();
    res.json(ids);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get favorite ids', message: err.message });
  }
});

router.post('/favorites', async (req, res) => {
  try {
    const app = req.body;
    if (!app?.appId) return res.status(400).json({ error: 'appId is required' });
    await saveFavoriteApp(app);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save favorite', message: err.message });
  }
});

router.delete('/favorites/:appId', async (req, res) => {
  try {
    await removeFavoriteApp(req.params.appId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove favorite', message: err.message });
  }
});

export default router;
