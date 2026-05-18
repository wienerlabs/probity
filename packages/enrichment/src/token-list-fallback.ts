// Fallback enrichment sources for mints whose on-chain Metaplex
// metadata is absent or thin. Many widely-held tokens (wSOL, USDC,
// USDT) predate the current Metaplex spec and surface only via the
// legacy solana-labs/token-list. We pull two off-chain sources:
//
//   1. Jupiter v2 lite search (lite-api.jup.ag): name, symbol, website,
//      twitter, dev wallet, verified flag, holder count, organic volume.
//   2. Birdeye token_overview (public-api.birdeye.so): rich description
//      text, github, coingeckoId, market liquidity. Birdeye is keyed —
//      callers pass an api key or we skip it.
//
// Both calls are size + timeout capped, never throw — failures collapse
// into warnings the caller can surface to the user.

import type { DocumentSource } from "./enrich";

export interface TokenListFallbackOptions {
  fetchImpl?: typeof fetch;
  birdeyeApiKey?: string;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface TokenListFallbackResult {
  documents: DocumentSource[];
  warnings: string[];
  /** URLs discovered (website / twitter / etc) the caller can fetch further. */
  links: {
    website?: string;
    twitter?: string;
    github?: string;
    logo?: string;
    coingeckoId?: string;
  };
}

const DEFAULT_TIMEOUT_MS = 4_000;
const DEFAULT_MAX_BYTES = 32 * 1024;

const JUP_BASE = "https://lite-api.jup.ag/tokens/v2/search";
const BIRDEYE_BASE = "https://public-api.birdeye.so/defi/token_overview";

interface JupV2Token {
  id?: string;
  name?: string;
  symbol?: string;
  icon?: string;
  decimals?: number;
  isVerified?: boolean;
  twitter?: string;
  discord?: string;
  website?: string;
  dev?: string;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  holderCount?: number;
  fdv?: number;
  mcap?: number;
  usdPrice?: number;
  liquidity?: number;
  organicScore?: number;
  organicScoreLabel?: string;
  tags?: string[];
  cexes?: string[];
  audit?: {
    mintAuthorityDisabled?: boolean;
    freezeAuthorityDisabled?: boolean;
    topHoldersPercentage?: number;
  };
}

interface BirdeyeOverview {
  data?: {
    name?: string;
    symbol?: string;
    description?: string | null;
    website?: string | null;
    logoURI?: string | null;
    logoUri?: string | null;
    extensions?: {
      description?: string;
      website?: string;
      twitter?: string;
      github?: string;
      coingeckoId?: string;
      telegram?: string;
    };
    liquidity?: number;
    price?: number;
  };
  success?: boolean;
}

export async function fetchTokenListFallback(
  mint: string,
  opts: TokenListFallbackOptions = {},
): Promise<TokenListFallbackResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  const documents: DocumentSource[] = [];
  const warnings: string[] = [];
  const links: {
    website?: string;
    twitter?: string;
    github?: string;
    logo?: string;
    coingeckoId?: string;
  } = {};

  // ---- Jupiter v2 search ----
  const jupUrl = `${JUP_BASE}?query=${encodeURIComponent(mint)}`;
  const jup = await fetchWithCaps<JupV2Token[]>(jupUrl, {
    fetchImpl,
    timeoutMs,
    maxBytes,
  });
  if ("error" in jup) {
    warnings.push(`Jupiter v2 search failed (${jup.error})`);
  } else {
    const match = Array.isArray(jup.body)
      ? jup.body.find((t) => t.id === mint) ?? jup.body[0]
      : undefined;
    if (match) {
      if (match.website) links.website = match.website;
      if (match.twitter) links.twitter = match.twitter;
      if (match.icon) links.logo = match.icon;
      documents.push({
        kind: "tokenomics",
        url: jupUrl,
        excerpt: jupExcerpt(match),
        contentHash: `sha256-len:${jup.bytes}`,
      });
    } else {
      warnings.push("Jupiter v2 search returned no entry for this mint.");
    }
  }

  // ---- Birdeye token_overview ----
  if (opts.birdeyeApiKey) {
    const birdUrl = `${BIRDEYE_BASE}?address=${encodeURIComponent(mint)}`;
    const bird = await fetchWithCaps<BirdeyeOverview>(birdUrl, {
      fetchImpl,
      timeoutMs,
      maxBytes,
      headers: {
        "x-chain": "solana",
        "X-API-KEY": opts.birdeyeApiKey,
      },
    });
    if ("error" in bird) {
      warnings.push(`Birdeye overview failed (${bird.error})`);
    } else {
      const d = bird.body?.data;
      if (d) {
        const desc = d.description || d.extensions?.description;
        const website = d.website || d.extensions?.website;
        const twitter = d.extensions?.twitter;
        const github = d.extensions?.github;
        const logo = (d.logoURI || d.logoUri) ?? undefined;
        const cg = d.extensions?.coingeckoId;
        if (website && !links.website) links.website = website;
        if (twitter && !links.twitter) links.twitter = twitter;
        if (github) links.github = github;
        if (logo && !links.logo) links.logo = logo;
        if (cg) links.coingeckoId = cg;
        documents.push({
          kind: "tokenomics",
          url: birdUrl,
          excerpt: birdeyeExcerpt(d, desc, website, twitter, github),
          contentHash: `sha256-len:${bird.bytes}`,
        });
      } else {
        warnings.push("Birdeye overview returned no data for this mint.");
      }
    }
  }

  return { documents, warnings, links };
}

function jupExcerpt(t: JupV2Token): string {
  const lines = ["source: jupiter.v2.search"];
  if (t.name) lines.push(`name: ${t.name}`);
  if (t.symbol) lines.push(`symbol: ${t.symbol}`);
  if (t.isVerified !== undefined) lines.push(`verified: ${t.isVerified}`);
  if (t.tags && t.tags.length) lines.push(`tags: ${t.tags.join(", ")}`);
  if (t.cexes && t.cexes.length) lines.push(`cex_listings: ${t.cexes.join(", ")}`);
  if (t.website) lines.push(`website: ${t.website}`);
  if (t.twitter) lines.push(`twitter: ${t.twitter}`);
  if (t.discord) lines.push(`discord: ${t.discord}`);
  if (t.dev) lines.push(`dev_wallet: ${t.dev}`);
  if (t.organicScore !== undefined)
    lines.push(`organic_score: ${t.organicScore.toFixed(2)} (${t.organicScoreLabel ?? "?"})`);
  if (t.holderCount !== undefined)
    lines.push(`holder_count: ${t.holderCount}`);
  if (t.liquidity !== undefined)
    lines.push(`usd_liquidity: ${t.liquidity.toFixed(0)}`);
  if (t.mcap !== undefined) lines.push(`mcap_usd: ${t.mcap.toFixed(0)}`);
  if (t.audit) {
    lines.push(
      `audit: mint_disabled=${t.audit.mintAuthorityDisabled ?? "?"} freeze_disabled=${t.audit.freezeAuthorityDisabled ?? "?"} top_holders_pct=${t.audit.topHoldersPercentage ?? "?"}`,
    );
  }
  return lines.join("\n");
}

function birdeyeExcerpt(
  d: NonNullable<BirdeyeOverview["data"]>,
  desc: string | undefined,
  website: string | undefined,
  twitter: string | undefined,
  github: string | undefined,
): string {
  const lines = ["source: birdeye.token_overview"];
  if (d.name) lines.push(`name: ${d.name}`);
  if (d.symbol) lines.push(`symbol: ${d.symbol}`);
  if (desc) lines.push(`description: ${desc}`);
  if (website) lines.push(`website: ${website}`);
  if (twitter) lines.push(`twitter: ${twitter}`);
  if (github) lines.push(`github: ${github}`);
  if (d.extensions?.coingeckoId)
    lines.push(`coingecko: ${d.extensions.coingeckoId}`);
  if (d.extensions?.telegram)
    lines.push(`telegram: ${d.extensions.telegram}`);
  if (d.liquidity !== undefined)
    lines.push(`usd_liquidity: ${d.liquidity.toFixed(0)}`);
  if (d.price !== undefined)
    lines.push(`usd_price: ${d.price.toFixed(6)}`);
  return lines.join("\n");
}

// ----- shared fetch helper -----

interface FetchOk<T> {
  body: T;
  bytes: number;
}
interface FetchErr {
  error: string;
}
interface FetchOpts {
  fetchImpl: typeof fetch;
  timeoutMs: number;
  maxBytes: number;
  headers?: Record<string, string>;
}

async function fetchWithCaps<T>(
  url: string,
  opts: FetchOpts,
): Promise<FetchOk<T> | FetchErr> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs);
  try {
    const res = await opts.fetchImpl(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent":
          "Probity-Screening/1.0 (+https://probity.wienerlabs.com)",
        ...(opts.headers ?? {}),
      },
      signal: ac.signal,
      redirect: "follow",
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const text = await res.text();
    if (text.length > opts.maxBytes) {
      return { error: `response body exceeded ${opts.maxBytes} bytes` };
    }
    try {
      return { body: JSON.parse(text) as T, bytes: text.length };
    } catch (e) {
      return {
        error: `non-JSON body: ${
          e instanceof Error ? e.message : String(e)
        }`,
      };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}
