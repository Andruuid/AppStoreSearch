import { searchApps, getDeveloperApps, getKeywordsForCategory, CATEGORIES } from './playScraper.js';

const BRAND_BLACKLIST = [
  'google', 'meta', 'facebook', 'microsoft', 'amazon', 'apple', 'samsung',
  'uber', 'lyft', 'airbnb', 'pinterest', 'snap', 'snapchat', 'twitter',
  'tiktok', 'bytedance', 'spotify', 'netflix', 'adobe', 'oracle', 'ibm',
  'salesforce', 'paypal', 'stripe', 'square', 'block, inc', 'intuit',
  'walmart', 'target', 'starbucks', 'mcdonalds', 'burger king',
  'coca-cola', 'pepsi', 'nike', 'adidas',
  'bank of america', 'chase', 'wells fargo', 'citibank', 'capital one',
  'american express', 'visa', 'mastercard',
  'disney', 'warner', 'paramount', 'sony', 'ea ', 'electronic arts',
  'activision', 'blizzard', 'epic games', 'riot', 'supercell', 'king',
  'zynga', 'roblox', 'tencent', 'netease',
  'zoom', 'slack', 'dropbox', 'evernote', 'notion labs',
  'doordash', 'grubhub', 'instacart', 'postmates',
  'booking.com', 'expedia', 'tripadvisor', 'kayak',
  'linkedin', 'indeed', 'glassdoor',
  'robinhood', 'coinbase', 'binance', 'crypto.com',
  'duolingo', 'khan academy', 'coursera',
  'fitbit', 'garmin', 'peloton', 'nike',
  'ring', 'nest', 'philips', 'honeywell',
];

const COMPETITIVE_CATEGORIES = new Set([
  'GAME', 'GAME_ACTION', 'GAME_ADVENTURE', 'GAME_ARCADE', 'GAME_BOARD',
  'GAME_CARD', 'GAME_CASINO', 'GAME_CASUAL', 'GAME_PUZZLE', 'GAME_RACING',
  'GAME_ROLE_PLAYING', 'GAME_SIMULATION', 'GAME_SPORTS', 'GAME_STRATEGY',
  'GAME_TRIVIA', 'GAME_WORD', 'GAME_EDUCATIONAL', 'GAME_MUSIC',
  'SOCIAL', 'COMMUNICATION', 'ENTERTAINMENT',
]);

const MID_TIER_CATEGORIES = new Set([
  'SHOPPING', 'FINANCE', 'TRAVEL_AND_LOCAL', 'PHOTOGRAPHY',
  'MUSIC_AND_AUDIO', 'VIDEO_PLAYERS', 'NEWS_AND_MAGAZINES',
]);

function isBrandBlacklisted(developerName) {
  const lower = (developerName || '').toLowerCase();
  return BRAND_BLACKLIST.some(brand => lower.includes(brand));
}

function scoreDevSize(appCount) {
  if (appCount === 1) return 25;
  if (appCount <= 3) return 20;
  if (appCount <= 5) return 15;
  if (appCount <= 10) return 5;
  return 0;
}

function scoreInstalls(installs) {
  if (installs >= 50_000 && installs <= 500_000) return 25;
  if (installs >= 10_000 && installs < 50_000) return 20;
  if (installs > 500_000 && installs <= 2_000_000) return 15;
  if (installs > 2_000_000 && installs <= 5_000_000) return 5;
  return 0;
}

function scoreMonetization(app) {
  const paid = !app.free && app.price > 0;
  const iap = !!app.offersIAP;
  if (paid && iap) return 20;
  if (iap) return 15;
  if (paid) return 10;
  return 0;
}

function scoreCategoryNiche(genreId) {
  if (!genreId) return 10;
  if (COMPETITIVE_CATEGORIES.has(genreId)) return 0;
  if (MID_TIER_CATEGORIES.has(genreId)) return 10;
  return 15;
}

function scoreRating(score) {
  if (score == null || score <= 0) return 0;
  if (score >= 4.0 && score <= 4.7) return 15;
  if (score >= 3.5) return 10;
  if (score >= 3.0) return 5;
  return 0;
}

function calculateGemScore(app, devAppCount) {
  const devScore = scoreDevSize(devAppCount);
  const installScore = scoreInstalls(app.minInstalls || 0);
  const monetizationScore = scoreMonetization(app);
  const categoryScore = scoreCategoryNiche(app.genreId || app.genre);
  const ratingScore = scoreRating(app.score);

  const total = devScore + installScore + monetizationScore + categoryScore + ratingScore;

  const reasons = [];
  if (devAppCount <= 3) reasons.push(`Solo dev (${devAppCount} app${devAppCount > 1 ? 's' : ''})`);
  if (app.minInstalls) reasons.push(`${formatInstalls(app.minInstalls)} downloads`);
  if (app.offersIAP) reasons.push('Monetized via IAP');
  else if (!app.free) reasons.push(`Paid ($${app.price?.toFixed(2)})`);
  if (app.score) reasons.push(`${app.score.toFixed(1)} stars`);

  return {
    total,
    breakdown: { devScore, installScore, monetizationScore, categoryScore, ratingScore },
    reason: reasons.join(' | '),
  };
}

const NICHE_CATEGORIES = Object.keys(CATEGORIES).filter(
  k => !COMPETITIVE_CATEGORIES.has(k) && k !== 'APPLICATION' && k !== 'ANDROID_WEAR' &&
       k !== 'WATCH_FACE' && k !== 'LIBRARIES_AND_DEMO'
);

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

  const seen = new Map();
  for (const app of allApps) {
    if (app.appId && !seen.has(app.appId)) seen.set(app.appId, app);
  }
  const unique = Array.from(seen.values());

  // Pre-filter: remove obviously unqualified apps
  const candidates = unique.filter(app => {
    if (!app.developerId) return false;
    if ((app.minInstalls || 0) > 10_000_000) return false;
    if ((app.minInstalls || 0) < 1_000) return false;
    if (isBrandBlacklisted(app.developer)) return false;
    return true;
  });

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

function formatInstalls(num) {
  if (!num) return '0';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toString();
}
