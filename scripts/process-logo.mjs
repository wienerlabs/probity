// One-shot: take the supplied logo (black mark on white bg) and emit
// a transparent-background asset plus a favicon variant. Re-runnable —
// reads SRC, writes deterministic outputs into apps/web/public and app dir.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const SRC = process.env.LOGO_SRC ?? resolve(root, "../Downloads/probity-logo.png");
const OUT_DIR = resolve(root, "apps/web/public");
const APP_DIR = resolve(root, "apps/web/src/app");

const WHITE_THRESHOLD = 240; // r,g,b each above this → treat as background
const ALPHA_FALLOFF = 220;    // light grays get partial transparency for clean edges

async function whiteToAlpha(buf) {
  const img = sharp(buf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i] ?? 0;
    const g = out[i + 1] ?? 0;
    const b = out[i + 2] ?? 0;
    const min = Math.min(r, g, b);
    if (min >= WHITE_THRESHOLD) {
      out[i + 3] = 0;
    } else if (min >= ALPHA_FALLOFF) {
      // soft falloff for anti-aliased edges
      const t = (min - ALPHA_FALLOFF) / (WHITE_THRESHOLD - ALPHA_FALLOFF);
      out[i + 3] = Math.round(255 * (1 - t));
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

async function trim(buf) {
  return sharp(buf).trim({ threshold: 1 }).png().toBuffer();
}

async function pad(buf, ratio = 0.06) {
  const meta = await sharp(buf).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const side = Math.max(w, h);
  const target = Math.round(side * (1 + ratio * 2));
  return sharp({
    create: {
      width: target,
      height: target,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: buf,
        left: Math.round((target - w) / 2),
        top: Math.round((target - h) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function main() {
  const src = await readFile(SRC);
  console.log(`source: ${SRC} (${src.length} bytes)`);

  const transparent = await whiteToAlpha(src);
  const trimmed = await trim(transparent);
  const padded = await pad(trimmed, 0.08);

  await mkdir(OUT_DIR, { recursive: true });

  await writeFile(resolve(OUT_DIR, "probity-mark.png"), padded);
  console.log(`wrote ${resolve(OUT_DIR, "probity-mark.png")}`);

  // Favicon variants — Next.js picks app/icon.png and app/apple-icon.png
  const favicon32 = await sharp(padded).resize(64, 64, { fit: "contain" }).png().toBuffer();
  await writeFile(resolve(APP_DIR, "icon.png"), favicon32);
  console.log(`wrote ${resolve(APP_DIR, "icon.png")}`);

  const apple = await sharp(padded).resize(180, 180, { fit: "contain" }).png().toBuffer();
  await writeFile(resolve(APP_DIR, "apple-icon.png"), apple);
  console.log(`wrote ${resolve(APP_DIR, "apple-icon.png")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
