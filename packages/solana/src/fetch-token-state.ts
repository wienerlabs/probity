import type { SolanaTokenState, HolderEntry, ProgramInteraction } from "@probity/types";
import { HeliusClient } from "./helius";
import { parseMintAccount, formatSupply } from "./mint-layout";
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
  const parsed = parseMintAccount(data);

  const totalSupply = parsed.supply;
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

  return {
    mint,
    decimals: parsed.decimals,
    supply: formatSupply(totalSupply, parsed.decimals),
    mintAuthority: parsed.mintAuthority,
    freezeAuthority: parsed.freezeAuthority,
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
  };
}

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
