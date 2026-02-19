import { listApps, getDeveloperApps } from './playScraper.js';
import { CATEGORIES, COLLECTIONS } from './playScraper.js';

export async function findLowRatedOpportunities(opts = {}) {
  const category = opts.category || CATEGORIES.APPLICATION;
  const minInstalls = opts.minInstalls || 50000;
  const maxRating = opts.maxRating || 3.5;

  const collections = [COLLECTIONS.TOP_FREE, COLLECTIONS.TOP_PAID];
  const allApps = [];

  for (const collection of collections) {
    try {
      const apps = await listApps({ category, collection, num: opts.num || 100 });
      allApps.push(...apps);
    } catch {
      // Some category/collection combos may fail
    }
  }

  return allApps
    .filter(app =>
      app.minInstalls >= minInstalls &&
      app.score != null &&
      app.score > 0 &&
      app.score <= maxRating
    )
    .sort((a, b) => (b.minInstalls || 0) - (a.minInstalls || 0))
    .map(app => ({
      ...app,
      opportunityReason: `${formatInstalls(app.minInstalls)} downloads but only ${app.score?.toFixed(1)} stars`,
    }));
}

export async function findSoloDevApps(opts = {}) {
  const category = opts.category || CATEGORIES.APPLICATION;
  const minInstalls = opts.minInstalls || 10000;

  const apps = await listApps({ category, collection: COLLECTIONS.TOP_FREE, num: opts.num || 100 });

  const results = [];
  const checkedDevs = new Set();

  for (const app of apps) {
    if (!app.developerId || checkedDevs.has(app.developerId)) continue;
    if (app.minInstalls < minInstalls) continue;
    checkedDevs.add(app.developerId);

    try {
      const devInfo = await getDeveloperApps(app.developerId);
      const appCount = devInfo.appCount || devInfo.app_count;
      if (appCount <= 5) {
        results.push({
          ...app,
          developerAppCount: appCount,
          opportunityReason: `Solo dev (${appCount} apps) with ${formatInstalls(app.minInstalls)} downloads`,
        });
      }
    } catch {
      // Developer lookup can fail
    }
  }

  return results.sort((a, b) => (b.minInstalls || 0) - (a.minInstalls || 0));
}

export async function findNicheProfitable(opts = {}) {
  const category = opts.category || CATEGORIES.APPLICATION;

  const [paidApps, grossingApps] = await Promise.all([
    listApps({ category, collection: COLLECTIONS.TOP_PAID, num: opts.num || 100 }).catch(() => []),
    listApps({ category, collection: COLLECTIONS.GROSSING, num: opts.num || 100 }).catch(() => []),
  ]);

  const appMap = new Map();

  for (const app of [...paidApps, ...grossingApps]) {
    if (!appMap.has(app.appId)) {
      const reason = [];
      if (!app.free) reason.push(`Paid ($${app.price?.toFixed(2)})`);
      if (app.offersIAP) reason.push('Has IAP');
      if (app.minInstalls >= 1000) reason.push(`${formatInstalls(app.minInstalls)} downloads`);

      appMap.set(app.appId, {
        ...app,
        opportunityReason: reason.join(' + ') || 'In top grossing/paid',
      });
    }
  }

  return Array.from(appMap.values())
    .sort((a, b) => (b.minInstalls || 0) - (a.minInstalls || 0));
}

export async function findTrending(opts = {}) {
  const category = opts.category || CATEGORIES.APPLICATION;

  let apps = [];
  try {
    apps = await listApps({ category, collection: COLLECTIONS.TOP_FREE, num: opts.num || 100 });
  } catch {
    return [];
  }

  const now = new Date();
  const daysBack = opts.daysBack || 90;
  const cutoff = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  return apps
    .filter(app => {
      if (!app.updated) return false;
      const updatedDate = new Date(app.updated);
      return updatedDate >= cutoff;
    })
    .sort((a, b) => new Date(b.updated) - new Date(a.updated))
    .map(app => ({
      ...app,
      opportunityReason: `Recently updated (${new Date(app.updated).toLocaleDateString()}) with ${formatInstalls(app.minInstalls)} downloads`,
    }));
}

function formatInstalls(num) {
  if (!num) return '0';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toString();
}
