import { searchApps, getDeveloperApps, getKeywordsForCategory, getAppDetail } from './playScraper.js';
import { calculateGemScore, isGemCandidate, NICHE_CATEGORIES } from './gemScoring.js';
import {
  saveCrawledGem, getCrawledGems, getCrawledGemCount, isDismissed,
  dismissApp, getCompletedCrawlKeys, markCrawlKeyDone,
  getCrawlProgressCount, resetCrawlData, isAlreadyCrawledGem,
  upsertAppsBatch, recordAppDiscoveriesBatch, getKnownAppIds,
  getCatalogueStats,
} from '../db/queries.js';

let crawlState = {
  running: false,
  budgetUsed: 0,
  budgetTotal: 0,
  currentKeyword: null,
  gemsFoundThisSession: 0,
  stoppedReason: null,
};

function buildFullQueue() {
  const queue = [];
  for (const cat of NICHE_CATEGORIES) {
    const keywords = getKeywordsForCategory(cat);
    for (const kw of keywords) {
      queue.push({ category: cat, keyword: kw, key: `${cat}:${kw}` });
    }
  }
  return queue;
}

export function getTotalKeywordCount() {
  return buildFullQueue().length;
}

export async function getCrawlStatus() {
  const completedCount = await getCrawlProgressCount();
  const totalCount = getTotalKeywordCount();
  const gemCount = await getCrawledGemCount();
  const catalogueStats = await getCatalogueStats();

  return {
    running: crawlState.running,
    completedKeywords: completedCount,
    totalKeywords: totalCount,
    budgetUsed: crawlState.budgetUsed,
    budgetTotal: crawlState.budgetTotal,
    currentKeyword: crawlState.currentKeyword,
    gemsFoundThisSession: crawlState.gemsFoundThisSession,
    totalGems: gemCount,
    totalCatalogueApps: catalogueStats.total_apps,
    stoppedReason: crawlState.stoppedReason,
    isComplete: completedCount >= totalCount,
  };
}

export async function runCrawl({ budget = 200, threshold = 40 } = {}) {
  if (crawlState.running) {
    return { error: 'Crawl already running' };
  }

  crawlState = {
    running: true,
    budgetUsed: 0,
    budgetTotal: budget,
    currentKeyword: null,
    gemsFoundThisSession: 0,
    stoppedReason: null,
  };

  try {
    const completed = await getCompletedCrawlKeys();
    const fullQueue = buildFullQueue();
    const remaining = fullQueue.filter(item => !completed.has(item.key));

    if (remaining.length === 0) {
      crawlState.stoppedReason = 'complete';
      crawlState.running = false;
      return getCrawlStatus();
    }

    const checkedDevs = new Map();

    for (const item of remaining) {
      if (crawlState.budgetUsed >= budget) {
        crawlState.stoppedReason = 'budget_exhausted';
        break;
      }

      crawlState.currentKeyword = `${item.category}: ${item.keyword}`;

      let apps = [];
      try {
        apps = await searchApps({ term: item.keyword, num: 15, fullDetail: true });
        crawlState.budgetUsed++;
      } catch {
        await markCrawlKeyDone(item.key, item.category, item.keyword);
        continue;
      }

      if (!Array.isArray(apps)) {
        await markCrawlKeyDone(item.key, item.category, item.keyword);
        continue;
      }

      const appIds = apps.map(a => a.appId).filter(Boolean);
      const knownBefore = await getKnownAppIds(appIds);

      await upsertAppsBatch(apps);
      await recordAppDiscoveriesBatch(
        apps.filter(a => a.appId).map(a => ({
          appId: a.appId,
          category: item.category,
          keyword: item.keyword,
        }))
      );

      const newApps = apps.filter(a => a.appId && !knownBefore.has(a.appId));
      const enrichedApps = new Map(apps.map(a => [a.appId, a]));

      for (const app of newApps) {
        if (crawlState.budgetUsed >= budget) break;
        try {
          const detail = await getAppDetail(app.appId);
          enrichedApps.set(app.appId, { ...app, ...detail });
          crawlState.budgetUsed++;
        } catch {
          // Keep search result data if detail fetch fails
        }
      }

      if (newApps.length > 0) {
        await upsertAppsBatch([...enrichedApps.values()].filter(a => !knownBefore.has(a.appId)));
      }

      const candidates = apps.filter(isGemCandidate);

      for (const app of candidates) {
        if (crawlState.budgetUsed >= budget) break;
        if (knownBefore.has(app.appId)) continue;
        if (await isAlreadyCrawledGem(app.appId)) continue;
        if (await isDismissed(app.appId)) continue;

        const scoredApp = enrichedApps.get(app.appId) || app;

        let devAppCount;
        if (checkedDevs.has(app.developerId)) {
          devAppCount = checkedDevs.get(app.developerId);
        } else {
          try {
            const devInfo = await getDeveloperApps(app.developerId);
            devAppCount = devInfo?.appCount ?? devInfo?.app_count ?? 0;
            crawlState.budgetUsed++;
          } catch {
            devAppCount = -1;
          }
          checkedDevs.set(app.developerId, devAppCount);
        }

        if (devAppCount < 0 || devAppCount > 15) continue;

        const gem = calculateGemScore(scoredApp, devAppCount);
        if (gem.total >= threshold) {
          await saveCrawledGem({
            ...scoredApp,
            gemScore: gem.total,
            gemBreakdown: gem.breakdown,
            gemReason: gem.reason,
            developerAppCount: devAppCount,
          });
          crawlState.gemsFoundThisSession++;
        }
      }

      await markCrawlKeyDone(item.key, item.category, item.keyword);
    }

    if (!crawlState.stoppedReason) {
      crawlState.stoppedReason = 'complete';
    }
  } catch (err) {
    crawlState.stoppedReason = `error: ${err.message}`;
  } finally {
    crawlState.running = false;
    crawlState.currentKeyword = null;
  }

  return getCrawlStatus();
}

export { getCrawledGems, dismissApp, resetCrawlData };
