// Minimal base58 (Bitcoin alphabet) — used for pubkey decode/encode.
// Bundled here to avoid pulling @solana/web3.js for one helper.

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET_MAP = new Map<string, number>(
  [...ALPHABET].map((c, i) => [c, i]),
);

export function base58Decode(input: string): Uint8Array {
  if (input.length === 0) return new Uint8Array();

  let zeros = 0;
  while (zeros < input.length && input[zeros] === "1") zeros++;

  const size = Math.ceil(((input.length - zeros) * Math.log(58)) / Math.log(256)) + 1;
  const b = new Uint8Array(size);
  let length = 0;

  for (let i = zeros; i < input.length; i++) {
    const ch = input[i]!;
    const v = ALPHABET_MAP.get(ch);
    if (v === undefined) throw new Error(`base58: invalid character "${ch}"`);
    let carry = v;
    let j = 0;
    for (let k = b.length - 1; (carry !== 0 || j < length) && k >= 0; k--, j++) {
      carry += 58 * (b[k] ?? 0);
      b[k] = carry & 0xff;
      carry >>= 8;
    }
    if (carry !== 0) throw new Error("base58: non-zero carry");
    length = j;
  }

  let it = b.length - length;
  while (it < b.length && b[it] === 0) it++;

  const out = new Uint8Array(zeros + (b.length - it));
  let p = 0;
  for (let z = 0; z < zeros; z++) out[p++] = 0;
  for (; it < b.length; it++) out[p++] = b[it]!;
  return out;
}

export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  const size = Math.ceil((bytes.length * Math.log(256)) / Math.log(58)) + 1;
  const b = new Uint8Array(size);
  let length = 0;

  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]!;
    let j = 0;
    for (let k = b.length - 1; (carry !== 0 || j < length) && k >= 0; k--, j++) {
      carry += 256 * (b[k] ?? 0);
      b[k] = carry % 58;
      carry = (carry / 58) | 0;
    }
    if (carry !== 0) throw new Error("base58: non-zero carry");
    length = j;
  }

  let it = b.length - length;
  while (it < b.length && b[it] === 0) it++;

  let out = "";
  for (let z = 0; z < zeros; z++) out += "1";
  for (; it < b.length; it++) out += ALPHABET[b[it]!];
  return out;
}

export function isLikelyBase58Pubkey(value: string): boolean {
  if (value.length < 32 || value.length > 44) return false;
  for (let i = 0; i < value.length; i++) {
    if (!ALPHABET_MAP.has(value[i]!)) return false;
  }
  return true;
}
