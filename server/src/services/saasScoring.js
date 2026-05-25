export const SAAS_BRAND_BLACKLIST = [
  'salesforce', 'hubspot', 'adobe', 'microsoft', 'google', 'amazon', 'oracle',
  'sap', 'workday', 'servicenow', 'atlassian', 'slack', 'zoom', 'dropbox',
  'shopify', 'stripe', 'paypal', 'intuit', 'quickbooks', 'mailchimp',
  'zendesk', 'twilio', 'datadog', 'snowflake', 'databricks', 'mongodb',
  'cloudflare', 'okta', 'crowdstrike', 'palo alto', 'cisco', 'ibm',
];

export const CROWDED_CATEGORIES = new Set([
  'CRM', 'Marketing', 'Email', 'Support', 'Project Management',
]);

export const NICHE_SAAS_CATEGORIES = new Set([
  'DevTools', 'Analytics', 'Security', 'HR', 'Finance', 'No-code',
  'AI/ML', 'Design', 'Productivity',
]);

function scoreTraction(phUpvotes) {
  if (phUpvotes == null) return 10;
  if (phUpvotes >= 50 && phUpvotes <= 500) return 25;
  if (phUpvotes >= 20 && phUpvotes < 50) return 18;
  if (phUpvotes > 500 && phUpvotes <= 1500) return 12;
  if (phUpvotes > 1500) return 5;
  return 8;
}

function scorePricing(product) {
  const model = product.pricingModel || product.pricing_model;
  const hint = product.pricingHint || product.pricing_hint;
  if (model === 'freemium' && hint) return 20;
  if (model === 'subscription' && hint) return 18;
  if (model === 'freemium' || model === 'subscription') return 14;
  if (model === 'free') return 8;
  if (hint) return 10;
  return 0;
}

function scoreCategoryNiche(category) {
  if (!category) return 10;
  if (CROWDED_CATEGORIES.has(category)) return 5;
  if (NICHE_SAAS_CATEGORIES.has(category)) return 20;
  return 12;
}

function scoreRecency(phLaunchedAt) {
  if (!phLaunchedAt) return 5;
  const launched = new Date(phLaunchedAt);
  if (Number.isNaN(launched.getTime())) return 5;
  const monthsAgo = (Date.now() - launched.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsAgo <= 12) return 15;
  if (monthsAgo <= 24) return 10;
  if (monthsAgo <= 36) return 5;
  return 2;
}

function scoreEngagement(phUpvotes, phComments, tagline) {
  let score = 0;
  if (phUpvotes > 0 && phComments != null) {
    const ratio = phComments / phUpvotes;
    if (ratio >= 0.05 && ratio <= 0.3) score += 12;
    else if (ratio > 0) score += 8;
  }
  const tag = (tagline || '').trim();
  if (tag.length >= 30 && tag.length <= 120) score += 8;
  else if (tag.length >= 15) score += 4;
  return Math.min(score, 20);
}

export function isSaasBrandBlacklisted(name) {
  const lower = (name || '').toLowerCase();
  return SAAS_BRAND_BLACKLIST.some(brand => lower.includes(brand));
}

export function calculateSaasOpportunityScore(product) {
  const tractionScore = scoreTraction(product.phUpvotes);
  const pricingScore = scorePricing(product);
  const categoryScore = scoreCategoryNiche(product.category);
  const recencyScore = scoreRecency(product.phLaunchedAt);
  const engagementScore = scoreEngagement(product.phUpvotes, product.phComments, product.tagline);

  const total = tractionScore + pricingScore + categoryScore + recencyScore + engagementScore;

  const reasons = [];
  if (product.phUpvotes) reasons.push(`${product.phUpvotes} PH upvotes`);
  if (product.pricingModel && product.pricingModel !== 'unknown') {
    reasons.push(product.pricingModel);
  }
  if (product.category) reasons.push(product.category);
  if (product.phLaunchedAt) {
    const d = new Date(product.phLaunchedAt);
    if (!Number.isNaN(d.getTime())) reasons.push(`Launched ${d.toLocaleDateString()}`);
  }

  return {
    total,
    breakdown: {
      tractionScore,
      pricingScore,
      categoryScore,
      recencyScore,
      engagementScore,
    },
    reason: reasons.join(' | ') || 'Seed catalogue entry',
  };
}

export function isSaasOpportunityCandidate(product, minScore = 40) {
  if (isSaasBrandBlacklisted(product.name)) return false;
  const score = product.opportunityScore ?? calculateSaasOpportunityScore(product).total;
  return score >= minScore;
}
