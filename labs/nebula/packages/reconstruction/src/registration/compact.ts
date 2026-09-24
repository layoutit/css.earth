/** Native, compact broad-band stars for sparse fields dominated by coloured filaments. */
import sharp from 'sharp';
import { detectStars, type Pair, type Star } from './stellar.ts';
import { applyAffine, type Affine, type Point } from './affine.ts';

export async function detectCompactStars(bytes: Buffer, native: Point, channel: 'minimum-rgb' | 'maximum-rgb' = 'minimum-rgb', maximumStars = 250): Promise<Star[]> {
  if (!Number.isInteger(maximumStars) || maximumStars < 1 || maximumStars > 500) throw new TypeError('Compact-star pool is bounded to 500.');
  const { data, info } = await sharp(bytes).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  if (info.width !== native[0] || info.height !== native[1] || info.channels !== 3) throw new TypeError('Compact-star native grid differs.');
  const gray = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < gray.length; i++) gray[i] = (channel === 'maximum-rgb' ? Math.max : Math.min)(data[i * 3]!, data[i * 3 + 1]!, data[i * 3 + 2]!);
  const raw = { width: info.width, height: info.height, channels: 1 as const };
  const png = await sharp(gray, { raw }).png().toBuffer();
  const stars = await detectStars(png, native, 4096, 10000);
  const background = await sharp(gray, { raw }).blur(6).greyscale().raw().toBuffer();
  const compact: Star[] = [];
  for (const star of stars) {
    const x = Math.floor(star.point[0]), y = Math.floor(star.point[1]);
    if (x < 9 || y < 9 || x >= info.width - 9 || y >= info.height - 9 || star.peak < 18) continue;
    let total = 0, inner = 0, xx = 0, yy = 0, xy = 0;
    for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
      const i = (y + dy) * info.width + x + dx, weight = Math.max(0, gray[i]! - background[i]!);
      total += weight; if (dx * dx + dy * dy <= 9) inner += weight;
      xx += weight * dx * dx; yy += weight * dy * dy; xy += weight * dx * dy;
    }
    if (total > 0 && inner / total > .38 && Math.hypot(xx - yy, 2 * xy) / (xx + yy) < .45) compact.push(star);
  }
  return compact.slice(0, maximumStars);
}
const distance = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1]);
function nearest(p: Point, points: Point[], radius: number) {
  let index = -1;
  for (let i = 0; i < points.length; i++) { const d = distance(p, points[i]!); if (d < radius) { radius = d; index = i; } }
  return index;
}
/** Sparse fields use the full stellar constellation; no fit is used to discover held-out identities. */
export function matchCompactStars(source: Star[], reference: Star[], sourceToFrame: Affine, referenceToFrame: Affine): Pair[] {
  const sp = source.map(s => applyAffine(sourceToFrame, s.point)), rp = reference.map(s => applyAffine(referenceToFrame, s.point));
  const pairs: Pair[] = [];
  for (let i = 0; i < sp.length; i++) {
    const j = nearest(sp[i]!, rp, 2.5);
    if (j < 0 || nearest(rp[j]!, sp, 2.5) !== i) continue;
    let neighbours = 0;
    for (let k = 0; k < sp.length; k++) {
      if (distance(sp[k]!, sp[i]!) < 2) continue;
      const expected: Point = [rp[j]![0] + sp[k]![0] - sp[i]![0], rp[j]![1] + sp[k]![1] - sp[i]![1]];
      if (nearest(expected, rp, .4) >= 0) neighbours++;
      if (neighbours >= 6) break;
    }
    if (neighbours >= 6) pairs.push({ source: source[i]!.point, frame: rp[j]!, sourceIndex: i, referenceIndex: j });
  }
  return pairs;
}
