// Helius Enhanced Transactions API. Returns the last N transactions
// involving an address, pre-parsed with instruction-level programIds.
// We use it to derive the *actual* set of programs a token's holders
// interact with, replacing the empty placeholder that made the riba
// rule a no-op for live mints.

const ENHANCED_BASE = "https://api.helius.xyz/v0";

export interface EnhancedInstruction {
  programId: string;
  accounts?: string[];
  data?: string;
  innerInstructions?: Array<{ programId: string }>;
}

export interface EnhancedTransaction {
  signature: string;
  slot: number;
  timestamp: number;
  type?: string; // SWAP, TRANSFER, ...
  source?: string; // JUPITER, RAYDIUM_AMM, ...
  fee?: number;
  feePayer?: string;
  description?: string;
  transactionError?: unknown;
  instructions: EnhancedInstruction[];
}

export interface EnhancedClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  base?: string;
}

export class HeliusEnhancedClient {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly base: string;

  constructor(opts: EnhancedClientOptions) {
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.base = opts.base ?? ENHANCED_BASE;
  }

  /**
   * Last `limit` transactions touching `address`. Limit clamps to
   * [1, 100] per Helius docs.
   */
  async transactionsForAddress(
    address: string,
    limit = 50,
  ): Promise<EnhancedTransaction[]> {
    const safe = Math.max(1, Math.min(100, limit));
    const url = `${this.base}/addresses/${address}/transactions?api-key=${this.apiKey}&limit=${safe}`;
    const res = await this.fetchImpl(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(
        `Helius enhanced HTTP ${res.status} for ${address}: ${await res
          .text()
          .catch(() => "")}`,
      );
    }
    const json = (await res.json()) as EnhancedTransaction[] | { error?: string };
    if (!Array.isArray(json)) {
      throw new Error(
        `Helius enhanced unexpected response shape: ${JSON.stringify(json).slice(0, 200)}`,
      );
    }
    return json;
  }
}
