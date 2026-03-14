import { getDb, saveDb } from './index.js';

const CACHE_TTL_HOURS = 24;

function isStale(scrapedAt) {
  if (!scrapedAt) return true;
  const age = Date.now() - new Date(scrapedAt).getTime();
  return age > CACHE_TTL_HOURS * 60 * 60 * 1000;
}

export async function getCachedApp(appId) {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM apps WHERE app_id = ?');
  stmt.bind([appId]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    if (!isStale(row.scraped_at)) return row;
  } else {
    stmt.free();
  }
  return null;
}

export async function upsertApp(app) {
  const db = await getDb();
  db.run(`
    INSERT OR REPLACE INTO apps
      (app_id, title, developer, developer_id, score, ratings, reviews,
       min_installs, max_installs, price, free, currency, offers_iap,
       category, icon, url, description, updated, scraped_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, [
    app.appId, app.title, app.developer, app.developerId,
    app.score, app.ratings, app.reviews,
    app.minInstalls, app.maxInstalls, app.price,
    app.free ? 1 : 0, app.currency, app.offersIAP ? 1 : 0,
    app.genre, app.icon, app.url, app.description, app.updated
  ]);
  saveDb();
}

export async function upsertApps(apps) {
  for (const app of apps) {
    await upsertApp(app);
  }
}

export async function getCachedDeveloper(developerId) {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM developers WHERE developer_id = ?');
  stmt.bind([developerId]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    if (!isStale(row.scraped_at)) return row;
  } else {
    stmt.free();
  }
  return null;
}

export async function upsertDeveloper(dev) {
  const db = await getDb();
  db.run(`
    INSERT OR REPLACE INTO developers (developer_id, name, app_count, scraped_at)
    VALUES (?, ?, ?, datetime('now'))
  `, [dev.devId, dev.name, dev.appCount]);
  saveDb();
}

export async function getCachedSearch(key) {
  const db = await getDb();
  const stmt = db.prepare('SELECT results, created_at FROM search_cache WHERE cache_key = ?');
  stmt.bind([key]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    if (!isStale(row.created_at)) {
      try { return JSON.parse(row.results); } catch { return null; }
    }
  } else {
    stmt.free();
  }
  return null;
}

export async function setCachedSearch(key, results) {
  const db = await getDb();
  db.run(
    `INSERT OR REPLACE INTO search_cache (cache_key, results, created_at) VALUES (?, ?, datetime('now'))`,
    [key, JSON.stringify(results)]
  );
  saveDb();
}

export async function queryApps(filters = {}) {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (filters.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }
  if (filters.maxScore != null) {
    conditions.push('score <= ?');
    params.push(filters.maxScore);
  }
  if (filters.minInstalls != null) {
    conditions.push('min_installs >= ?');
    params.push(filters.minInstalls);
  }
  if (filters.freeOnly != null) {
    conditions.push('free = ?');
    params.push(filters.freeOnly ? 1 : 0);
  }
  if (filters.hasIAP != null) {
    conditions.push('offers_iap = ?');
    params.push(filters.hasIAP ? 1 : 0);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = filters.orderBy || 'min_installs DESC';
  const limit = filters.limit || 50;

  const results = [];
  const stmt = db.prepare(`SELECT * FROM apps ${where} ORDER BY ${orderBy} LIMIT ?`);
  stmt.bind([...params, limit]);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// --- Crawler helpers ---

export async function saveCrawledGem(gem) {
  const db = await getDb();
  db.run(`
    INSERT OR REPLACE INTO crawled_gems
      (app_id, title, developer, developer_id, icon, score, min_installs,
       price, free, offers_iap, category, url, gem_score, gem_breakdown,
       gem_reason, developer_app_count, discovered_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, [
    gem.appId, gem.title, gem.developer, gem.developerId, gem.icon,
    gem.score, gem.minInstalls, gem.price, gem.free ? 1 : 0,
    gem.offersIAP ? 1 : 0, gem.genre || gem.category, gem.url,
    gem.gemScore, JSON.stringify(gem.gemBreakdown), gem.gemReason,
    gem.developerAppCount,
  ]);
  saveDb();
}

export async function getCrawledGems(options = {}) {
  const db = await getDb();
  const results = [];
  const SORT_FIELDS = {
    score: 'gem_score',
    installs: 'min_installs',
    date: 'discovered_at',
  };
  const sortField = SORT_FIELDS[options.sortBy] || 'gem_score';
  const sortDir = String(options.sortDir || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const stmt = db.prepare(`
    SELECT * FROM crawled_gems
    WHERE app_id NOT IN (SELECT app_id FROM dismissed_apps)
    ORDER BY ${sortField} ${sortDir}
  `);
  while (stmt.step()) {
    const row = stmt.getAsObject();
    try { row.gem_breakdown = JSON.parse(row.gem_breakdown); } catch { /* keep as string */ }
    results.push(row);
  }
  stmt.free();
  return results;
}

export async function getCrawledGemCount() {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM crawled_gems
    WHERE app_id NOT IN (SELECT app_id FROM dismissed_apps)
  `);
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();
  return row.count;
}

export async function isDismissed(appId) {
  const db = await getDb();
  const stmt = db.prepare('SELECT 1 FROM dismissed_apps WHERE app_id = ?');
  stmt.bind([appId]);
  const exists = stmt.step();
  stmt.free();
  return exists;
}

export async function dismissApp(appId) {
  const db = await getDb();
  db.run(`INSERT OR IGNORE INTO dismissed_apps (app_id, dismissed_at) VALUES (?, datetime('now'))`, [appId]);
  saveDb();
}

export async function getCompletedCrawlKeys() {
  const db = await getDb();
  const keys = new Set();
  const stmt = db.prepare('SELECT id FROM crawl_progress');
  while (stmt.step()) {
    keys.add(stmt.getAsObject().id);
  }
  stmt.free();
  return keys;
}

export async function markCrawlKeyDone(key, category, keyword) {
  const db = await getDb();
  db.run(
    `INSERT OR IGNORE INTO crawl_progress (id, category, keyword, completed_at) VALUES (?, ?, ?, datetime('now'))`,
    [key, category, keyword]
  );
  saveDb();
}

export async function getCrawlProgressCount() {
  const db = await getDb();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM crawl_progress');
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();
  return row.count;
}

export async function resetCrawlData() {
  const db = await getDb();
  db.run('DELETE FROM crawl_progress');
  db.run('DELETE FROM crawled_gems');
  saveDb();
}

export async function isAlreadyCrawledGem(appId) {
  const db = await getDb();
  const stmt = db.prepare('SELECT 1 FROM crawled_gems WHERE app_id = ?');
  stmt.bind([appId]);
  const exists = stmt.step();
  stmt.free();
  return exists;
}
