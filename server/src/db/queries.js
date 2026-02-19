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
