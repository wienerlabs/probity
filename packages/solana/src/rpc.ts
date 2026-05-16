// Minimal Solana JSON-RPC client. No third-party deps — uses fetch.

export interface RpcClientOptions {
  endpoint: string;
  fetchImpl?: typeof fetch;
  commitment?: "processed" | "confirmed" | "finalized";
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
}

interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

interface JsonRpcError {
  jsonrpc: "2.0";
  id: number;
  error: { code: number; message: string; data?: unknown };
}

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcError;

export interface AccountInfoBase64 {
  data: [string, "base64"];
  executable: boolean;
  lamports: number;
  owner: string;
  rentEpoch: number;
  space?: number;
}

export interface AccountInfoResponse {
  context: { slot: number };
  value: AccountInfoBase64 | null;
}

export interface TokenAmountResponse {
  context: { slot: number };
  value: {
    amount: string;
    decimals: number;
    uiAmount: number | null;
    uiAmountString: string;
  };
}

export interface TokenLargestAccountsResponse {
  context: { slot: number };
  value: Array<{
    address: string;
    amount: string;
    decimals: number;
    uiAmount: number | null;
    uiAmountString: string;
  }>;
}

export class RpcError extends Error {
  constructor(public readonly code: number, message: string, public readonly data?: unknown) {
    super(message);
    this.name = "RpcError";
  }
}

export class SolanaRpcClient {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly commitment: "processed" | "confirmed" | "finalized";
  private nextId = 1;

  constructor(opts: RpcClientOptions) {
    this.endpoint = opts.endpoint;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.commitment = opts.commitment ?? "confirmed";
  }

  private async call<T>(method: string, params: unknown[]): Promise<T> {
    const body: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: this.nextId++,
      method,
      params,
    };
    const res = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new RpcError(res.status, `HTTP ${res.status} from ${method}`);
    }
    const json = (await res.json()) as JsonRpcResponse<T>;
    if ("error" in json) {
      throw new RpcError(json.error.code, json.error.message, json.error.data);
    }
    return json.result;
  }

  getAccountInfo(pubkey: string): Promise<AccountInfoResponse> {
    return this.call("getAccountInfo", [
      pubkey,
      { encoding: "base64", commitment: this.commitment },
    ]);
  }

  getTokenSupply(mint: string): Promise<TokenAmountResponse> {
    return this.call("getTokenSupply", [mint, { commitment: this.commitment }]);
  }

  getTokenLargestAccounts(mint: string): Promise<TokenLargestAccountsResponse> {
    return this.call("getTokenLargestAccounts", [
      mint,
      { commitment: this.commitment },
    ]);
  }

  getSlot(): Promise<number> {
    return this.call("getSlot", [{ commitment: this.commitment }]);
  }
}
