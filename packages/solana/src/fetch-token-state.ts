import type {
  SolanaTokenState,
  HolderEntry,
  ProgramInteraction,
  Token2022Extension,
} from "@probity/types";
import { HeliusClient } from "./helius";
import { parseMintAccount, formatSupply } from "./mint-layout";
import {
  parseToken2022Mint,
  TOKEN_2022_PROGRAM_ID,
  summarizeExtensions,
  type ParsedExtension,
} from "./token-2022-layout";
import { buildProgramInteractions } from "./program-classifier";

const METAPLEX_METADATA_PROGRAM = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

export interface FetchTokenStateOptions {
  programInteractions?: { programId: string; primaryRevenueShare: number }[];
}

export async function fetchTokenState(
  client: HeliusClient,
  mint: string,
  opts: FetchTokenStateOptions = {},
): Promise<SolanaTokenState> {
  // getTokenLargestAccounts can blow up on huge holder sets (USDC etc).
  // Soft-fail on it — the verdict still computes, holder concentration
  // just falls back to 0 and is surfaced honestly downstream.
  const [accInfo, largest, asset, slot] = await Promise.all([
    client.rpc.getAccountInfo(mint),
    client.rpc.getTokenLargestAccounts(mint).catch(() => ({
      context: { slot: 0 },
      value: [],
    })),
    client.getAsset(mint).catch(() => null),
    client.rpc.getSlot(),
  ]);

  if (!accInfo.value) {
    throw new Error(`mint account ${mint} not found`);
  }

  const dataB64 = accInfo.value.data[0];
  const data = Uint8Array.from(Buffer.from(dataB64, "base64"));
  const owner = accInfo.value.owner;
  const isToken2022 = owner === TOKEN_2022_PROGRAM_ID;

  let mintAuthority: string | null;
  let freezeAuthority: string | null;
  let decimals: number;
  let totalSupply: bigint;
  let extensions: Token2022Extension[] = [];

  if (isToken2022) {
    const parsed2022 = parseToken2022Mint(data);
    mintAuthority = parsed2022.mintAuthority;
    freezeAuthority = parsed2022.freezeAuthority;
    decimals = parsed2022.decimals;
    totalSupply = parsed2022.supply;
    extensions = parsed2022.extensions.map(toExtensionRecord);
  } else {
    const parsed = parseMintAccount(data);
    mintAuthority = parsed.mintAuthority;
    freezeAuthority = parsed.freezeAuthority;
    decimals = parsed.decimals;
    totalSupply = parsed.supply;
  }

  const top: HolderEntry[] = [];
  let topAmount = 0n;
  for (const h of largest.value.slice(0, 10)) {
    const amt = BigInt(h.amount);
    topAmount += amt;
    top.push({
      address: h.address,
      share: totalSupply === 0n ? 0 : Number((amt * 10_000n) / totalSupply) / 10_000,
    });
  }
  const concentration =
    totalSupply === 0n ? 0 : Number((topAmount * 10_000n) / totalSupply) / 10_000;

  const metadataAccount = deriveMetadataPda(mint);

  const programInteractions: ProgramInteraction[] = opts.programInteractions
    ? buildProgramInteractions(opts.programInteractions)
    : [];

  const state: SolanaTokenState = {
    mint,
    decimals,
    supply: formatSupply(totalSupply, decimals),
    mintAuthority,
    freezeAuthority,
    metadata: {
      name: asset?.content.metadata.name ?? "",
      symbol: asset?.content.metadata.symbol ?? "",
      uri: asset?.content.json_uri ?? "",
      isMutable: asset?.mutable ?? true,
    },
    metadataAccount,
    topHolderConcentration: concentration,
    topHolders: top,
    programInteractions,
    snapshotSlot: slot,
    tokenProgram: isToken2022 ? "spl-token-2022" : "spl-token",
  };
  if (extensions.length > 0) state.extensions = extensions;
  return state;
}

function toExtensionRecord(e: ParsedExtension): Token2022Extension {
  const { type, ...rest } = e as ParsedExtension & Record<string, unknown>;
  return { type, details: rest as Record<string, unknown> };
}

export function describeExtensions(state: SolanaTokenState): string[] {
  if (!state.extensions || state.extensions.length === 0) return [];
  return state.extensions.map((e) => e.type);
}

export { summarizeExtensions };

// Metaplex metadata PDA = findProgramAddress(
//   [b"metadata", METAPLEX_METADATA_PROGRAM, mint],
//   METAPLEX_METADATA_PROGRAM
// ).
// Computing this requires SHA-256 + a curve-point check loop. To avoid
// pulling a cryptography dep just for a display string, we synthesise a
// deterministic placeholder that downstream code can replace with the
// real PDA once @solana/web3.js is in the dependency tree.
function deriveMetadataPda(mint: string): string {
  // Stable per-mint placeholder; not a real PDA. Marked with a "Mta!" prefix
  // so it is obvious in audit logs that the PDA wasn't computed on-chain yet.
  // Uses a simple string fold so non-base58 placeholder mints (e.g. demo
  // fixtures) don't crash here — real PDA derivation lives behind a TODO.
  void METAPLEX_METADATA_PROGRAM;
  let h1 = 0x811c9dc5 >>> 0;
  for (let i = 0; i < mint.length; i++) {
    h1 ^= mint.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  const head = h1.toString(16).padStart(8, "0");
  return `Mta!${head}-pending-pda-compute`;
}
