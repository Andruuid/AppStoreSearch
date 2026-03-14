import { Router } from 'express';
import { runCrawl, getCrawlStatus, getCrawledGems, dismissApp, resetCrawlData } from '../services/gemCrawler.js';

const router = Router();

router.post('/crawler/start', async (req, res) => {
  try {
    const { budget, threshold } = req.body || {};
    // Fire and forget -- the crawl runs in the background
    runCrawl({
      budget: parseInt(budget) || 200,
      threshold: parseInt(threshold) || 40,
    }).catch(err => console.error('Crawl error:', err.message));

    // Return immediately with current status
    await new Promise(resolve => setTimeout(resolve, 200));
    const status = await getCrawlStatus();
    res.json(status);
  } catch (err) {
    console.error('Crawler start error:', err.message);
    res.status(500).json({ error: 'Failed to start crawl', message: err.message });
  }
});

router.get('/crawler/status', async (_req, res) => {
  try {
    const status = await getCrawlStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get status', message: err.message });
  }
});

router.get('/crawler/gems', async (req, res) => {
  try {
    const { sortBy, sortDir } = req.query || {};
    const gems = await getCrawledGems({ sortBy, sortDir });
    res.json(gems);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get gems', message: err.message });
  }
});

router.post('/crawler/dismiss/:appId', async (req, res) => {
  try {
    await dismissApp(req.params.appId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss app', message: err.message });
  }
});

router.post('/crawler/reset', async (_req, res) => {
  try {
    await resetCrawlData();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset', message: err.message });
  }
});

export default router;
