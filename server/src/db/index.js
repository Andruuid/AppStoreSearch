import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'app_search.db');

let db = null;

export async function getDb() {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  initSchema(db);
  saveDb();
  return db;
}

function getTableColumns(db, table) {
  const cols = new Set();
  const stmt = db.prepare(`PRAGMA table_info(${table})`);
  while (stmt.step()) {
    cols.add(stmt.getAsObject().name);
  }
  stmt.free();
  return cols;
}

function addColumnIfMissing(db, table, column, definition) {
  const cols = getTableColumns(db, table);
  if (!cols.has(column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function initSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS apps (
      app_id TEXT PRIMARY KEY,
      title TEXT,
      developer TEXT,
      developer_id TEXT,
      score REAL,
      ratings INTEGER,
      reviews INTEGER,
      min_installs INTEGER,
      max_installs INTEGER,
      price REAL,
      free INTEGER,
      currency TEXT,
      offers_iap INTEGER,
      category TEXT,
      icon TEXT,
      url TEXT,
      description TEXT,
      updated TEXT,
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      summary TEXT,
      genre_id TEXT,
      header_image TEXT,
      video TEXT,
      screenshots TEXT,
      histogram TEXT,
      first_seen_at DATETIME,
      last_seen_at DATETIME,
      gem_score INTEGER,
      gem_breakdown TEXT,
      gem_reason TEXT,
      developer_app_count INTEGER
    )
  `);

  // Migrate existing databases created before catalogue columns existed
  addColumnIfMissing(db, 'apps', 'summary', 'TEXT');
  addColumnIfMissing(db, 'apps', 'genre_id', 'TEXT');
  addColumnIfMissing(db, 'apps', 'header_image', 'TEXT');
  addColumnIfMissing(db, 'apps', 'video', 'TEXT');
  addColumnIfMissing(db, 'apps', 'screenshots', 'TEXT');
  addColumnIfMissing(db, 'apps', 'histogram', 'TEXT');
  addColumnIfMissing(db, 'apps', 'first_seen_at', 'DATETIME');
  addColumnIfMissing(db, 'apps', 'last_seen_at', 'DATETIME');
  addColumnIfMissing(db, 'apps', 'gem_score', 'INTEGER');
  addColumnIfMissing(db, 'apps', 'gem_breakdown', 'TEXT');
  addColumnIfMissing(db, 'apps', 'gem_reason', 'TEXT');
  addColumnIfMissing(db, 'apps', 'developer_app_count', 'INTEGER');

  db.run(`
    CREATE TABLE IF NOT EXISTS developers (
      developer_id TEXT PRIMARY KEY,
      name TEXT,
      app_count INTEGER,
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS search_cache (
      cache_key TEXT PRIMARY KEY,
      results TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS crawled_gems (
      app_id TEXT PRIMARY KEY,
      title TEXT,
      developer TEXT,
      developer_id TEXT,
      icon TEXT,
      score REAL,
      min_installs INTEGER,
      price REAL,
      free INTEGER,
      offers_iap INTEGER,
      category TEXT,
      url TEXT,
      gem_score INTEGER,
      gem_breakdown TEXT,
      gem_reason TEXT,
      developer_app_count INTEGER,
      discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS dismissed_apps (
      app_id TEXT PRIMARY KEY,
      dismissed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS crawl_progress (
      id TEXT PRIMARY KEY,
      category TEXT,
      keyword TEXT,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS favorite_apps (
      app_id TEXT PRIMARY KEY,
      title TEXT,
      developer TEXT,
      developer_id TEXT,
      icon TEXT,
      score REAL,
      min_installs INTEGER,
      price REAL,
      free INTEGER,
      offers_iap INTEGER,
      category TEXT,
      url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS app_discoveries (
      app_id TEXT NOT NULL,
      category TEXT,
      keyword TEXT,
      discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (app_id, category, keyword)
    )
  `);

  syncCrawledGemsToApps(db);
}

function syncCrawledGemsToApps(db) {
  db.run(`
    UPDATE apps SET
      gem_score = (SELECT cg.gem_score FROM crawled_gems cg WHERE cg.app_id = apps.app_id),
      gem_breakdown = (SELECT cg.gem_breakdown FROM crawled_gems cg WHERE cg.app_id = apps.app_id),
      gem_reason = (SELECT cg.gem_reason FROM crawled_gems cg WHERE cg.app_id = apps.app_id),
      developer_app_count = (SELECT cg.developer_app_count FROM crawled_gems cg WHERE cg.app_id = apps.app_id)
    WHERE app_id IN (SELECT app_id FROM crawled_gems)
      AND gem_score IS NULL
  `);
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}
