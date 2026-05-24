import { getDb, saveDb } from './index.js';

const CACHE_TTL_HOURS = 24;

function isStale(scrapedAt) {
  if (!scrapedAt) return true;
  const age = Date.now() - new Date(scrapedAt).getTime();
  return age > CACHE_TTL_HOURS * 60 * 60 * 1000;
}

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

function appToDbParams(app) {
  return [
    app.appId,
    app.title ?? null,
    app.developer ?? null,
    app.developerId ?? null,
    app.score ?? null,
    app.ratings ?? null,
    app.reviews ?? null,
    app.minInstalls ?? null,
    app.maxInstalls ?? null,
    app.price ?? null,
    app.free ? 1 : 0,
    app.currency ?? null,
    app.offersIAP ? 1 : 0,
    app.genre || app.category || null,
    app.icon ?? null,
    app.url ?? null,
    app.description ?? null,
    app.updated ?? null,
    app.summary ?? null,
    app.genreId ?? app.genre_id ?? null,
    app.headerImage ?? app.header_image ?? null,
    app.video ?? null,
    jsonField(app.screenshots),
    jsonField(app.histogram),
  ];
}

const UPSERT_APP_SQL = `
  INSERT INTO apps
    (app_id, title, developer, developer_id, score, ratings, reviews,
     min_installs, max_installs, price, free, currency, offers_iap,
     category, icon, url, description, updated, scraped_at,
     summary, genre_id, header_image, video, screenshots, histogram,
     first_seen_at, last_seen_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'),
          ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  ON CONFLICT(app_id) DO UPDATE SET
    title = excluded.title,
    developer = excluded.developer,
    developer_id = excluded.developer_id,
    score = excluded.score,
    ratings = excluded.ratings,
    reviews = excluded.reviews,
    min_installs = excluded.min_installs,
    max_installs = excluded.max_installs,
    price = excluded.price,
    free = excluded.free,
    currency = excluded.currency,
    offers_iap = excluded.offers_iap,
    category = excluded.category,
    icon = excluded.icon,
    url = excluded.url,
    description = COALESCE(excluded.description, apps.description),
    updated = excluded.updated,
    scraped_at = datetime('now'),
    summary = COALESCE(excluded.summary, apps.summary),
    genre_id = COALESCE(excluded.genre_id, apps.genre_id),
    header_image = COALESCE(excluded.header_image, apps.header_image),
    video = COALESCE(excluded.video, apps.video),
    screenshots = COALESCE(excluded.screenshots, apps.screenshots),
    histogram = COALESCE(excluded.histogram, apps.histogram),
    last_seen_at = datetime('now')
`;

export function catalogueRowToCamel(row) {
  if (!row) return null;
  return {
    appId: row.app_id,
    title: row.title,
    developer: row.developer,
    developerId: row.developer_id,
    score: row.score,
    ratings: row.ratings,
    reviews: row.reviews,
    minInstalls: row.min_installs,
    maxInstalls: row.max_installs,
    price: row.price,
    free: row.free === 1,
    currency: row.currency,
    offersIAP: row.offers_iap === 1,
    genre: row.category,
    genreId: row.genre_id,
    category: row.category,
    icon: row.icon,
    url: row.url,
    description: row.description,
    summary: row.summary,
    updated: row.updated,
    headerImage: row.header_image,
    video: row.video,
    screenshots: parseJsonField(row.screenshots),
    histogram: parseJsonField(row.histogram),
    gemScore: row.gem_score,
    gemBreakdown: parseJsonField(row.gem_breakdown),
    gemReason: row.gem_reason,
    developerAppCount: row.developer_app_count,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    scrapedAt: row.scraped_at,
  };
}

function parseAppRow(row) {
  if (!row) return row;
  row.screenshots = parseJsonField(row.screenshots);
  row.histogram = parseJsonField(row.histogram);
  row.gem_breakdown = parseJsonField(row.gem_breakdown);
  return row;
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
  db.run(UPSERT_APP_SQL, appToDbParams(app));
  saveDb();
}

export async function upsertApps(apps) {
  await upsertAppsBatch(apps);
}

export async function upsertAppsBatch(apps) {
  if (!Array.isArray(apps) || apps.length === 0) return;
  const db = await getDb();
  for (const app of apps) {
    if (!app?.appId) continue;
    db.run(UPSERT_APP_SQL, appToDbParams(app));
  }
  saveDb();
}

export async function isKnownApp(appId) {
  const db = await getDb();
  const stmt = db.prepare('SELECT 1 FROM apps WHERE app_id = ?');
  stmt.bind([appId]);
  const exists = stmt.step();
  stmt.free();
  return exists;
}

export async function getKnownAppIds(appIds) {
  const known = new Set();
  if (!Array.isArray(appIds) || appIds.length === 0) return known;
  const db = await getDb();
  const placeholders = appIds.map(() => '?').join(',');
  const stmt = db.prepare(`SELECT app_id FROM apps WHERE app_id IN (${placeholders})`);
  stmt.bind(appIds);
  while (stmt.step()) {
    known.add(stmt.getAsObject().app_id);
  }
  stmt.free();
  return known;
}

export async function recordAppDiscovery(appId, category, keyword) {
  const db = await getDb();
  db.run(
    `INSERT OR IGNORE INTO app_discoveries (app_id, category, keyword, discovered_at) VALUES (?, ?, ?, datetime('now'))`,
    [appId, category, keyword]
  );
  saveDb();
}

export async function recordAppDiscoveriesBatch(discoveries) {
  if (!Array.isArray(discoveries) || discoveries.length === 0) return;
  const db = await getDb();
  for (const { appId, category, keyword } of discoveries) {
    if (!appId) continue;
    db.run(
      `INSERT OR IGNORE INTO app_discoveries (app_id, category, keyword, discovered_at) VALUES (?, ?, ?, datetime('now'))`,
      [appId, category, keyword]
    );
  }
  saveDb();
}

export async function getCatalogueApp(appId) {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM apps WHERE app_id = ?');
  stmt.bind([appId]);
  if (stmt.step()) {
    const row = parseAppRow(stmt.getAsObject());
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export async function getCatalogueStats() {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM apps) AS total_apps,
      (SELECT COUNT(DISTINCT category) FROM apps WHERE category IS NOT NULL) AS categories,
      (SELECT COUNT(*) FROM apps WHERE gem_score IS NOT NULL) AS gems,
      (SELECT COUNT(*) FROM dismissed_apps) AS hidden,
      (SELECT MAX(discovered_at) FROM app_discoveries) AS latest_discovery
  `);
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();
  return row;
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

const SORT_FIELDS = {
  installs: 'a.min_installs',
  score: 'a.score',
  date: 'a.first_seen_at',
  title: 'a.title',
  gem_score: 'a.gem_score',
};

export async function queryApps(filters = {}) {
  const db = await getDb();
  const conditions = [];
  const params = [];
  let join = '';

  if (filters.keyword) {
    join = 'INNER JOIN app_discoveries d ON d.app_id = a.app_id';
    conditions.push('d.keyword LIKE ?');
    params.push(`%${filters.keyword}%`);
  }
  if (filters.category) {
    conditions.push('a.category = ?');
    params.push(filters.category);
  }
  if (filters.search) {
    conditions.push('(a.title LIKE ? OR a.developer LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term);
  }
  if (filters.maxScore != null) {
    conditions.push('a.score <= ?');
    params.push(filters.maxScore);
  }
  if (filters.minInstalls != null) {
    conditions.push('a.min_installs >= ?');
    params.push(filters.minInstalls);
  }
  if (filters.freeOnly != null) {
    conditions.push('a.free = ?');
    params.push(filters.freeOnly ? 1 : 0);
  }
  if (filters.hasIAP != null) {
    conditions.push('a.offers_iap = ?');
    params.push(filters.hasIAP ? 1 : 0);
  }
  if (filters.gemsOnly) {
    conditions.push('a.gem_score IS NOT NULL');
  }
  if (filters.hiddenOnly) {
    conditions.push('a.app_id IN (SELECT app_id FROM dismissed_apps)');
  } else if (!filters.includeHidden) {
    conditions.push('a.app_id NOT IN (SELECT app_id FROM dismissed_apps)');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortField = SORT_FIELDS[filters.sortBy] || 'a.last_seen_at';
  const sortDir = String(filters.sortDir || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const limit = Math.min(parseInt(filters.limit) || 50, 200);
  const offset = parseInt(filters.offset) || 0;

  const results = [];
  const stmt = db.prepare(`
    SELECT DISTINCT a.* FROM apps a
    ${join}
    ${where}
    ORDER BY ${sortField} ${sortDir}
    LIMIT ? OFFSET ?
  `);
  stmt.bind([...params, limit, offset]);
  while (stmt.step()) {
    results.push(parseAppRow(stmt.getAsObject()));
  }
  stmt.free();

  let total = results.length;
  if (offset === 0 && results.length < limit) {
    total = results.length;
  } else {
    const countStmt = db.prepare(`
      SELECT COUNT(DISTINCT a.app_id) AS count FROM apps a
      ${join}
      ${where}
    `);
    countStmt.bind(params);
    if (countStmt.step()) {
      total = countStmt.getAsObject().count;
    }
    countStmt.free();
  }

  return { items: results, total, limit, offset };
}

export async function getDiscoveryKeywords() {
  const db = await getDb();
  const results = [];
  const stmt = db.prepare(`
    SELECT DISTINCT keyword FROM app_discoveries
    WHERE keyword IS NOT NULL
    ORDER BY keyword
  `);
  while (stmt.step()) {
    results.push(stmt.getAsObject().keyword);
  }
  stmt.free();
  return results;
}

export async function getCatalogueCategories() {
  const db = await getDb();
  const results = [];
  const stmt = db.prepare(`
    SELECT DISTINCT category FROM apps
    WHERE category IS NOT NULL
    ORDER BY category
  `);
  while (stmt.step()) {
    results.push(stmt.getAsObject().category);
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
  db.run(`
    UPDATE apps SET
      gem_score = ?,
      gem_breakdown = ?,
      gem_reason = ?,
      developer_app_count = ?
    WHERE app_id = ?
  `, [
    gem.gemScore,
    JSON.stringify(gem.gemBreakdown),
    gem.gemReason,
    gem.developerAppCount,
    gem.appId,
  ]);
  saveDb();
}

export async function getCrawledGems(options = {}) {
  const db = await getDb();
  const results = [];
  const GEM_SORT_FIELDS = {
    score: 'gem_score',
    installs: 'min_installs',
    date: 'discovered_at',
  };
  const sortField = GEM_SORT_FIELDS[options.sortBy] || 'gem_score';
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

export async function undismissApp(appId) {
  const db = await getDb();
  db.run('DELETE FROM dismissed_apps WHERE app_id = ?', [appId]);
  saveDb();
}

export async function undismissAllApps() {
  const db = await getDb();
  db.run('DELETE FROM dismissed_apps');
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

export async function resetCrawlProgress() {
  const db = await getDb();
  db.run('DELETE FROM crawl_progress');
  saveDb();
}

export async function resetCrawledGems() {
  const db = await getDb();
  db.run('DELETE FROM crawled_gems');
  saveDb();
}

export async function resetCrawlData() {
  await resetCrawlProgress();
  await resetCrawledGems();
}

export async function isAlreadyCrawledGem(appId) {
  const db = await getDb();
  const stmt = db.prepare('SELECT 1 FROM crawled_gems WHERE app_id = ?');
  stmt.bind([appId]);
  const exists = stmt.step();
  stmt.free();
  return exists;
}

// --- Favorites helpers ---

export async function saveFavoriteApp(app) {
  const db = await getDb();
  db.run(`
    INSERT OR REPLACE INTO favorite_apps
      (app_id, title, developer, developer_id, icon, score, min_installs,
       price, free, offers_iap, category, url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, [
    app.appId, app.title ?? null, app.developer ?? null, app.developerId ?? null,
    app.icon ?? null, app.score ?? null, app.minInstalls ?? null, app.price ?? null,
    app.free ? 1 : 0, app.offersIAP ? 1 : 0, app.category || app.genre || null,
    app.url ?? null,
  ]);
  saveDb();
}

export async function removeFavoriteApp(appId) {
  const db = await getDb();
  db.run('DELETE FROM favorite_apps WHERE app_id = ?', [appId]);
  saveDb();
}

export async function listFavoriteApps() {
  const db = await getDb();
  const results = [];
  const stmt = db.prepare('SELECT * FROM favorite_apps ORDER BY created_at DESC');
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export async function listFavoriteIds() {
  const db = await getDb();
  const ids = [];
  const stmt = db.prepare('SELECT app_id FROM favorite_apps');
  while (stmt.step()) {
    ids.push(stmt.getAsObject().app_id);
  }
  stmt.free();
  return ids;
}
