// Minimal Helius client. Two surfaces:
//   1. Helius RPC (same JSON-RPC as Solana mainnet — wrapped via SolanaRpcClient).
//   2. Helius DAS for asset metadata (`getAsset`).
//
// API key is appended as `?api-key=` query param per Helius docs.

import { SolanaRpcClient } from "./rpc";

export interface HeliusOptions {
  apiKey: string;
  cluster?: "mainnet" | "devnet";
  fetchImpl?: typeof fetch;
}

export interface HeliusAsset {
  id: string;
  content: {
    metadata: { name?: string; symbol?: string; description?: string };
    json_uri?: string;
    links?: Record<string, string>;
  };
  authorities: Array<{ address: string; scopes: string[] }>;
  mutable: boolean;
  burnt: boolean;
  token_info?: {
    decimals?: number;
    supply?: string;
    token_program?: string;
    mint_authority?: string | null;
    freeze_authority?: string | null;
  };
}

export class HeliusClient {
  readonly rpc: SolanaRpcClient;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly cluster: "mainnet" | "devnet";

  constructor(opts: HeliusOptions) {
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.cluster = opts.cluster ?? "mainnet";
    const rpcHost =
      this.cluster === "mainnet"
        ? "https://mainnet.helius-rpc.com"
        : "https://devnet.helius-rpc.com";
    this.rpc = new SolanaRpcClient({
      endpoint: `${rpcHost}/?api-key=${this.apiKey}`,
      fetchImpl: this.fetchImpl,
    });
  }

  async getAsset(mint: string): Promise<HeliusAsset> {
    const body = {
      jsonrpc: "2.0",
      id: "probity-getAsset",
      method: "getAsset",
      params: { id: mint },
    };
    const url =
      this.cluster === "mainnet"
        ? `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`
        : `https://devnet.helius-rpc.com/?api-key=${this.apiKey}`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Helius getAsset failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as
      | { result: HeliusAsset }
      | { error: { message: string } };
    if ("error" in json) {
      throw new Error(`Helius getAsset error: ${json.error.message}`);
    }
    return json.result;
  }
}
