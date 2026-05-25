import * as cheerio from 'cheerio';
import {
  getSaasProductById, updateSaasProduct, getPendingEnrichmentProducts,
} from '../db/saasQueries.js';
import { calculateSaasOpportunityScore } from './saasScoring.js';

const USER_AGENT = 'NicheFinder/1.0 (SaaS catalogue enrichment)';
const FETCH_TIMEOUT_MS = 10000;
const RATE_LIMIT_MS = 1000;

let enrichState = {
  running: false,
  processed: 0,
  total: 0,
  currentUrl: null,
  errors: 0,
  stoppedReason: null,
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractMeta($) {
  const get = (sel, attr) => $(sel).attr(attr) || null;
  return {
    title: get('meta[property="og:title"]', 'content')
      || get('meta[name="twitter:title"]', 'content')
      || $('title').first().text()?.trim() || null,
    description: get('meta[property="og:description"]', 'content')
      || get('meta[name="description"]', 'content')
      || get('meta[name="twitter:description"]', 'content') || null,
    image: get('meta[property="og:image"]', 'content')
      || get('meta[name="twitter:image"]', 'content') || null,
  };
}

function detectPricingModel(text) {
  const lower = (text || '').toLowerCase();
  if (/free (forever|plan|tier)|start free|free to use/.test(lower)) {
    if (/(\$\d|\/mo|per month|per user)/.test(lower)) return 'freemium';
    return 'free';
  }
  if (/freemium|free plan|free tier/.test(lower)) return 'freemium';
  if (/(\$\d|\/mo|per month|per user|subscription|billed annually)/.test(lower)) {
    return 'subscription';
  }
  if (/one[- ]time|lifetime deal|pay once/.test(lower)) return 'one_time';
  return 'unknown';
}

function extractPricingHint($, bodyText) {
  const pricePatterns = [
    /(?:from|starting at|starts at)\s*\$[\d,.]+(?:\s*\/?\s*(?:mo|month|user|yr|year))?/gi,
    /\$[\d,.]+\s*(?:\/\s*(?:mo|month|user|yr|year))/gi,
    /free (?:forever|plan|tier)/gi,
  ];
  for (const pattern of pricePatterns) {
    const match = bodyText.match(pattern);
    if (match?.[0]) return match[0].trim().slice(0, 80);
  }
  const pricingEl = $('[class*="pricing"], [id*="pricing"], [data-pricing]').first().text();
  if (pricingEl) {
    for (const pattern of pricePatterns) {
      const match = pricingEl.match(pattern);
      if (match?.[0]) return match[0].trim().slice(0, 80);
    }
  }
  return null;
}


async function tryFetchPricingPage(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');
  const candidates = [`${base}/pricing`, `${base}/plans`, `${base}/price`];
  for (const url of candidates) {
    try {
      const html = await fetchHtml(url);
      return { html, url };
    } catch {
      // try next
    }
  }
  return null;
}

export async function enrichSaasProduct(product) {
  const url = product.url;
  if (!url) throw new Error('Product has no URL');

  let mainHtml;
  try {
    mainHtml = await fetchHtml(url);
  } catch (err) {
    await updateSaasProduct(product.id, {
      enrichmentStatus: 'failed',
      enrichmentError: err.message,
    });
    throw err;
  }

  const $ = cheerio.load(mainHtml);
  const meta = extractMeta($);
  const bodyText = $('body').text().replace(/\s+/g, ' ').slice(0, 8000);

  let pricingHtml = null;
  const pricingPage = await tryFetchPricingPage(url);
  if (pricingPage) {
    pricingHtml = pricingPage.html;
    await sleep(RATE_LIMIT_MS);
  }

  const pricingText = pricingHtml
    ? cheerio.load(pricingHtml)('body').text().replace(/\s+/g, ' ')
    : bodyText;

  const pricingModel = detectPricingModel(pricingText) !== 'unknown'
    ? detectPricingModel(pricingText)
    : (product.pricingModel && product.pricingModel !== 'unknown'
      ? product.pricingModel
      : detectPricingModel(bodyText));

  const pricingHint = extractPricingHint(
    pricingHtml ? cheerio.load(pricingHtml) : $,
    pricingText,
  );

  const updates = {
    name: product.name || meta.title,
    tagline: product.tagline || meta.description?.slice(0, 160) || null,
    description: meta.description || product.description || null,
    logoUrl: meta.image || product.logoUrl || null,
    pricingModel,
    pricingHint: pricingHint || product.pricingHint || null,
    enrichmentStatus: 'done',
    enrichmentError: null,
    lastEnrichedAt: new Date().toISOString(),
  };

  const merged = { ...product, ...updates };
  const score = calculateSaasOpportunityScore(merged);
  updates.opportunityScore = score.total;
  updates.opportunityBreakdown = score.breakdown;
  updates.opportunityReason = score.reason;

  return updateSaasProduct(product.id, updates);
}

export function getEnrichStatus() {
  return { ...enrichState };
}

export async function runEnrichment({ budget = 50 } = {}) {
  if (enrichState.running) {
    return { error: 'Enrichment already running', ...enrichState };
  }

  const pending = await getPendingEnrichmentProducts(budget);
  enrichState = {
    running: true,
    processed: 0,
    total: pending.length,
    currentUrl: null,
    errors: 0,
    stoppedReason: null,
  };

  try {
    for (const product of pending) {
      if (enrichState.processed >= budget) {
        enrichState.stoppedReason = 'budget_exhausted';
        break;
      }

      enrichState.currentUrl = product.url;
      try {
        await enrichSaasProduct(product);
      } catch {
        enrichState.errors++;
      }
      enrichState.processed++;
      await sleep(RATE_LIMIT_MS);
    }

    if (!enrichState.stoppedReason) {
      enrichState.stoppedReason = pending.length === 0 ? 'no_pending' : 'complete';
    }
  } catch (err) {
    enrichState.stoppedReason = `error: ${err.message}`;
  } finally {
    enrichState.running = false;
    enrichState.currentUrl = null;
  }

  return getEnrichStatus();
}

export async function enrichSaasProductById(id) {
  const product = await getSaasProductById(id);
  if (!product) throw new Error('Product not found');
  return enrichSaasProduct(product);
}
