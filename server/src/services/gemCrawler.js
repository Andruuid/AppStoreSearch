import { searchApps, getDeveloperApps, getKeywordsForCategory } from './playScraper.js';
import { calculateGemScore, isGemCandidate, NICHE_CATEGORIES } from './gemScoring.js';
import {
  saveCrawledGem, getCrawledGems, getCrawledGemCount, isDismissed,
  dismissApp, getCompletedCrawlKeys, markCrawlKeyDone,
  getCrawlProgressCount, resetCrawlData, isAlreadyCrawledGem,
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

  return {
    running: crawlState.running,
    completedKeywords: completedCount,
    totalKeywords: totalCount,
    budgetUsed: crawlState.budgetUsed,
    budgetTotal: crawlState.budgetTotal,
    currentKeyword: crawlState.currentKeyword,
    gemsFoundThisSession: crawlState.gemsFoundThisSession,
    totalGems: gemCount,
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

      const candidates = apps.filter(isGemCandidate);

      for (const app of candidates) {
        if (crawlState.budgetUsed >= budget) break;
        if (await isAlreadyCrawledGem(app.appId)) continue;
        if (await isDismissed(app.appId)) continue;

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

        const gem = calculateGemScore(app, devAppCount);
        if (gem.total >= threshold) {
          await saveCrawledGem({
            ...app,
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
