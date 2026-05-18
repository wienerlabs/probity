import { base58Encode } from "./base58";

export const TOKEN_2022_PROGRAM_ID =
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const TOKEN_LEGACY_PROGRAM_ID =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

export const BASE_MINT_SIZE = 82;
export const ACCOUNT_TYPE_OFFSET = 165;
export const ACCOUNT_TYPE_MINT = 1;

export type ExtensionType =
  | "Uninitialized"
  | "TransferFeeConfig"
  | "TransferFeeAmount"
  | "MintCloseAuthority"
  | "ConfidentialTransferMint"
  | "ConfidentialTransferAccount"
  | "DefaultAccountState"
  | "ImmutableOwner"
  | "MemoTransfer"
  | "NonTransferable"
  | "InterestBearingConfig"
  | "CpiGuard"
  | "PermanentDelegate"
  | "NonTransferableAccount"
  | "TransferHook"
  | "TransferHookAccount"
  | "ConfidentialTransferFeeConfig"
  | "ConfidentialTransferFeeAmount"
  | "MetadataPointer"
  | "TokenMetadata"
  | "GroupPointer"
  | "TokenGroup"
  | "GroupMemberPointer"
  | "TokenGroupMember"
  | "Unknown";

const EXTENSION_TYPE_MAP: Record<number, ExtensionType> = {
  0: "Uninitialized",
  1: "TransferFeeConfig",
  2: "TransferFeeAmount",
  3: "MintCloseAuthority",
  4: "ConfidentialTransferMint",
  5: "ConfidentialTransferAccount",
  6: "DefaultAccountState",
  7: "ImmutableOwner",
  8: "MemoTransfer",
  9: "NonTransferable",
  10: "InterestBearingConfig",
  11: "CpiGuard",
  12: "PermanentDelegate",
  13: "NonTransferableAccount",
  14: "TransferHook",
  15: "TransferHookAccount",
  16: "ConfidentialTransferFeeConfig",
  17: "ConfidentialTransferFeeAmount",
  18: "MetadataPointer",
  19: "TokenMetadata",
  20: "GroupPointer",
  21: "TokenGroup",
  22: "GroupMemberPointer",
  23: "TokenGroupMember",
};

export interface TransferFeeConfig {
  type: "TransferFeeConfig";
  transferFeeConfigAuthority: string | null;
  withdrawWithheldAuthority: string | null;
  withheldAmount: string;
  olderTransferFee: { epoch: string; maximumFee: string; transferFeeBasisPoints: number };
  newerTransferFee: { epoch: string; maximumFee: string; transferFeeBasisPoints: number };
}

export interface InterestBearingConfig {
  type: "InterestBearingConfig";
  rateAuthority: string | null;
  initializationTimestamp: string;
  preUpdateAverageRate: number;
  lastUpdateTimestamp: string;
  currentRate: number;
}

export interface MintCloseAuthority {
  type: "MintCloseAuthority";
  closeAuthority: string | null;
}

export interface PermanentDelegate {
  type: "PermanentDelegate";
  delegate: string | null;
}

export interface DefaultAccountStateExt {
  type: "DefaultAccountState";
  state: number;
}

export interface ConfidentialTransferMint {
  type: "ConfidentialTransferMint";
  authority: string | null;
  autoApproveNewAccounts: boolean;
  auditorElgamalPubkey: string | null;
}

export interface MetadataPointer {
  type: "MetadataPointer";
  authority: string | null;
  metadataAddress: string | null;
}

export interface GroupPointer {
  type: "GroupPointer";
  authority: string | null;
  groupAddress: string | null;
}

export interface TransferHookExt {
  type: "TransferHook";
  authority: string | null;
  programId: string | null;
}

export interface NonTransferableExt {
  type: "NonTransferable";
}

export interface ImmutableOwnerExt {
  type: "ImmutableOwner";
}

export interface CpiGuardExt {
  type: "CpiGuard";
  lockCpi: boolean;
}

export interface UnknownExt {
  type: "Unknown";
  raw: ExtensionType;
  length: number;
}

export type ParsedExtension =
  | TransferFeeConfig
  | InterestBearingConfig
  | MintCloseAuthority
  | PermanentDelegate
  | DefaultAccountStateExt
  | ConfidentialTransferMint
  | MetadataPointer
  | GroupPointer
  | TransferHookExt
  | NonTransferableExt
  | ImmutableOwnerExt
  | CpiGuardExt
  | UnknownExt;

export interface Token2022Mint {
  isToken2022: true;
  decimals: number;
  supply: bigint;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  extensions: ParsedExtension[];
}

function readOptionalPubkey(
  data: Uint8Array,
  optionOffset: number,
  pubkeyOffset: number,
): string | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const opt = view.getUint32(optionOffset, true);
  if (opt === 0) return null;
  return base58Encode(data.subarray(pubkeyOffset, pubkeyOffset + 32));
}

function readU64BigInt(data: Uint8Array, offset: number): bigint {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getBigUint64(offset, true);
}

function readI64BigInt(data: Uint8Array, offset: number): bigint {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getBigInt64(offset, true);
}

function readI16(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getInt16(offset, true);
}

function readU16(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getUint16(offset, true);
}

function readBool(data: Uint8Array, offset: number): boolean {
  return data[offset] === 1;
}

function pubkeyAt(data: Uint8Array, offset: number): string {
  return base58Encode(data.subarray(offset, offset + 32));
}

function nonZeroPubkeyAt(data: Uint8Array, offset: number): string | null {
  const slice = data.subarray(offset, offset + 32);
  let zero = true;
  for (let i = 0; i < 32; i++) if (slice[i] !== 0) { zero = false; break; }
  if (zero) return null;
  return base58Encode(slice);
}

function parseExtension(
  kind: ExtensionType,
  body: Uint8Array,
): ParsedExtension {
  switch (kind) {
    case "TransferFeeConfig": {
      const cfgAuth = readOptionalPubkey(body, 0, 4);
      const wAuth = readOptionalPubkey(body, 36, 40);
      const withheldAmount = readU64BigInt(body, 72);
      const olderEpoch = readU64BigInt(body, 80);
      const olderMax = readU64BigInt(body, 88);
      const olderBps = readU16(body, 96);
      const newerEpoch = readU64BigInt(body, 98);
      const newerMax = readU64BigInt(body, 106);
      const newerBps = readU16(body, 114);
      return {
        type: "TransferFeeConfig",
        transferFeeConfigAuthority: cfgAuth,
        withdrawWithheldAuthority: wAuth,
        withheldAmount: withheldAmount.toString(),
        olderTransferFee: {
          epoch: olderEpoch.toString(),
          maximumFee: olderMax.toString(),
          transferFeeBasisPoints: olderBps,
        },
        newerTransferFee: {
          epoch: newerEpoch.toString(),
          maximumFee: newerMax.toString(),
          transferFeeBasisPoints: newerBps,
        },
      };
    }
    case "InterestBearingConfig": {
      const auth = readOptionalPubkey(body, 0, 4);
      const initTs = readI64BigInt(body, 36);
      const preRate = readI16(body, 44);
      const lastTs = readI64BigInt(body, 46);
      const curRate = readI16(body, 54);
      return {
        type: "InterestBearingConfig",
        rateAuthority: auth,
        initializationTimestamp: initTs.toString(),
        preUpdateAverageRate: preRate,
        lastUpdateTimestamp: lastTs.toString(),
        currentRate: curRate,
      };
    }
    case "MintCloseAuthority": {
      return {
        type: "MintCloseAuthority",
        closeAuthority: readOptionalPubkey(body, 0, 4),
      };
    }
    case "PermanentDelegate": {
      return {
        type: "PermanentDelegate",
        delegate: nonZeroPubkeyAt(body, 0),
      };
    }
    case "DefaultAccountState": {
      return { type: "DefaultAccountState", state: body[0] ?? 0 };
    }
    case "ConfidentialTransferMint": {
      return {
        type: "ConfidentialTransferMint",
        authority: nonZeroPubkeyAt(body, 0),
        autoApproveNewAccounts: readBool(body, 32),
        auditorElgamalPubkey: nonZeroPubkeyAt(body, 33),
      };
    }
    case "MetadataPointer": {
      return {
        type: "MetadataPointer",
        authority: nonZeroPubkeyAt(body, 0),
        metadataAddress: nonZeroPubkeyAt(body, 32),
      };
    }
    case "GroupPointer": {
      return {
        type: "GroupPointer",
        authority: nonZeroPubkeyAt(body, 0),
        groupAddress: nonZeroPubkeyAt(body, 32),
      };
    }
    case "TransferHook": {
      return {
        type: "TransferHook",
        authority: nonZeroPubkeyAt(body, 0),
        programId: nonZeroPubkeyAt(body, 32),
      };
    }
    case "NonTransferable":
      return { type: "NonTransferable" };
    case "ImmutableOwner":
      return { type: "ImmutableOwner" };
    case "CpiGuard":
      return { type: "CpiGuard", lockCpi: readBool(body, 0) };
    default:
      return { type: "Unknown", raw: kind, length: body.length };
  }
}

export function parseToken2022Mint(data: Uint8Array): Token2022Mint {
  if (data.length < ACCOUNT_TYPE_OFFSET + 1) {
    throw new Error(
      `token-2022 mint data too short: ${data.length} < ${ACCOUNT_TYPE_OFFSET + 1}`,
    );
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const mintAuthOption = view.getUint32(0, true);
  const mintAuthority =
    mintAuthOption === 0 ? null : base58Encode(data.subarray(4, 36));
  const supply = view.getBigUint64(36, true);
  const decimals = view.getUint8(44);
  const freezeAuthOption = view.getUint32(46, true);
  const freezeAuthority =
    freezeAuthOption === 0 ? null : base58Encode(data.subarray(50, 82));

  const accountType = data[ACCOUNT_TYPE_OFFSET];
  if (accountType !== ACCOUNT_TYPE_MINT) {
    return {
      isToken2022: true,
      decimals,
      supply,
      mintAuthority,
      freezeAuthority,
      extensions: [],
    };
  }

  const extensions: ParsedExtension[] = [];
  let offset = ACCOUNT_TYPE_OFFSET + 1;
  while (offset + 4 <= data.length) {
    const typeId = view.getUint16(offset, true);
    const length = view.getUint16(offset + 2, true);
    const bodyStart = offset + 4;
    const bodyEnd = bodyStart + length;
    if (bodyEnd > data.length) break;
    const kind = EXTENSION_TYPE_MAP[typeId] ?? "Unknown";
    const body = data.subarray(bodyStart, bodyEnd);
    try {
      extensions.push(parseExtension(kind, body));
    } catch {
      extensions.push({ type: "Unknown", raw: kind, length: body.length });
    }
    offset = bodyEnd;
    if (kind === "Uninitialized") break;
  }

  return {
    isToken2022: true,
    decimals,
    supply,
    mintAuthority,
    freezeAuthority,
    extensions,
  };
}

export function isToken2022Owner(ownerProgramId: string | undefined): boolean {
  return ownerProgramId === TOKEN_2022_PROGRAM_ID;
}

export function summarizeExtensions(exts: ParsedExtension[]): string[] {
  return exts.map((e) => e.type).filter((t) => t !== "Unknown") as string[];
}

export function hasInterestBearing(exts: ParsedExtension[]): InterestBearingConfig | null {
  const m = exts.find((e): e is InterestBearingConfig => e.type === "InterestBearingConfig");
  return m ?? null;
}

export function hasTransferFee(exts: ParsedExtension[]): TransferFeeConfig | null {
  const m = exts.find((e): e is TransferFeeConfig => e.type === "TransferFeeConfig");
  return m ?? null;
}

export function hasPermanentDelegate(exts: ParsedExtension[]): PermanentDelegate | null {
  const m = exts.find((e): e is PermanentDelegate => e.type === "PermanentDelegate");
  return m ?? null;
}

export function hasNonTransferable(exts: ParsedExtension[]): boolean {
  return exts.some((e) => e.type === "NonTransferable");
}

export function hasConfidentialTransfer(exts: ParsedExtension[]): ConfidentialTransferMint | null {
  const m = exts.find(
    (e): e is ConfidentialTransferMint => e.type === "ConfidentialTransferMint",
  );
  return m ?? null;
}
