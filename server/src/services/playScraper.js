import { createRequire } from 'module';
import { upsertApps, upsertDeveloper, getCachedDeveloper } from '../db/queries.js';

const require = createRequire(import.meta.url);
const gplay = require('google-play-scraper');

export const CATEGORIES = gplay.category;
export const COLLECTIONS = gplay.collection;

export async function searchApps(opts = {}) {
  const results = await gplay.search({
    term: opts.term,
    num: opts.num || 30,
    fullDetail: true,
    price: opts.price || 'all',
    lang: opts.lang || 'en',
    country: opts.country || 'us',
  });
  await upsertApps(results);
  return results;
}

export async function listApps(opts = {}) {
  const results = await gplay.list({
    category: opts.category || gplay.category.APPLICATION,
    collection: opts.collection || gplay.collection.TOP_FREE,
    num: opts.num || 100,
    fullDetail: true,
    lang: opts.lang || 'en',
    country: opts.country || 'us',
  });
  await upsertApps(results);
  return results;
}

export async function getAppDetail(appId) {
  const result = await gplay.app({ appId, lang: 'en', country: 'us' });
  await upsertApps([result]);
  return result;
}

export async function getDeveloperApps(devId) {
  const cached = await getCachedDeveloper(devId);
  if (cached) return { ...cached, fromCache: true };

  const apps = await gplay.developer({ devId, num: 60, lang: 'en', country: 'us' });
  await upsertDeveloper({ devId, name: apps[0]?.developer || devId, appCount: apps.length });
  await upsertApps(apps);
  return { devId, name: apps[0]?.developer || devId, appCount: apps.length, apps };
}

export async function getSimilarApps(appId) {
  const results = await gplay.similar({ appId, lang: 'en', country: 'us', fullDetail: true });
  await upsertApps(results);
  return results;
}

export async function getCategories() {
  return Object.entries(CATEGORIES).map(([key, value]) => ({ id: value, label: key.replace(/_/g, ' ') }));
}
