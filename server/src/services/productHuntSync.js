import {
  upsertSaasProduct, logSaasSync, normalizeSaasUrl, saasIdFromUrlKey,
} from '../db/saasQueries.js';
import { calculateSaasOpportunityScore } from './saasScoring.js';

const PH_API_URL = 'https://api.producthunt.com/v2/api/graphql';
const PH_TOKEN_URL = 'https://api.producthunt.com/v2/oauth/token';

let cachedAccessToken = null;
let tokenExpiresAt = 0;

let syncState = {
  running: false,
  processed: 0,
  added: 0,
  updated: 0,
  stoppedReason: null,
  error: null,
};

const POSTS_QUERY = `
  query RecentPosts($after: String) {
    posts(order: NEWEST, first: 20, after: $after) {
      edges {
        node {
          id
          name
          tagline
          url
          votesCount
          commentsCount
          createdAt
          thumbnail { url }
          topics { edges { node { name } } }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

async function fetchClientCredentialsToken() {
  const clientId = process.env.PRODUCT_HUNT_API_KEY;
  const clientSecret = process.env.PRODUCT_HUNT_API_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PRODUCT_HUNT_API_KEY and PRODUCT_HUNT_API_SECRET are not configured');
  }

  const res = await fetch(PH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Product Hunt OAuth failed (HTTP ${res.status})${body ? `: ${body.slice(0, 200)}` : ''}`);
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new Error('Product Hunt OAuth response missing access_token');
  }

  cachedAccessToken = json.access_token;
  // PH tokens are long-lived; refresh after 24h if no expires_in
  const ttlSec = json.expires_in || 86400;
  tokenExpiresAt = Date.now() + ttlSec * 1000;
  return cachedAccessToken;
}

async function getAccessToken() {
  if (process.env.PRODUCT_HUNT_TOKEN) {
    return process.env.PRODUCT_HUNT_TOKEN;
  }

  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  return fetchClientCredentialsToken();
}

async function phGraphQL(query, variables = {}) {
  const token = await getAccessToken();

  const res = await fetch(PH_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Product Hunt API HTTP ${res.status}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map(e => e.message).join('; '));
  }
  return json.data;
}

function mapPhPost(post) {
  const topics = post.topics?.edges?.map(e => e.node.name) || [];
  const category = topics[0] || 'Productivity';
  const url = post.url || `https://www.producthunt.com/posts/${post.id}`;
  const urlKey = normalizeSaasUrl(url);

  const product = {
    id: saasIdFromUrlKey(urlKey),
    name: post.name,
    url,
    urlKey,
    tagline: post.tagline,
    logoUrl: post.thumbnail?.url || null,
    category,
    tags: topics,
    source: 'product_hunt',
    productHuntId: post.id,
    phUpvotes: post.votesCount,
    phComments: post.commentsCount,
    phLaunchedAt: post.createdAt,
    enrichmentStatus: 'pending',
  };

  const score = calculateSaasOpportunityScore(product);
  product.opportunityScore = score.total;
  product.opportunityBreakdown = score.breakdown;
  product.opportunityReason = score.reason;

  return product;
}

export function getProductHuntSyncStatus() {
  return { ...syncState };
}

export async function syncProductHunt({ maxPages = 5 } = {}) {
  if (syncState.running) {
    return { error: 'Product Hunt sync already running', ...syncState };
  }

  syncState = {
    running: true,
    processed: 0,
    added: 0,
    updated: 0,
    stoppedReason: null,
    error: null,
  };

  try {
    let cursor = null;
    let pages = 0;

    while (pages < maxPages) {
      const data = await phGraphQL(POSTS_QUERY, { after: cursor });
      const posts = data.posts.edges.map(e => e.node);

      for (const post of posts) {
        const product = mapPhPost(post);
        const existing = await upsertSaasProduct(product);
        if (existing?.source === 'product_hunt' && existing.firstSeenAt) {
          syncState.updated++;
        } else {
          syncState.added++;
        }
        syncState.processed++;
      }

      pages++;
      if (!data.posts.pageInfo.hasNextPage) break;
      cursor = data.posts.pageInfo.endCursor;
    }

    syncState.stoppedReason = 'complete';
    await logSaasSync({
      syncType: 'product_hunt',
      status: 'complete',
      itemsAdded: syncState.added,
      itemsUpdated: syncState.updated,
    });
  } catch (err) {
    syncState.error = err.message;
    syncState.stoppedReason = 'error';
    await logSaasSync({
      syncType: 'product_hunt',
      status: 'error',
      itemsAdded: syncState.added,
      itemsUpdated: syncState.updated,
      error: err.message,
    });
  } finally {
    syncState.running = false;
  }

  return getProductHuntSyncStatus();
}

export function isProductHuntConfigured() {
  return !!(
    process.env.PRODUCT_HUNT_TOKEN
    || (process.env.PRODUCT_HUNT_API_KEY && process.env.PRODUCT_HUNT_API_SECRET)
  );
}
