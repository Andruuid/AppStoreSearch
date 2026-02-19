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
  return db;
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
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS developers (
      developer_id TEXT PRIMARY KEY,
      name TEXT,
      app_count INTEGER,
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}
