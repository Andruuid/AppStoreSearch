import { Router } from 'express';
import { findLowRatedOpportunities, findSoloDevApps, findNicheProfitable, findTrending } from '../services/analyzer.js';

const router = Router();

router.get('/opportunities/low-rated', async (req, res) => {
  try {
    const { category, minInstalls, maxRating, num } = req.query;
    const results = await findLowRatedOpportunities({
      category,
      minInstalls: parseInt(minInstalls) || undefined,
      maxRating: parseFloat(maxRating) || undefined,
      num: parseInt(num) || undefined,
    });
    res.json(results);
  } catch (err) {
    console.error('Low-rated error:', err.message);
    res.status(500).json({ error: 'Failed to find low-rated opportunities', message: err.message });
  }
});

router.get('/opportunities/solo-dev', async (req, res) => {
  try {
    const { category, minInstalls, num } = req.query;
    const results = await findSoloDevApps({
      category,
      minInstalls: parseInt(minInstalls) || undefined,
      num: parseInt(num) || undefined,
    });
    res.json(results);
  } catch (err) {
    console.error('Solo-dev error:', err.message);
    res.status(500).json({ error: 'Failed to find solo dev apps', message: err.message });
  }
});

router.get('/opportunities/niche-profitable', async (req, res) => {
  try {
    const { category, num } = req.query;
    const results = await findNicheProfitable({
      category,
      num: parseInt(num) || undefined,
    });
    res.json(results);
  } catch (err) {
    console.error('Niche-profitable error:', err.message);
    res.status(500).json({ error: 'Failed to find niche profitable apps', message: err.message });
  }
});

router.get('/opportunities/trending', async (req, res) => {
  try {
    const { category, daysBack, num } = req.query;
    const results = await findTrending({
      category,
      daysBack: parseInt(daysBack) || undefined,
      num: parseInt(num) || undefined,
    });
    res.json(results);
  } catch (err) {
    console.error('Trending error:', err.message);
    res.status(500).json({ error: 'Failed to find trending apps', message: err.message });
  }
});

export default router;
