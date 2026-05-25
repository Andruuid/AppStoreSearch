import { getDb, saveDb } from './index.js';

function jsonField(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return null; }
}

function parseJsonField(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
}

export function normalizeSaasUrl(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.replace(/\/$/, '') || '';
    return `${host}${path}`.toLowerCase();
  } catch {
    return (url || '').toLowerCase();
  }
}

export function slugifySaasId(name) {
  return (name || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || `saas-${Date.now()}`;
}

export function saasIdFromUrlKey(urlKey) {
  const base = (urlKey || '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base.slice(0, 80) || `saas-${Date.now()}`;
}

export function saasRowToCamel(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    urlKey: row.url_key,
    tagline: row.tagline,
    description: row.description,
    logoUrl: row.logo_url,
    category: row.category,
    tags: parseJsonField(row.tags) || [],
    pricingModel: row.pricing_model,
    pricingHint: row.pricing_hint,
    source: row.source,
    productHuntId: row.product_hunt_id,
    phUpvotes: row.ph_upvotes,
    phComments: row.ph_comments,
    phLaunchedAt: row.ph_launched_at,
    metrics: parseJsonField(row.metrics),
    opportunityScore: row.opportunity_score,
    opportunityBreakdown: parseJsonField(row.opportunity_breakdown),
    opportunityReason: row.opportunity_reason,
    enrichmentStatus: row.enrichment_status,
    enrichmentError: row.enrichment_error,
    firstSeenAt: row.first_seen_at,
    lastEnrichedAt: row.last_enriched_at,
  };
}

const SORT_FIELDS = {
  name: 's.name',
  opportunity_score: 's.opportunity_score',
  ph_upvotes: 's.ph_upvotes',
  date: 's.first_seen_at',
  category: 's.category',
};

export async function upsertSaasProduct(product) {
  const db = await getDb();
  const urlKey = product.urlKey || normalizeSaasUrl(product.url);
  const id = product.id || slugifySaasId(product.name);

  db.run(`
    INSERT INTO saas_products
      (id, name, url, url_key, tagline, description, logo_url, category, tags,
       pricing_model, pricing_hint, source, product_hunt_id, ph_upvotes, ph_comments,
       ph_launched_at, metrics, opportunity_score, opportunity_breakdown, opportunity_reason,
       enrichment_status, enrichment_error, first_seen_at, last_enriched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            datetime('now'), ?)
    ON CONFLICT(url_key) DO UPDATE SET
      name = COALESCE(excluded.name, saas_products.name),
      url = COALESCE(excluded.url, saas_products.url),
      tagline = COALESCE(excluded.tagline, saas_products.tagline),
      description = COALESCE(excluded.description, saas_products.description),
      logo_url = COALESCE(excluded.logo_url, saas_products.logo_url),
      category = COALESCE(excluded.category, saas_products.category),
      tags = COALESCE(excluded.tags, saas_products.tags),
      pricing_model = COALESCE(excluded.pricing_model, saas_products.pricing_model),
      pricing_hint = COALESCE(excluded.pricing_hint, saas_products.pricing_hint),
      source = CASE
        WHEN saas_products.source = 'seed' AND excluded.source != 'seed' THEN excluded.source
        ELSE COALESCE(excluded.source, saas_products.source)
      END,
      product_hunt_id = COALESCE(excluded.product_hunt_id, saas_products.product_hunt_id),
      ph_upvotes = COALESCE(excluded.ph_upvotes, saas_products.ph_upvotes),
      ph_comments = COALESCE(excluded.ph_comments, saas_products.ph_comments),
      ph_launched_at = COALESCE(excluded.ph_launched_at, saas_products.ph_launched_at),
      metrics = COALESCE(excluded.metrics, saas_products.metrics),
      opportunity_score = COALESCE(excluded.opportunity_score, saas_products.opportunity_score),
      opportunity_breakdown = COALESCE(excluded.opportunity_breakdown, saas_products.opportunity_breakdown),
      opportunity_reason = COALESCE(excluded.opportunity_reason, saas_products.opportunity_reason),
      enrichment_status = COALESCE(excluded.enrichment_status, saas_products.enrichment_status),
      enrichment_error = excluded.enrichment_error,
      last_enriched_at = COALESCE(excluded.last_enriched_at, saas_products.last_enriched_at)
  `, [
    id,
    product.name ?? null,
    product.url ?? null,
    urlKey,
    product.tagline ?? null,
    product.description ?? null,
    product.logoUrl ?? null,
    product.category ?? null,
    jsonField(product.tags),
    product.pricingModel ?? 'unknown',
    product.pricingHint ?? null,
    product.source ?? 'seed',
    product.productHuntId ?? null,
    product.phUpvotes ?? null,
    product.phComments ?? null,
    product.phLaunchedAt ?? null,
    jsonField(product.metrics),
    product.opportunityScore ?? null,
    jsonField(product.opportunityBreakdown),
    product.opportunityReason ?? null,
    product.enrichmentStatus ?? 'pending',
    product.enrichmentError ?? null,
    product.lastEnrichedAt ?? null,
  ]);
  saveDb();
  return getSaasProductByUrlKey(urlKey);
}

export async function upsertSaasProductsBatch(products) {
  for (const p of products) {
    await upsertSaasProduct(p);
  }
}

export async function getSaasProductById(id) {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM saas_products WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return saasRowToCamel(row);
  }
  stmt.free();
  return null;
}

export async function getSaasProductByUrlKey(urlKey) {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM saas_products WHERE url_key = ?');
  stmt.bind([urlKey]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return saasRowToCamel(row);
  }
  stmt.free();
  return null;
}

export async function querySaasProducts(filters = {}) {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (filters.category) {
    conditions.push('s.category = ?');
    params.push(filters.category);
  }
  if (filters.source) {
    conditions.push('s.source = ?');
    params.push(filters.source);
  }
  if (filters.pricingModel) {
    conditions.push('s.pricing_model = ?');
    params.push(filters.pricingModel);
  }
  if (filters.search) {
    conditions.push('(s.name LIKE ? OR s.tagline LIKE ? OR s.description LIKE ? OR s.category LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term, term);
  }
  if (filters.enrichmentStatus) {
    conditions.push('s.enrichment_status = ?');
    params.push(filters.enrichmentStatus);
  }
  if (filters.opportunitiesOnly) {
    conditions.push('s.opportunity_score IS NOT NULL AND s.opportunity_score >= ?');
    params.push(parseInt(filters.minScore) || 40);
    conditions.push('s.id NOT IN (SELECT saas_id FROM saas_dismissed)');
  }
  if (filters.minOpportunityScore != null) {
    conditions.push('s.opportunity_score >= ?');
    params.push(parseInt(filters.minOpportunityScore));
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortField = SORT_FIELDS[filters.sortBy] || 's.first_seen_at';
  const sortDir = String(filters.sortDir || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const limit = Math.min(parseInt(filters.limit) || 48, 200);
  const offset = parseInt(filters.offset) || 0;

  const results = [];
  const stmt = db.prepare(`
    SELECT s.* FROM saas_products s
    ${where}
    ORDER BY ${sortField} ${sortDir}
    LIMIT ? OFFSET ?
  `);
  stmt.bind([...params, limit, offset]);
  while (stmt.step()) {
    results.push(saasRowToCamel(stmt.getAsObject()));
  }
  stmt.free();

  let total = results.length;
  if (offset === 0 && results.length < limit) {
    total = results.length;
  } else {
    const countStmt = db.prepare(`SELECT COUNT(*) AS count FROM saas_products s ${where}`);
    countStmt.bind(params);
    if (countStmt.step()) {
      total = countStmt.getAsObject().count;
    }
    countStmt.free();
  }

  return { items: results, total, limit, offset };
}

export async function getSaasCategories() {
  const db = await getDb();
  const results = [];
  const stmt = db.prepare(`
    SELECT DISTINCT category FROM saas_products
    WHERE category IS NOT NULL
    ORDER BY category
  `);
  while (stmt.step()) {
    results.push(stmt.getAsObject().category);
  }
  stmt.free();
  return results;
}

export async function getSaasStats() {
  const db = await getDb();
  const stats = {};

  const totalStmt = db.prepare('SELECT COUNT(*) AS count FROM saas_products');
  totalStmt.step();
  stats.total = totalStmt.getAsObject().count;
  totalStmt.free();

  const bySource = {};
  const sourceStmt = db.prepare(`
    SELECT source, COUNT(*) AS count FROM saas_products GROUP BY source
  `);
  while (sourceStmt.step()) {
    const row = sourceStmt.getAsObject();
    bySource[row.source] = row.count;
  }
  sourceStmt.free();
  stats.bySource = bySource;

  const byCategory = {};
  const catStmt = db.prepare(`
    SELECT category, COUNT(*) AS count FROM saas_products
    WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC
  `);
  while (catStmt.step()) {
    const row = catStmt.getAsObject();
    byCategory[row.category] = row.count;
  }
  catStmt.free();
  stats.byCategory = byCategory;

  const enrichStmt = db.prepare(`
    SELECT enrichment_status, COUNT(*) AS count FROM saas_products GROUP BY enrichment_status
  `);
  stats.byEnrichmentStatus = {};
  while (enrichStmt.step()) {
    const row = enrichStmt.getAsObject();
    stats.byEnrichmentStatus[row.enrichment_status] = row.count;
  }
  enrichStmt.free();

  const oppStmt = db.prepare(`
    SELECT COUNT(*) AS count FROM saas_products
    WHERE opportunity_score IS NOT NULL AND opportunity_score >= 40
      AND id NOT IN (SELECT saas_id FROM saas_dismissed)
  `);
  oppStmt.step();
  stats.opportunityCount = oppStmt.getAsObject().count;
  oppStmt.free();

  const syncStmt = db.prepare(`
    SELECT * FROM saas_sync_log ORDER BY started_at DESC LIMIT 1
  `);
  if (syncStmt.step()) {
    stats.lastSync = syncStmt.getAsObject();
  }
  syncStmt.free();

  return stats;
}

export async function getPendingEnrichmentProducts(limit = 50) {
  const db = await getDb();
  const results = [];
  const stmt = db.prepare(`
    SELECT * FROM saas_products
    WHERE enrichment_status = 'pending' OR enrichment_status IS NULL
    ORDER BY first_seen_at ASC
    LIMIT ?
  `);
  stmt.bind([limit]);
  while (stmt.step()) {
    results.push(saasRowToCamel(stmt.getAsObject()));
  }
  stmt.free();
  return results;
}

export async function updateSaasProduct(id, updates) {
  const db = await getDb();
  const fields = [];
  const params = [];

  const map = {
    name: 'name',
    url: 'url',
    tagline: 'tagline',
    description: 'description',
    logoUrl: 'logo_url',
    category: 'category',
    tags: 'tags',
    pricingModel: 'pricing_model',
    pricingHint: 'pricing_hint',
    source: 'source',
    productHuntId: 'product_hunt_id',
    phUpvotes: 'ph_upvotes',
    phComments: 'ph_comments',
    phLaunchedAt: 'ph_launched_at',
    metrics: 'metrics',
    opportunityScore: 'opportunity_score',
    opportunityBreakdown: 'opportunity_breakdown',
    opportunityReason: 'opportunity_reason',
    enrichmentStatus: 'enrichment_status',
    enrichmentError: 'enrichment_error',
    lastEnrichedAt: 'last_enriched_at',
  };

  for (const [key, col] of Object.entries(map)) {
    if (updates[key] !== undefined) {
      fields.push(`${col} = ?`);
      const val = ['tags', 'metrics', 'opportunityBreakdown'].includes(key)
        ? jsonField(updates[key])
        : updates[key];
      params.push(val);
    }
  }

  if (!fields.length) return getSaasProductById(id);

  params.push(id);
  db.run(`UPDATE saas_products SET ${fields.join(', ')} WHERE id = ?`, params);
  saveDb();
  return getSaasProductById(id);
}

export async function logSaasSync({ syncType, status, itemsAdded = 0, itemsUpdated = 0, error = null }) {
  const db = await getDb();
  db.run(`
    INSERT INTO saas_sync_log (sync_type, status, items_added, items_updated, error, completed_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `, [syncType, status, itemsAdded, itemsUpdated, error]);
  saveDb();
}

export async function dismissSaasProduct(saasId) {
  const db = await getDb();
  db.run(`INSERT OR IGNORE INTO saas_dismissed (saas_id, dismissed_at) VALUES (?, datetime('now'))`, [saasId]);
  saveDb();
}

export async function saveSaasFavorite(product) {
  const db = await getDb();
  db.run(`
    INSERT OR REPLACE INTO saas_favorites (saas_id, name, url, logo_url, category, tagline, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `, [
    product.id, product.name ?? null, product.url ?? null,
    product.logoUrl ?? null, product.category ?? null, product.tagline ?? null,
  ]);
  saveDb();
}

export async function removeSaasFavorite(saasId) {
  const db = await getDb();
  db.run('DELETE FROM saas_favorites WHERE saas_id = ?', [saasId]);
  saveDb();
}

export async function listSaasFavorites() {
  const db = await getDb();
  const results = [];
  const stmt = db.prepare('SELECT * FROM saas_favorites ORDER BY created_at DESC');
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      id: row.saas_id,
      name: row.name,
      url: row.url,
      logoUrl: row.logo_url,
      category: row.category,
      tagline: row.tagline,
      createdAt: row.created_at,
    });
  }
  stmt.free();
  return results;
}

export async function listSaasFavoriteIds() {
  const db = await getDb();
  const ids = [];
  const stmt = db.prepare('SELECT saas_id FROM saas_favorites');
  while (stmt.step()) {
    ids.push(stmt.getAsObject().saas_id);
  }
  stmt.free();
  return ids;
}

export async function getSaasProductCount() {
  const db = await getDb();
  const stmt = db.prepare('SELECT COUNT(*) AS count FROM saas_products');
  stmt.step();
  const count = stmt.getAsObject().count;
  stmt.free();
  return count;
}
