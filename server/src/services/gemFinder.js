import { searchApps, getDeveloperApps, getKeywordsForCategory } from './playScraper.js';
import { calculateGemScore, isBrandBlacklisted, isGemCandidate, NICHE_CATEGORIES } from './gemScoring.js';

export async function findGems(opts = {}) {
  const categoriesToSearch = opts.category
    ? [opts.category]
    : NICHE_CATEGORIES.slice(0, 6);

  const allApps = [];

  for (const cat of categoriesToSearch) {
    const keywords = getKeywordsForCategory(cat);
    for (const keyword of keywords.slice(0, 5)) {
      try {
        const apps = await searchApps({ term: keyword, num: 15, fullDetail: true });
        if (Array.isArray(apps)) allApps.push(...apps);
      } catch {
        // Skip failed searches
      }
    }
  }

  if (allApps.length === 0) return [];

  const unique = dedup(allApps);
  const candidates = unique.filter(isGemCandidate);

  const results = [];
  const checkedDevs = new Map();

  for (const app of candidates) {
    let devAppCount;
    if (checkedDevs.has(app.developerId)) {
      devAppCount = checkedDevs.get(app.developerId);
    } else {
      try {
        const devInfo = await getDeveloperApps(app.developerId);
        devAppCount = devInfo?.appCount ?? devInfo?.app_count ?? 0;
      } catch {
        devAppCount = -1;
      }
      checkedDevs.set(app.developerId, devAppCount);
    }

    if (devAppCount < 0 || devAppCount > 15) continue;

    const gem = calculateGemScore(app, devAppCount);
    if (gem.total >= 40) {
      results.push({
        ...app,
        gemScore: gem.total,
        gemBreakdown: gem.breakdown,
        gemReason: gem.reason,
        developerAppCount: devAppCount,
      });
    }
  }

  return results.sort((a, b) => b.gemScore - a.gemScore);
}

function dedup(apps) {
  const seen = new Map();
  for (const app of apps) {
    if (app.appId && !seen.has(app.appId)) seen.set(app.appId, app);
  }
  return Array.from(seen.values());
}
