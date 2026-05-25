import { Router } from 'express';
import {
  querySaasProducts, getSaasProductById, getSaasStats, getSaasCategories,
  upsertSaasProduct, normalizeSaasUrl, saasIdFromUrlKey,
  dismissSaasProduct, saveSaasFavorite, removeSaasFavorite,
  listSaasFavorites, listSaasFavoriteIds,
} from '../db/saasQueries.js';
import { importSeedProducts } from '../services/saasImporter.js';
import { calculateSaasOpportunityScore } from '../services/saasScoring.js';
import {
  runEnrichment, enrichSaasProductById, getEnrichStatus,
} from '../services/websiteEnricher.js';
import {
  syncProductHunt, getProductHuntSyncStatus, isProductHuntConfigured,
} from '../services/productHuntSync.js';

const router = Router();

router.get('/saas/stats', async (_req, res) => {
  try {
    const stats = await getSaasStats();
    res.json({ ...stats, productHuntConfigured: isProductHuntConfigured() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stats', message: err.message });
  }
});

router.get('/saas/categories', async (_req, res) => {
  try {
    const categories = await getSaasCategories();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get categories', message: err.message });
  }
});

router.get('/saas/sync/status', async (_req, res) => {
  try {
    res.json({
      productHunt: getProductHuntSyncStatus(),
      enrichment: getEnrichStatus(),
      productHuntConfigured: isProductHuntConfigured(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get sync status', message: err.message });
  }
});

router.get('/saas/favorites', async (_req, res) => {
  try {
    const favorites = await listSaasFavorites();
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get favorites', message: err.message });
  }
});

router.get('/saas/favorites/ids', async (_req, res) => {
  try {
    const ids = await listSaasFavoriteIds();
    res.json(ids);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get favorite ids', message: err.message });
  }
});

router.post('/saas/favorites', async (req, res) => {
  try {
    const product = req.body;
    if (!product?.id) return res.status(400).json({ error: 'id is required' });
    await saveSaasFavorite(product);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save favorite', message: err.message });
  }
});

router.delete('/saas/favorites/:id', async (req, res) => {
  try {
    await removeSaasFavorite(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove favorite', message: err.message });
  }
});

router.post('/saas/import-seed', async (_req, res) => {
  try {
    const result = await importSeedProducts({ rescore: true });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to import seed', message: err.message });
  }
});

router.post('/saas/sync/product-hunt', async (req, res) => {
  try {
    const { maxPages } = req.body || {};
    syncProductHunt({ maxPages: parseInt(maxPages) || 5 }).catch(err => {
      console.error('Product Hunt sync error:', err.message);
    });
    await new Promise(resolve => setTimeout(resolve, 200));
    res.json(getProductHuntSyncStatus());
  } catch (err) {
    res.status(500).json({ error: 'Failed to start sync', message: err.message });
  }
});

router.post('/saas/enrich', async (req, res) => {
  try {
    const { budget } = req.body || {};
    runEnrichment({ budget: parseInt(budget) || 50 }).catch(err => {
      console.error('Enrichment error:', err.message);
    });
    await new Promise(resolve => setTimeout(resolve, 200));
    res.json(getEnrichStatus());
  } catch (err) {
    res.status(500).json({ error: 'Failed to start enrichment', message: err.message });
  }
});

router.post('/saas/enrich/:id', async (req, res) => {
  try {
    const product = await enrichSaasProductById(req.params.id);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to enrich product', message: err.message });
  }
});

router.post('/saas/dismiss/:id', async (req, res) => {
  try {
    await dismissSaasProduct(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss', message: err.message });
  }
});

router.get('/saas', async (req, res) => {
  try {
    const {
      search, category, source, pricingModel, opportunitiesOnly,
      sortBy, sortDir, limit, offset, minScore,
    } = req.query;

    const result = await querySaasProducts({
      search,
      category,
      source,
      pricingModel,
      opportunitiesOnly: opportunitiesOnly === 'true',
      minScore,
      sortBy,
      sortDir,
      limit,
      offset,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to query SaaS products', message: err.message });
  }
});

router.post('/saas', async (req, res) => {
  try {
    const { url, name, category } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url is required' });

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const urlKey = normalizeSaasUrl(normalizedUrl);
    const productName = name || urlKey.split('/')[0];

    const product = {
      id: saasIdFromUrlKey(urlKey),
      name: productName,
      url: normalizedUrl,
      urlKey,
      category: category || null,
      source: 'manual',
      enrichmentStatus: 'pending',
    };

    const score = calculateSaasOpportunityScore(product);
    product.opportunityScore = score.total;
    product.opportunityBreakdown = score.breakdown;
    product.opportunityReason = score.reason;

    const saved = await upsertSaasProduct(product);

    enrichSaasProductById(saved.id).catch(err => {
      console.error('Auto-enrich failed:', err.message);
    });

    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add product', message: err.message });
  }
});

router.get('/saas/:id', async (req, res) => {
  try {
    const product = await getSaasProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get product', message: err.message });
  }
});

export default router;
