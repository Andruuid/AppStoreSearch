import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  upsertSaasProduct, getSaasProductCount, normalizeSaasUrl, saasIdFromUrlKey,
  getSaasProductByUrlKey,
} from '../db/saasQueries.js';
import { calculateSaasOpportunityScore } from './saasScoring.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', '..', 'data', 'saas_seed.json');

export function loadSeedData() {
  if (!fs.existsSync(SEED_PATH)) {
    throw new Error(`Seed file not found: ${SEED_PATH}`);
  }
  const raw = fs.readFileSync(SEED_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('Seed file must be a JSON array');
  return data;
}

export async function importSeedProducts({ rescore = true } = {}) {
  const seed = loadSeedData();
  let added = 0;
  let updated = 0;

  for (const entry of seed) {
    if (!entry.name || !entry.url) continue;

    const urlKey = normalizeSaasUrl(entry.url);
    const existed = await getSaasProductByUrlKey(urlKey);

    const product = {
      id: saasIdFromUrlKey(urlKey),
      name: entry.name,
      url: entry.url.startsWith('http') ? entry.url : `https://${entry.url}`,
      urlKey,
      category: entry.category || null,
      tags: entry.tags || [],
      pricingModel: entry.pricing_model || entry.pricingModel || 'unknown',
      source: 'seed',
      enrichmentStatus: 'pending',
    };

    if (rescore) {
      const score = calculateSaasOpportunityScore(product);
      product.opportunityScore = score.total;
      product.opportunityBreakdown = score.breakdown;
      product.opportunityReason = score.reason;
    }

    await upsertSaasProduct(product);
    if (existed) updated++;
    else added++;
  }

  return { added, updated, total: seed.length };
}

export async function ensureSeedImported() {
  const count = await getSaasProductCount();
  if (count === 0) {
    const result = await importSeedProducts();
    console.log(`SaaS seed imported: ${result.added} products`);
    return result;
  }
  return null;
}

export { SEED_PATH };
