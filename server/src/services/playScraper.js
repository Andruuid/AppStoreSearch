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
  FINANCE: ['budget tracker', 'expense manager', 'invoice app', 'tax calculator', 'stock portfolio', 'savings app', 'debt tracker', 'crypto portfolio'],
  HEALTH_AND_FITNESS: ['calorie counter', 'workout tracker', 'step counter', 'meditation timer', 'water reminder', 'sleep tracker', 'habit tracker'],
  PRODUCTIVITY: ['todo list', 'note taking', 'time tracker', 'pomodoro timer', 'habit tracker', 'journal app', 'task planner'],
  EDUCATION: ['flashcard app', 'language learning', 'math practice', 'quiz maker', 'study planner', 'vocabulary builder'],
  FOOD_AND_DRINK: ['recipe app', 'meal planner', 'calorie tracker', 'restaurant finder', 'food diary', 'grocery list'],
  BUSINESS: ['invoice generator', 'crm app', 'project manager', 'time tracker', 'business card scanner', 'accounting app'],
  LIFESTYLE: ['daily planner', 'vision board', 'gratitude journal', 'bucket list', 'countdown app', 'wardrobe organizer'],
  TOOLS: ['qr code scanner', 'unit converter', 'calculator app', 'file manager', 'compass app', 'flashlight app'],
  TRAVEL_AND_LOCAL: ['trip planner', 'packing list', 'currency converter', 'flight tracker', 'travel journal', 'offline maps'],
  WEATHER: ['weather radar', 'storm tracker', 'weather widget', 'rain alert', 'weather forecast', 'wind speed app', 'barometer app', 'uv index tracker', 'pollen forecast', 'tide chart'],
  SHOPPING: ['price comparison', 'coupon app', 'wishlist app', 'barcode scanner', 'deal finder', 'shopping list', 'price tracker', 'cashback app', 'receipt scanner', 'sale alert'],
  SPORTS: ['score tracker', 'workout log', 'golf scorecard', 'run tracker', 'sports stats', 'tennis scorer', 'fishing log', 'bowling score', 'dart scorer', 'swimming tracker', 'cycling tracker', 'ski tracker'],
  PHOTOGRAPHY: ['photo editor', 'collage maker', 'camera filter', 'watermark app', 'photo organizer'],
  MEDICAL: ['pill reminder', 'symptom checker', 'blood pressure log', 'pregnancy tracker', 'first aid app', 'medication tracker', 'diabetes log', 'mental health journal', 'doctor appointment', 'allergy tracker', 'heart rate monitor', 'health diary', 'medical calculator', 'hearing test', 'vision test'],
  HOUSE_AND_HOME: ['home budget', 'interior design', 'plant care', 'cleaning schedule', 'moving checklist', 'home inventory', 'garden planner', 'paint color picker', 'room planner', 'utility bill tracker'],
  PARENTING: ['chore tracker', 'allowance app', 'chore chart', 'kids chores', 'family organizer', 'kids rewards', 'baby tracker', 'screen time kids'],
  FAMILY: ['family chores', 'kids allowance', 'family calendar', 'chore app kids', 'family budget', 'parental control'],
  DATING: ['dating app', 'matchmaker', 'relationship tracker', 'couples app', 'love language', 'date planner', 'couples quiz', 'anniversary reminder', 'relationship goals', 'date ideas'],
  EVENTS: ['event planner', 'countdown timer', 'invitation maker', 'rsvp app', 'party planner', 'guest list manager', 'seating chart', 'wedding planner', 'birthday reminder', 'event checklist'],
  BEAUTY: ['skincare routine', 'makeup tutorial', 'hair color', 'beauty tracker', 'nail art', 'face shape analyzer', 'skin type test', 'ingredient checker', 'beauty diary', 'lip color try on'],
  ART_AND_DESIGN: ['drawing app', 'color palette', 'sketch pad', 'logo maker', 'font app'],
  AUTO_AND_VEHICLES: ['car maintenance', 'fuel tracker', 'mileage log', 'obd scanner', 'parking app'],
  BOOKS_AND_REFERENCE: ['book tracker', 'reading list', 'dictionary app', 'bible app', 'audiobook player'],
  COMICS: ['comic reader', 'manga reader', 'webtoon app', 'comic creator', 'comic book collection', 'manga downloader', 'comic strip maker', 'panel layout', 'comic scanner', 'graphic novel reader'],
  MAPS_AND_NAVIGATION: ['gps tracker', 'route planner', 'hiking map', 'speed camera alert', 'trail finder', 'distance calculator', 'area measure', 'geocaching', 'compass navigation', 'elevation tracker'],
  PERSONALIZATION: ['wallpaper app', 'icon pack', 'widget maker', 'ringtone maker', 'launcher app'],
};

export function getKeywordsForCategory(categoryId) {
  const keywords = CATEGORY_KEYWORDS[categoryId];
  if (keywords) return keywords;
  const label = categoryId?.replace(/_/g, ' ').toLowerCase() || 'app';
  return [`${label} app`, `${label} tracker`, `best ${label}`];
}
