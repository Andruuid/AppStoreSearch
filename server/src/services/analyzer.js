import { listApps, searchApps, getDeveloperApps, getAppDetails, getKeywordsForCategory } from './playScraper.js';
import { CATEGORIES, COLLECTIONS } from './playScraper.js';

export async function findLowRatedOpportunities(opts = {}) {
  const category = opts.category || CATEGORIES.APPLICATION;
  const minInstalls = opts.minInstalls || 50000;
  const maxRating = opts.maxRating || 3.5;

  const allApps = await gatherApps(category, { num: 60 });

  return dedup(allApps)
    .filter(app =>
      (app.minInstalls || 0) >= minInstalls &&
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
  const minInstalls = opts.minInstalls || 1000;

  const keywords = getKeywordsForCategory(category);
  const allApps = [];

  // Search with niche keywords to find smaller, indie apps
  for (const keyword of keywords.slice(0, 4)) {
    try {
      const apps = await searchApps({ term: keyword, num: 20, fullDetail: true });
      if (Array.isArray(apps)) allApps.push(...apps);
    } catch {
      // Some searches may fail
    }
  }

  if (allApps.length === 0) return [];

  const unique = dedup(allApps).filter(app =>
    app.developerId && (app.minInstalls || 0) >= minInstalls
  );

  const results = [];
  const checkedDevs = new Set();

  for (const app of unique) {
    if (checkedDevs.has(app.developerId)) continue;
    checkedDevs.add(app.developerId);

    try {
      const devInfo = await getDeveloperApps(app.developerId);
      const appCount = devInfo?.appCount ?? devInfo?.app_count ?? 0;
      if (appCount > 0 && appCount <= 5) {
        results.push({
          ...app,
          developerAppCount: appCount,
          opportunityReason: `Solo dev (${appCount} app${appCount > 1 ? 's' : ''}) with ${formatInstalls(app.minInstalls)} downloads`,
        });
      }
    } catch {
      // Skip failed lookups
    }
  }

  return results.sort((a, b) => (b.minInstalls || 0) - (a.minInstalls || 0));
}

export async function findNicheProfitable(opts = {}) {
  const category = opts.category || CATEGORIES.APPLICATION;

  const [paidApps, grossingApps] = await Promise.all([
    listApps({ category, collection: COLLECTIONS.TOP_PAID, num: 60 }).catch(() => []),
    listApps({ category, collection: COLLECTIONS.GROSSING, num: 60 }).catch(() => []),
  ]);

  const safePaid = Array.isArray(paidApps) ? paidApps : [];
  const safeGrossing = Array.isArray(grossingApps) ? grossingApps : [];
  const combined = [...safePaid, ...safeGrossing];

  // Enrich with full details for the top candidates
  const needsDetail = combined.filter(a => a.minInstalls == null).map(a => a.appId);
  if (needsDetail.length > 0) {
    const detailed = await getAppDetails(needsDetail.slice(0, 20));
    const detailMap = new Map(detailed.map(a => [a.appId, a]));
    for (let i = 0; i < combined.length; i++) {
      if (detailMap.has(combined[i].appId)) {
        combined[i] = { ...combined[i], ...detailMap.get(combined[i].appId) };
      }
    }
  }

  return dedup(combined)
    .map(app => {
      const reasons = [];
      if (!app.free) reasons.push(`Paid ($${app.price?.toFixed(2)})`);
      if (app.offersIAP) reasons.push('Has IAP');
      if ((app.minInstalls || 0) >= 1000) reasons.push(`${formatInstalls(app.minInstalls)} downloads`);
      return {
        ...app,
        opportunityReason: reasons.join(' + ') || 'In top grossing/paid',
      };
    })
    .sort((a, b) => (b.minInstalls || 0) - (a.minInstalls || 0));
}

export async function findTrending(opts = {}) {
  const category = opts.category || CATEGORIES.APPLICATION;
  const daysBack = opts.daysBack || 90;

  const allApps = await gatherApps(category, { num: 60 });
  const now = new Date();
  const cutoff = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  return dedup(allApps)
    .filter(app => {
      if (!app.updated) return false;
      return new Date(app.updated) >= cutoff;
    })
    .sort((a, b) => new Date(b.updated) - new Date(a.updated))
    .map(app => ({
      ...app,
      opportunityReason: `Updated ${new Date(app.updated).toLocaleDateString()} with ${formatInstalls(app.minInstalls)} downloads`,
    }));
}

async function gatherApps(category, opts = {}) {
  const num = opts.num || 60;
  const allApps = [];

  // Get apps from list endpoints (fast, no fullDetail)
  for (const collection of [COLLECTIONS.TOP_FREE, COLLECTIONS.TOP_PAID]) {
    try {
      const apps = await listApps({ category, collection, num });
      if (Array.isArray(apps)) allApps.push(...apps);
    } catch {
      // Some combos may not exist
    }
  }

  // Enrich a batch with full details to get minInstalls, ratings, etc.
  const needsDetail = allApps.filter(a => a.minInstalls == null).map(a => a.appId);
  if (needsDetail.length > 0) {
    const detailed = await getAppDetails(needsDetail.slice(0, 30));
    const detailMap = new Map(detailed.map(a => [a.appId, a]));
    for (let i = 0; i < allApps.length; i++) {
      if (detailMap.has(allApps[i].appId)) {
        allApps[i] = { ...allApps[i], ...detailMap.get(allApps[i].appId) };
      }
    }
  }

  return allApps;
}

function dedup(apps) {
  const seen = new Map();
  for (const app of apps) {
    if (app.appId && !seen.has(app.appId)) {
      seen.set(app.appId, app);
    }
  }
  return Array.from(seen.values());
}

function formatInstalls(num) {
  if (!num) return '0';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toString();
}
