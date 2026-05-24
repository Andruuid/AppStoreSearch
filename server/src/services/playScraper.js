import { createRequire } from 'module';
import { upsertApps, upsertDeveloper, getCachedDeveloper, getCachedSearch, setCachedSearch } from '../db/queries.js';

const require = createRequire(import.meta.url);
const gplay = require('google-play-scraper');

export const CATEGORIES = gplay.category;
export const COLLECTIONS = gplay.collection;

export async function searchApps(opts = {}) {
  const cacheKey = `search:${opts.term}:${opts.num || 30}:${opts.price || 'all'}:${opts.fullDetail ?? false}`;
  const cached = await getCachedSearch(cacheKey);
  if (cached) return cached;

  const results = await gplay.search({
    term: opts.term,
    num: opts.num || 30,
    fullDetail: opts.fullDetail ?? false,
    price: opts.price || 'all',
    lang: opts.lang || 'en',
    country: opts.country || 'us',
  });
  await cacheResults(results);
  await setCachedSearch(cacheKey, results);
  return results;
}

export async function listApps(opts = {}) {
  const cat = opts.category || gplay.category.APPLICATION;
  const col = opts.collection || gplay.collection.TOP_FREE;
  const num = opts.num || 100;
  const cacheKey = `list:${cat}:${col}:${num}`;
  const cached = await getCachedSearch(cacheKey);
  if (cached) return cached;

  const results = await gplay.list({
    category: cat,
    collection: col,
    num,
    fullDetail: false,
    lang: opts.lang || 'en',
    country: opts.country || 'us',
  });
  await cacheResults(results);
  await setCachedSearch(cacheKey, results);
  return results;
}

export async function getAppDetail(appId) {
  const result = await gplay.app({ appId, lang: 'en', country: 'us' });
  await cacheResults([result]);
  return result;
}

export async function getAppDetails(appIds) {
  const results = [];
  for (const appId of appIds) {
    try {
      const result = await gplay.app({ appId, lang: 'en', country: 'us' });
      results.push(result);
    } catch {
      // Skip apps that fail to load
    }
  }
  await cacheResults(results);
  return results;
}

export async function getDeveloperApps(devId) {
  const cached = await getCachedDeveloper(devId);
  if (cached) return { ...cached, fromCache: true };

  const apps = await gplay.developer({ devId, num: 60, lang: 'en', country: 'us' });
  const appCount = Array.isArray(apps) ? apps.length : 0;
  const name = apps?.[0]?.developer || devId;
  await upsertDeveloper({ devId, name, appCount });
  await cacheResults(Array.isArray(apps) ? apps : []);
  return { devId, name, appCount, apps: apps || [] };
}

export async function getSimilarApps(appId) {
  const results = await gplay.similar({ appId, lang: 'en', country: 'us', fullDetail: false });
  await cacheResults(results);
  return results;
}

export async function getCategories() {
  return Object.entries(CATEGORIES).map(([key, value]) => ({ id: value, label: key.replace(/_/g, ' ') }));
}

async function cacheResults(results) {
  if (Array.isArray(results) && results.length > 0) {
    await upsertApps(results).catch(() => {});
  }
}

const CATEGORY_KEYWORDS = {
  FINANCE: [
    'budget tracker', 'expense manager', 'invoice app', 'tax calculator', 'stock portfolio',
    'savings app', 'debt tracker', 'crypto portfolio', 'bill reminder', 'net worth tracker',
    'receipt scanner', 'split bill app', 'tip calculator', 'loan calculator', 'mortgage calculator',
  ],
  HEALTH_AND_FITNESS: [
    'calorie counter', 'workout tracker', 'step counter', 'meditation timer', 'water reminder',
    'sleep tracker', 'habit tracker', 'yoga app', 'stretching routine', 'macro tracker',
    'fasting tracker', 'body measurement', 'gym log', 'running coach', 'breathing exercise',
  ],
  PRODUCTIVITY: [
    'todo list', 'note taking', 'time tracker', 'pomodoro timer', 'habit tracker',
    'journal app', 'task planner', 'focus timer', 'daily planner', 'checklist app',
    'meeting notes', 'goal tracker', 'kanban board', 'mind map app', 'password manager',
  ],
  EDUCATION: [
    'flashcard app', 'language learning', 'math practice', 'quiz maker', 'study planner',
    'vocabulary builder', 'spelling practice', 'typing tutor', 'coding for kids', 'science quiz',
    'periodic table', 'geography quiz', 'piano learning', 'guitar chords', 'homework planner',
  ],
  FOOD_AND_DRINK: [
    'recipe app', 'meal planner', 'calorie tracker', 'restaurant finder', 'food diary',
    'grocery list', 'cocktail recipes', 'wine tracker', 'coffee timer', 'baking recipes',
    'food scale app', 'allergy food scanner', 'meal prep planner', 'water intake food',
  ],
  BUSINESS: [
    'invoice generator', 'crm app', 'project manager', 'time tracker', 'business card scanner',
    'accounting app', 'expense report', 'inventory tracker', 'employee schedule', 'contract template',
    'proposal maker', 'client portal', 'freelance invoice', 'mileage expense', 'quote generator',
  ],
  LIFESTYLE: [
    'daily planner', 'vision board', 'gratitude journal', 'bucket list', 'countdown app',
    'wardrobe organizer', 'mood tracker', 'life goals app', 'affirmation app', 'minimalist tracker',
    'capsule wardrobe', 'self care planner', 'morning routine', 'digital detox',
  ],
  TOOLS: [
    'qr code scanner', 'unit converter', 'calculator app', 'file manager', 'compass app',
    'flashlight app', 'level tool', 'magnifier app', 'color picker tool', 'stopwatch timer',
    'decibel meter', 'speed test app', 'battery monitor', 'clipboard manager', 'zip file manager',
  ],
  TRAVEL_AND_LOCAL: [
    'trip planner', 'packing list', 'currency converter', 'flight tracker', 'travel journal',
    'offline maps', 'travel budget', 'hotel finder', 'road trip planner', 'travel checklist',
    'luggage tracker', 'timezone converter', 'travel phrasebook', 'camping checklist',
  ],
  WEATHER: [
    'weather radar', 'storm tracker', 'weather widget', 'rain alert', 'weather forecast',
    'wind speed app', 'barometer app', 'uv index tracker', 'pollen forecast', 'tide chart',
    'snow forecast', 'humidity monitor', 'air quality app', 'sunrise sunset', 'weather history',
  ],
  SHOPPING: [
    'price comparison', 'coupon app', 'wishlist app', 'barcode scanner', 'deal finder',
    'shopping list', 'price tracker', 'cashback app', 'receipt scanner', 'sale alert',
    'grocery deals', 'thrift finder', 'subscription tracker', 'return reminder', 'size converter',
  ],
  SPORTS: [
    'score tracker', 'workout log', 'golf scorecard', 'run tracker', 'sports stats',
    'tennis scorer', 'fishing log', 'bowling score', 'dart scorer', 'swimming tracker',
    'cycling tracker', 'ski tracker', 'basketball stats', 'soccer score', 'volleyball score',
    'pickleball score', 'climbing log', 'surf tracker', 'hiking log',
  ],
  PHOTOGRAPHY: [
    'photo editor', 'collage maker', 'camera filter', 'watermark app', 'photo organizer',
    'exif viewer', 'photo resizer', 'background remover', 'photo metadata', 'timelapse camera',
    'photo backup', 'lens calculator', 'photo histogram',
  ],
  MEDICAL: [
    'pill reminder', 'symptom checker', 'blood pressure log', 'pregnancy tracker', 'first aid app',
    'medication tracker', 'diabetes log', 'mental health journal', 'doctor appointment', 'allergy tracker',
    'heart rate monitor', 'health diary', 'medical calculator', 'hearing test', 'vision test',
    'period tracker', 'vaccine record', 'pain diary', 'sleep apnea', 'BMI calculator medical',
  ],
  HOUSE_AND_HOME: [
    'home budget', 'interior design', 'plant care', 'cleaning schedule', 'moving checklist',
    'home inventory', 'garden planner', 'paint color picker', 'room planner', 'utility bill tracker',
    'smart home control', 'home maintenance', 'furniture layout', 'pest control log', 'appliance manual',
  ],
  PARENTING: [
    'chore tracker', 'allowance app', 'chore chart', 'kids chores', 'family organizer',
    'kids rewards', 'baby tracker', 'screen time kids', 'potty training', 'kids timer',
    'breastfeeding log', 'baby sleep tracker', 'kids homework', 'family chore wheel',
  ],
  FAMILY: [
    'family chores', 'kids allowance', 'family calendar', 'chore app kids', 'family budget',
    'parental control', 'family locator', 'shared shopping list', 'family meal planner', 'kids activity planner',
  ],
  DATING: [
    'dating app', 'matchmaker', 'relationship tracker', 'couples app', 'love language',
    'date planner', 'couples quiz', 'anniversary reminder', 'relationship goals', 'date ideas',
    'long distance couples', 'relationship journal', 'gift ideas partner',
  ],
  EVENTS: [
    'event planner', 'countdown timer', 'invitation maker', 'rsvp app', 'party planner',
    'guest list manager', 'seating chart', 'wedding planner', 'birthday reminder', 'event checklist',
    'ticket scanner', 'event budget', 'vendor tracker', 'conference schedule',
  ],
  BEAUTY: [
    'skincare routine', 'makeup tutorial', 'hair color', 'beauty tracker', 'nail art',
    'face shape analyzer', 'skin type test', 'ingredient checker', 'beauty diary', 'lip color try on',
    'hair care routine', 'perfume tracker', 'makeup inventory', 'sunscreen reminder',
  ],
  ART_AND_DESIGN: [
    'drawing app', 'color palette', 'sketch pad', 'logo maker', 'font app',
    'pixel art', 'calligraphy practice', 'design mockup', 'vector editor', 'pattern maker',
    'color harmony', 'typography app', 'mood board design',
  ],
  AUTO_AND_VEHICLES: [
    'car maintenance', 'fuel tracker', 'mileage log', 'obd scanner', 'parking app',
    'tire pressure', 'car expense tracker', 'vehicle recall', 'driving log', 'car wash tracker',
    'EV charging finder', 'trip mileage', 'car service reminder',
  ],
  BOOKS_AND_REFERENCE: [
    'book tracker', 'reading list', 'dictionary app', 'bible app', 'audiobook player',
    'speed reading', 'book quotes', 'library catalog', 'thesaurus app', 'citation generator',
    'reading timer', 'book club organizer', 'ISBN scanner',
  ],
  COMICS: [
    'comic reader', 'manga reader', 'webtoon app', 'comic creator', 'comic book collection',
    'manga downloader', 'comic strip maker', 'panel layout', 'comic scanner', 'graphic novel reader',
    'comic price guide', 'manga tracker', 'webcomic reader',
  ],
  MAPS_AND_NAVIGATION: [
    'gps tracker', 'route planner', 'hiking map', 'speed camera alert', 'trail finder',
    'distance calculator', 'area measure', 'geocaching', 'compass navigation', 'elevation tracker',
    'offline hiking gps', 'coordinate converter', 'walking directions', 'park finder',
  ],
  PERSONALIZATION: [
    'wallpaper app', 'icon pack', 'widget maker', 'ringtone maker', 'launcher app',
    'theme customizer', 'lock screen maker', 'notification sounds', 'font changer', 'emoji keyboard',
  ],
  MUSIC_AND_AUDIO: [
    'music player', 'podcast player', 'audio recorder', 'metronome app', 'tuner app',
    'equalizer app', 'sleep sounds', 'white noise app', 'ringtone cutter', 'audio editor',
    'chord finder', 'sheet music reader', 'dj mixer app', 'lofi beats',
  ],
  NEWS_AND_MAGAZINES: [
    'news aggregator', 'rss reader', 'local news app', 'tech news app', 'magazine reader',
    'news digest', 'offline news reader', 'topic news tracker', 'newspaper app', 'news widget',
    'fact check app', 'news bookmark', 'headline tracker',
  ],
  VIDEO_PLAYERS: [
    'video player', 'subtitle downloader', 'video converter', 'media player', 'video editor simple',
    'video speed control', 'video bookmark', 'playlist manager', 'video trimmer', 'codec player',
    'floating video player', 'video organizer', '4k video player',
  ],
};

export function getKeywordsForCategory(categoryId) {
  const keywords = CATEGORY_KEYWORDS[categoryId];
  if (keywords) return keywords;
  const label = categoryId?.replace(/_/g, ' ').toLowerCase() || 'app';
  return [`${label} app`, `${label} tracker`, `best ${label}`];
}
