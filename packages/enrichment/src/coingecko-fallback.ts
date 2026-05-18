import type { DocumentSource } from "./enrich";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const PLATFORM = "solana";
const DEFAULT_TIMEOUT_MS = 6_000;
const DEFAULT_MAX_BYTES = 96 * 1024;

interface CGCoin {
  id?: string;
  symbol?: string;
  name?: string;
  description?: { en?: string };
  categories?: string[];
  platforms?: Record<string, string>;
  asset_platform_id?: string;
  market_cap_rank?: number | null;
  community_score?: number;
  liquidity_score?: number;
  public_interest_score?: number;
  image?: { thumb?: string; small?: string; large?: string };
  links?: {
    homepage?: string[];
    blockchain_site?: string[];
    twitter_screen_name?: string;
    facebook_username?: string;
    subreddit_url?: string;
    repos_url?: { github?: string[]; bitbucket?: string[] };
    official_forum_url?: string[];
    chat_url?: string[];
  };
  market_data?: {
    market_cap?: Record<string, number>;
    total_volume?: Record<string, number>;
    circulating_supply?: number;
    total_supply?: number;
    max_supply?: number | null;
  };
  community_data?: {
    twitter_followers?: number;
    reddit_subscribers?: number;
  };
  developer_data?: {
    stars?: number;
    forks?: number;
    commit_count_4_weeks?: number;
  };
  watchlist_portfolio_users?: number;
  sentiment_votes_up_percentage?: number;
  sentiment_votes_down_percentage?: number;
}

export interface CoingeckoFallbackOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  timeoutMs?: number;
  maxBytes?: number;
  platform?: string;
}

export interface CoingeckoFallbackResult {
  documents: DocumentSource[];
  warnings: string[];
  links: {
    homepage?: string;
    twitter?: string;
    github?: string;
    subreddit?: string;
    logo?: string;
    coingeckoId?: string;
  };
  categories: string[];
  marketCapRank?: number;
  trustScore?: number;
}

const HARAM_CATEGORY_HINTS = [
  /gambling/i,
  /casino/i,
  /betting/i,
  /lottery/i,
  /alcohol/i,
  /tobacco/i,
  /adult/i,
  /pornography/i,
  /cannabis/i,
  /weapons/i,
];

export function classifyCategoryHints(cats: string[]): {
  haram: string[];
  utility: string[];
  defi: string[];
} {
  const haram: string[] = [];
  const utility: string[] = [];
  const defi: string[] = [];
  for (const c of cats) {
    if (HARAM_CATEGORY_HINTS.some((rx) => rx.test(c))) haram.push(c);
    if (/(infrastructure|oracle|wallet|interoperability|bridge|cross[\s-]?chain)/i.test(c))
      utility.push(c);
    if (/(defi|dex|lending|yield|amm|stablecoin|liquid staking|derivatives)/i.test(c))
      defi.push(c);
  }
  return { haram, utility, defi };
}

export async function fetchCoingeckoFallback(
  mint: string,
  opts: CoingeckoFallbackOptions = {},
): Promise<CoingeckoFallbackResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const platform = opts.platform ?? PLATFORM;
  const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(platform)}/contract/${encodeURIComponent(mint)}`;

  const documents: DocumentSource[] = [];
  const warnings: string[] = [];
  const links: CoingeckoFallbackResult["links"] = {};
  let categories: string[] = [];
  let marketCapRank: number | undefined;
  let trustScore: number | undefined;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent":
          "Probity-Screening/1.0 (+https://probity.wienerlabs.com)",
        ...(opts.apiKey ? { "x-cg-demo-api-key": opts.apiKey } : {}),
      },
      signal: ac.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      warnings.push(`CoinGecko HTTP ${res.status}`);
      return { documents, warnings, links, categories };
    }
    const text = await res.text();
    if (text.length > maxBytes) {
      warnings.push(`CoinGecko body exceeded ${maxBytes} bytes`);
      return { documents, warnings, links, categories };
    }
    let coin: CGCoin;
    try {
      coin = JSON.parse(text) as CGCoin;
    } catch {
      warnings.push("CoinGecko returned non-JSON body");
      return { documents, warnings, links, categories };
    }

    categories = Array.isArray(coin.categories) ? coin.categories : [];
    if (typeof coin.market_cap_rank === "number") marketCapRank = coin.market_cap_rank;
    const cs = coin.community_score ?? 0;
    const ls = coin.liquidity_score ?? 0;
    const pis = coin.public_interest_score ?? 0;
    if (cs || ls || pis) trustScore = (cs + ls + pis) / 3;

    if (coin.links?.homepage && coin.links.homepage[0])
      links.homepage = coin.links.homepage[0];
    if (coin.links?.twitter_screen_name)
      links.twitter = `https://twitter.com/${coin.links.twitter_screen_name}`;
    if (coin.links?.subreddit_url) links.subreddit = coin.links.subreddit_url;
    const repos = coin.links?.repos_url?.github ?? [];
    if (repos[0]) links.github = repos[0];
    const cgLogo = coin.image?.large || coin.image?.small || coin.image?.thumb;
    if (cgLogo) links.logo = cgLogo;
    if (coin.id) links.coingeckoId = coin.id;

    const excerpt = buildExcerpt(coin, categories, marketCapRank, trustScore);
    documents.push({
      kind: "tokenomics",
      url,
      excerpt,
      contentHash: `sha256-len:${text.length}`,
    });
  } catch (e) {
    warnings.push(
      `CoinGecko fetch failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  return { documents, warnings, links, categories, ...(marketCapRank !== undefined ? { marketCapRank } : {}), ...(trustScore !== undefined ? { trustScore } : {}) };
}

function buildExcerpt(
  coin: CGCoin,
  categories: string[],
  marketCapRank: number | undefined,
  trustScore: number | undefined,
): string {
  const lines = ["source: coingecko.coins.contract"];
  if (coin.name) lines.push(`name: ${coin.name}`);
  if (coin.symbol) lines.push(`symbol: ${coin.symbol.toUpperCase()}`);
  if (coin.id) lines.push(`coingecko_id: ${coin.id}`);
  if (marketCapRank !== undefined) lines.push(`market_cap_rank: ${marketCapRank}`);
  if (trustScore !== undefined) lines.push(`trust_score: ${trustScore.toFixed(3)}`);

  if (categories.length) {
    lines.push(`categories: ${categories.slice(0, 25).join(", ")}`);
    const hints = classifyCategoryHints(categories);
    if (hints.haram.length) lines.push(`haram_hints: ${hints.haram.join(", ")}`);
    if (hints.utility.length) lines.push(`utility_hints: ${hints.utility.join(", ")}`);
    if (hints.defi.length) lines.push(`defi_hints: ${hints.defi.join(", ")}`);
  }

  if (coin.platforms) {
    const platforms = Object.keys(coin.platforms).filter((p) => coin.platforms![p]);
    if (platforms.length)
      lines.push(`platforms: ${platforms.slice(0, 12).join(", ")}`);
  }

  const desc = coin.description?.en;
  if (desc && desc.trim()) {
    lines.push(`description: ${desc.replace(/\s+/g, " ").slice(0, 1800)}`);
  }

  if (coin.links?.homepage?.[0]) lines.push(`homepage: ${coin.links.homepage[0]}`);
  if (coin.links?.twitter_screen_name)
    lines.push(`twitter: https://twitter.com/${coin.links.twitter_screen_name}`);
  if (coin.links?.subreddit_url) lines.push(`subreddit: ${coin.links.subreddit_url}`);
  const repos = coin.links?.repos_url?.github ?? [];
  if (repos[0]) lines.push(`github: ${repos[0]}`);

  if (coin.community_data) {
    const c = coin.community_data;
    if (c.twitter_followers !== undefined)
      lines.push(`twitter_followers: ${c.twitter_followers}`);
    if (c.reddit_subscribers !== undefined)
      lines.push(`reddit_subscribers: ${c.reddit_subscribers}`);
  }
  if (coin.developer_data) {
    const d = coin.developer_data;
    if (d.stars !== undefined)
      lines.push(`github_stars: ${d.stars} forks: ${d.forks ?? 0} commits_4w: ${d.commit_count_4_weeks ?? 0}`);
  }
  if (coin.market_data) {
    const md = coin.market_data;
    if (md.circulating_supply !== undefined)
      lines.push(`circulating_supply: ${md.circulating_supply}`);
    if (md.total_supply !== undefined) lines.push(`total_supply: ${md.total_supply}`);
    if (md.max_supply !== undefined && md.max_supply !== null)
      lines.push(`max_supply: ${md.max_supply}`);
    const mcUsd = md.market_cap?.["usd"];
    if (mcUsd !== undefined) lines.push(`market_cap_usd: ${mcUsd}`);
    const volUsd = md.total_volume?.["usd"];
    if (volUsd !== undefined) lines.push(`total_volume_usd: ${volUsd}`);
  }

  return lines.join("\n");
}
