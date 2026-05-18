// Fetches the off-chain documents Claude actually needs to write a
// defensible revenue/governance extraction. Two sources:
//   1. The Metaplex metadata JSON at state.metadata.uri (Arweave, IPFS,
//      or a centralised CDN). This carries description, external_url,
//      attributes, links — the issuer's own public claim.
//   2. The external_url (or homepage link) when present — fetched as
//      raw HTML, scrubbed to plain text, hard-capped on size.
//
// Every fetch is bounded by a deadline + a max-bytes cap so a slow or
// hostile server can't stall the whole screening pipeline.

import type { SolanaTokenState } from "@probity/types";
import type { DocumentSource } from "./enrich";
import { fetchTokenListFallback } from "./token-list-fallback";
import { fetchCoingeckoFallback } from "./coingecko-fallback";

export interface FetchDocsOptions {
  /** Total wall-clock budget across all fetches, milliseconds. */
  totalBudgetMs?: number;
  /** Max bytes per individual document. */
  maxBytesPerDoc?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /**
   * If set, the Birdeye `token_overview` endpoint is consulted as
   * a fallback / supplemental source for mints whose on-chain
   * Metaplex metadata is thin or absent.
   */
  birdeyeApiKey?: string;
  /** CoinGecko demo / pro API key. CoinGecko works keyless on the
   * public tier but with very low rate limits; passing a key enables
   * the demo tier which is enough for screening pipelines. */
  coingeckoApiKey?: string;
  /** Disable the Jupiter v2 + Birdeye + CoinGecko fallback path entirely. */
  disableFallback?: boolean;
}

export interface FetchDocsResult {
  documents: DocumentSource[];
  warnings: string[];
  links: {
    website?: string;
    twitter?: string;
    github?: string;
    logo?: string;
    coingeckoId?: string;
  };
}

const DEFAULT_BUDGET_MS = 8_000;
const DEFAULT_MAX_BYTES = 64 * 1024;

interface MetaplexJson {
  name?: string;
  symbol?: string;
  description?: string;
  external_url?: string;
  external_link?: string;
  website?: string;
  attributes?: unknown;
  properties?: unknown;
  extensions?: { website?: string; twitter?: string; telegram?: string };
}

export async function fetchTokenDocuments(
  state: SolanaTokenState,
  opts: FetchDocsOptions = {},
): Promise<FetchDocsResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const budgetMs = opts.totalBudgetMs ?? DEFAULT_BUDGET_MS;
  const maxBytes = opts.maxBytesPerDoc ?? DEFAULT_MAX_BYTES;
  const deadline = Date.now() + budgetMs;

  const documents: DocumentSource[] = [];
  const warnings: string[] = [];
  const aggregateLinks: FetchDocsResult["links"] = {};
  let homepageFromMeta: string | null = null;
  let logoFromMeta: string | null = null;
  let twitterFromMeta: string | null = null;

  const uri = sanitizeUrl(state.metadata.uri);
  if (!uri) {
    warnings.push(
      "Metadata URI absent or unsupported scheme; relying on token-list fallbacks.",
    );
  } else {
    // ---- Step 1: metadata JSON ----
    const metaUrl = ipfsToHttps(uri);
    const metaResult = await fetchTextWithCaps(metaUrl, {
      fetchImpl,
      maxBytes,
      timeoutMs: Math.max(1_000, deadline - Date.now()),
      accept: "application/json, */*",
    });
    if ("error" in metaResult) {
      warnings.push(`Metadata fetch failed (${metaUrl}): ${metaResult.error}`);
    } else {
      let meta: MetaplexJson | null = null;
      try {
        meta = JSON.parse(metaResult.text) as MetaplexJson;
      } catch {
        warnings.push(
          `Metadata at ${metaUrl} did not parse as JSON; treating as raw text.`,
        );
      }
      const excerpt = buildMetadataExcerpt(meta, metaResult.text, maxBytes);
      documents.push({
        kind: "tokenomics",
        url: metaUrl,
        excerpt,
        contentHash: `sha256-len:${metaResult.bytes}`,
      });
      if (meta) {
        homepageFromMeta = sanitizeUrl(
          meta.external_url ??
            meta.external_link ??
            meta.website ??
            meta.extensions?.website,
        );
        const metaImage = (meta as unknown as { image?: string }).image;
        if (metaImage) logoFromMeta = sanitizeUrl(metaImage);
        if (meta.extensions?.twitter)
          twitterFromMeta = sanitizeUrl(meta.extensions.twitter);
      }
    }
  }

  // ---- Step 2: Jupiter v2 + Birdeye + CoinGecko fallback ----
  // Runs whether or not Metaplex metadata was found. It's never
  // misleading to surface a token's listing-side description, and
  // wSOL / USDC / USDT only resolve via this path.
  let fallbackHomepage: string | null = null;
  if (!opts.disableFallback && Date.now() < deadline) {
    const remaining = () => Math.max(1_000, deadline - Date.now());
    const [tl, cg] = await Promise.all([
      fetchTokenListFallback(state.mint, {
        fetchImpl,
        ...(opts.birdeyeApiKey ? { birdeyeApiKey: opts.birdeyeApiKey } : {}),
        timeoutMs: remaining(),
        maxBytes,
      }),
      fetchCoingeckoFallback(state.mint, {
        fetchImpl,
        ...(opts.coingeckoApiKey ? { apiKey: opts.coingeckoApiKey } : {}),
        timeoutMs: remaining(),
        maxBytes: Math.max(maxBytes, 384 * 1024),
      }),
    ]);
    documents.push(...tl.documents);
    warnings.push(...tl.warnings);
    documents.push(...cg.documents);
    warnings.push(...cg.warnings);
    if (tl.links.website) fallbackHomepage = sanitizeUrl(tl.links.website);
    if (!fallbackHomepage && cg.links.homepage)
      fallbackHomepage = sanitizeUrl(cg.links.homepage);

    const w = aggregateLinks.website ?? tl.links.website ?? cg.links.homepage;
    const t = aggregateLinks.twitter ?? tl.links.twitter ?? cg.links.twitter;
    const g = aggregateLinks.github ?? tl.links.github ?? cg.links.github;
    const l = aggregateLinks.logo ?? tl.links.logo ?? cg.links.logo;
    const cgId =
      aggregateLinks.coingeckoId ?? tl.links.coingeckoId ?? cg.links.coingeckoId;
    if (w) aggregateLinks.website = w;
    if (t) aggregateLinks.twitter = t;
    if (g) aggregateLinks.github = g;
    if (l) aggregateLinks.logo = l;
    if (cgId) aggregateLinks.coingeckoId = cgId;
  }
  if (homepageFromMeta && !aggregateLinks.website)
    aggregateLinks.website = homepageFromMeta;
  if (twitterFromMeta && !aggregateLinks.twitter)
    aggregateLinks.twitter = twitterFromMeta;
  if (logoFromMeta && !aggregateLinks.logo)
    aggregateLinks.logo = logoFromMeta;

  // ---- Step 3: homepage HTML ----
  const homepage = homepageFromMeta ?? fallbackHomepage;
  if (homepage && Date.now() < deadline) {
    const homeResult = await fetchTextWithCaps(homepage, {
      fetchImpl,
      maxBytes,
      timeoutMs: Math.max(1_000, deadline - Date.now()),
      accept: "text/html,application/xhtml+xml",
    });
    if ("error" in homeResult) {
      warnings.push(`Homepage fetch failed (${homepage}): ${homeResult.error}`);
    } else {
      documents.push({
        kind: "other",
        url: homepage,
        excerpt: htmlToText(homeResult.text).slice(0, maxBytes),
        contentHash: `sha256-len:${homeResult.bytes}`,
      });
    }
  } else if (!homepage) {
    warnings.push(
      "No homepage URL discovered (Metaplex metadata + token-list fallback both silent).",
    );
  }

  return { documents, warnings, links: aggregateLinks };
}

// ----------------- helpers -----------------

interface FetchOk {
  text: string;
  bytes: number;
}
interface FetchErr {
  error: string;
}

interface FetchOptions {
  fetchImpl: typeof fetch;
  maxBytes: number;
  timeoutMs: number;
  accept: string;
}

async function fetchTextWithCaps(
  url: string,
  opts: FetchOptions,
): Promise<FetchOk | FetchErr> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs);
  try {
    const res = await opts.fetchImpl(url, {
      method: "GET",
      headers: {
        accept: opts.accept,
        "user-agent": "Probity-Screening/1.0 (+https://probity.wienerlabs.com)",
      },
      signal: ac.signal,
      redirect: "follow",
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };

    // Stream-limit the body so a 50MB whitepaper can't blow memory.
    const reader = res.body?.getReader();
    if (!reader) {
      const txt = await res.text();
      return { text: txt.slice(0, opts.maxBytes), bytes: txt.length };
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < opts.maxBytes) {
      const r = await reader.read();
      if (r.done) break;
      chunks.push(r.value);
      total += r.value.byteLength;
    }
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    const buf = new Uint8Array(Math.min(total, opts.maxBytes));
    let off = 0;
    for (const c of chunks) {
      const take = Math.min(c.byteLength, buf.length - off);
      buf.set(c.subarray(0, take), off);
      off += take;
      if (off >= buf.length) break;
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    return { text, bytes: total };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

function sanitizeUrl(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("ipfs://")) return trimmed;
  if (trimmed.startsWith("ar://")) return trimmed;
  if (trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("http://")) {
    // Upgrade insecure http to https where it works; otherwise drop.
    return "https://" + trimmed.slice("http://".length);
  }
  return null;
}

function ipfsToHttps(url: string): string {
  if (url.startsWith("ipfs://")) {
    const cid = url.slice("ipfs://".length).replace(/^ipfs\//, "");
    return `https://cloudflare-ipfs.com/ipfs/${cid}`;
  }
  if (url.startsWith("ar://")) {
    const id = url.slice("ar://".length);
    return `https://arweave.net/${id}`;
  }
  return url;
}

function buildMetadataExcerpt(
  meta: MetaplexJson | null,
  raw: string,
  cap: number,
): string {
  if (!meta) return raw.slice(0, cap);
  const lines: string[] = [];
  if (meta.name) lines.push(`name: ${meta.name}`);
  if (meta.symbol) lines.push(`symbol: ${meta.symbol}`);
  if (meta.description) lines.push(`description: ${meta.description}`);
  if (meta.external_url) lines.push(`external_url: ${meta.external_url}`);
  if (meta.external_link) lines.push(`external_link: ${meta.external_link}`);
  if (meta.website) lines.push(`website: ${meta.website}`);
  if (meta.extensions?.website)
    lines.push(`extensions.website: ${meta.extensions.website}`);
  if (meta.extensions?.twitter)
    lines.push(`extensions.twitter: ${meta.extensions.twitter}`);
  if (meta.attributes !== undefined)
    lines.push(`attributes: ${stringifyCapped(meta.attributes, 1_500)}`);
  if (meta.properties !== undefined)
    lines.push(`properties: ${stringifyCapped(meta.properties, 1_500)}`);
  const joined = lines.join("\n");
  if (joined.length > 0) return joined.slice(0, cap);
  return raw.slice(0, cap);
}

function stringifyCapped(v: unknown, cap: number): string {
  try {
    const s = JSON.stringify(v);
    return s.length > cap ? s.slice(0, cap) + "…(truncated)" : s;
  } catch {
    return "(unserialisable)";
  }
}

// Crude HTML → text. Strips script/style blocks and tags, collapses
// whitespace. Good enough to give Claude a body of prose without
// hauling in a 1 MB dependency.
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
