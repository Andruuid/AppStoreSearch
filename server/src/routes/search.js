import { Router } from 'express';
import { searchApps, getAppDetail, getSimilarApps, getDeveloperApps, getCategories } from '../services/playScraper.js';

const router = Router();

router.get('/search', async (req, res) => {
  try {
    const { term, num, price, category } = req.query;
    if (!term) return res.status(400).json({ error: 'Search term is required' });

    const results = await searchApps({
      term,
      num: parseInt(num) || 30,
      price: price || 'all',
      category,
    });
    res.json(results);
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed', message: err.message });
  }
});

router.get('/app/:appId', async (req, res) => {
  try {
    const detail = await getAppDetail(req.params.appId);
    res.json(detail);
  } catch (err) {
    console.error('App detail error:', err.message);
    res.status(500).json({ error: 'Failed to get app details', message: err.message });
  }
});

router.get('/app/:appId/similar', async (req, res) => {
  try {
    const results = await getSimilarApps(req.params.appId);
    res.json(results);
  } catch (err) {
    console.error('Similar apps error:', err.message);
    res.status(500).json({ error: 'Failed to get similar apps', message: err.message });
  }
});

router.get('/developer/:devId', async (req, res) => {
  try {
    const result = await getDeveloperApps(req.params.devId);
    res.json(result);
  } catch (err) {
    console.error('Developer error:', err.message);
    res.status(500).json({ error: 'Failed to get developer info', message: err.message });
  }
});

router.get('/categories', async (_req, res) => {
  try {
    const categories = await getCategories();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get categories', message: err.message });
  }
});

export default router;
