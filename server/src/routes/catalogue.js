import { Router } from 'express';
import {
  queryApps,
  getCatalogueStats,
  getCatalogueCategories,
  getDiscoveryKeywords,
  catalogueRowToCamel,
} from '../db/queries.js';

const router = Router();

router.get('/catalogue', async (req, res) => {
  try {
    const {
      category, search, keyword, gemsOnly,
      sortBy, sortDir, limit, offset,
    } = req.query || {};

    const result = await queryApps({
      category: category || undefined,
      search: search || undefined,
      keyword: keyword || undefined,
      gemsOnly: gemsOnly === 'true' || gemsOnly === '1',
      sortBy: sortBy || 'date',
      sortDir: sortDir || 'desc',
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });

    res.json({
      items: result.items.map(catalogueRowToCamel),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (err) {
    console.error('Catalogue error:', err.message);
    res.status(500).json({ error: 'Failed to get catalogue', message: err.message });
  }
});

router.get('/catalogue/stats', async (_req, res) => {
  try {
    const stats = await getCatalogueStats();
    res.json(stats);
  } catch (err) {
    console.error('Catalogue stats error:', err.message);
    res.status(500).json({ error: 'Failed to get catalogue stats', message: err.message });
  }
});

router.get('/catalogue/categories', async (_req, res) => {
  try {
    const categories = await getCatalogueCategories();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get categories', message: err.message });
  }
});

router.get('/catalogue/keywords', async (_req, res) => {
  try {
    const keywords = await getDiscoveryKeywords();
    res.json(keywords);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get keywords', message: err.message });
  }
});

export default router;
