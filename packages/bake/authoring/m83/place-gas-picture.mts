// Entry script: node packages/bake/authoring/m83/place-gas-picture.mts
/**
 * Where ESO's ALMA picture of M83's molecular gas (potw2640a) lies on the sky. Neither its page nor its file gives sky
 * coordinates, so they are measured, in three steps that are printed and compared with the bank's recipe.
 *
 * 1. ESO released the gas picture with a visible-light picture of the same frame (potw2640b). That picture shows
 *    stars: each Gaia DR3 star of the field is looked for in it, and a linear fit from the sky's tangent plane to its
 *    pixels gives the frame's scale, the direction of north and its centre. The fit starts from a vote: with north up
 *    within a few degrees, every scale votes for the offset most pairs of a star and a peak agree on. Faint stars carry
 *    the fit; the bright ones are saturated patches, left out of it, and their middles check it afterwards.
 * 2. Two pictures of one release need not share their pixels. Molecular gas and dust lanes are the same clouds, so the
 *    gas picture is slid over the visible picture's dust lanes (how much darker a pixel is than the light around it),
 *    for the whole frame and for each quarter: the best slide is how far apart the two pictures are drawn.
 * 3. The gas picture's own sky level (each channel over the frame's outer ring) and how far its light reaches in the
 *    disc's plane are measured for the recipe's floor and its fade.
 *
 * Inputs, all restored from their origins by the bank's manifest: `source/registration-visible.jpg`,
 * `source/gaia-dr3-field.csv`, `source/source.jpg` and `source/recipe.json`. Writes nothing. Exits with 1 when the
 * recipe's observation is not the fit's.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseImageLayerRecipe } from '@cssearth/bake/image-layers';

const RAD = Math.PI / 180;
const source = resolve(checkoutProjectRoot(import.meta.url), 'src/objects/m83-alma-layers/source');
const recipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(source, 'recipe.json'), 'utf8')));
/** The tangent plane's centre: any place near the frame's middle. */
const RA0 = 204.2538, DEC0 = -29.8658;
/** A star is paired with a peak within this many pixels, tightening as the fit settles. */
const PAIR_WITHIN = [6, 3, 2, 1.5, 1.5];

// 1. The visible picture on the sky.
const visible = await sharp(resolve(source, 'registration-visible.jpg')).greyscale().raw().toBuffer({ resolveWithObject: true });
const W = visible.info.width, H = visible.info.height, light = visible.data, at = (x: number, y: number) => light[y * W + x]!;
// A star: a pixel that tops the 11 by 11 around it and stands 40 of 255 above the ring ten pixels out, at the middle of its light.
const peaks: { x: number; y: number; above: number }[] = [];
for (let y = 12; y < H - 12; y++) for (let x = 12; x < W - 12; x++) {
  const value = at(x, y); if (value < 60) continue;
  let top = true;
  for (let dy = -5; dy <= 5 && top; dy++) for (let dx = -5; dx <= 5; dx++) { const other = at(x + dx, y + dy); if (other > value || (other === value && (dy < 0 || (dy === 0 && dx < 0)))) { top = false; break; } }
  if (!top) continue;
  let ring = 0; for (let a = 0; a < 32; a++) ring += at(Math.round(x + 10 * Math.cos(a * Math.PI / 16)), Math.round(y + 10 * Math.sin(a * Math.PI / 16)));
  const floor = ring / 32; if (value - floor < 40) continue;
  let sx = 0, sy = 0, sw = 0;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const w = Math.max(0, at(x + dx, y + dy) - floor); sx += w * (x + dx); sy += w * (y + dy); sw += w; }
  peaks.push({ x: sx / sw, y: sy / sw, above: value - floor });
}
peaks.sort((a, b) => b.above - a.above);
const plane = (ra: number, dec: number): readonly [number, number] => { const d = dec * RAD, d0 = DEC0 * RAD, a = (ra - RA0) * RAD, c = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a);
  return [Math.cos(d) * Math.sin(a) / c / RAD * 3600, (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a)) / c / RAD * 3600]; };
const table = (await readFile(resolve(source, 'gaia-dr3-field.csv'), 'utf8')).trim().split(/\r?\n/u), header = table[0]!.split(',');
const column = (name: string) => { const index = header.indexOf(name); if (index < 0) throw new TypeError(`gaia-dr3-field.csv has no ${name} column; its header is ${table[0]}.`); return index; };
const [raAt, decAt, gAt] = [column('ra'), column('dec'), column('phot_g_mean_mag')];
const stars = table.slice(1).map(line => line.split(',').map(Number)).map(cells => ({ g: cells[gAt]!, place: plane(cells[raAt]!, cells[decAt]!) })).sort((a, b) => a.g - b.g);

let vote = { pairs: 0, scale: 0, turn: 0, x: 0, y: 0 };
const BIN = 4, bright = stars.slice(0, 260), strong = peaks.slice(0, 260);
for (let scale = 0.15; scale <= 0.9; scale *= 1.004) for (let turn = -4; turn <= 4; turn += 0.25) {
  const c = Math.cos(turn * RAD), s = Math.sin(turn * RAD), votes = new Map<number, number>();
  for (const star of bright) { const px = (-star.place[0] * c + star.place[1] * s) / scale, py = (-star.place[0] * s - star.place[1] * c) / scale;
    for (const peak of strong) { const kx = Math.round((peak.x - px) / BIN), ky = Math.round((peak.y - py) / BIN); if (kx < -200 || kx > 1200 || ky < -200 || ky > 1200) continue; const key = kx * 4096 + ky; votes.set(key, (votes.get(key) ?? 0) + 1); } }
  for (const [key, pairs] of votes) if (pairs > vote.pairs) vote = { pairs, scale, turn, x: Math.floor(key / 4096) * BIN, y: (key % 4096) * BIN };
}
// pixel = A (east, north) + b, by least squares over the pairs.
let A = [-Math.cos(vote.turn * RAD) / vote.scale, Math.sin(vote.turn * RAD) / vote.scale, -Math.sin(vote.turn * RAD) / vote.scale, -Math.cos(vote.turn * RAD) / vote.scale], b = [vote.x, vote.y];
const solve = (matrix: number[][], values: number[]) => { const rows = matrix.map((row, i) => [...row, values[i]!]);
  for (let i = 0; i < 3; i++) { let pivot = i; for (let r = i + 1; r < 3; r++) if (Math.abs(rows[r]![i]!) > Math.abs(rows[pivot]![i]!)) pivot = r; [rows[i], rows[pivot]] = [rows[pivot]!, rows[i]!];
    for (let r = 0; r < 3; r++) if (r !== i) { const f = rows[r]![i]! / rows[i]![i]!; for (let k = i; k < 4; k++) rows[r]![k]! -= f * rows[i]![k]!; } }
  return rows.map((row, i) => row[3]! / row[i]!); };
const pixelOf = (place: readonly [number, number]): [number, number] => [A[0]! * place[0] + A[1]! * place[1] + b[0]!, A[2]! * place[0] + A[3]! * place[1] + b[1]!];
let pairs: { east: number; north: number; x: number; y: number; g: number }[] = [];
for (const within of PAIR_WITHIN) {
  pairs = [];
  for (const star of stars) { const [x, y] = pixelOf(star.place); if (x < 0 || y < 0 || x >= W || y >= H) continue;
    let near: { x: number; y: number } | undefined, distance = within; for (const peak of peaks) { const r = Math.hypot(peak.x - x, peak.y - y); if (r < distance) { distance = r; near = peak; } }
    if (near) pairs.push({ east: star.place[0], north: star.place[1], x: near.x, y: near.y, g: star.g }); }
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], vx = [0, 0, 0], vy = [0, 0, 0];
  for (const pair of pairs) { const row = [pair.east, pair.north, 1]; for (let i = 0; i < 3; i++) { for (let k = 0; k < 3; k++) m[i]![k]! += row[i]! * row[k]!; vx[i]! += row[i]! * pair.x; vy[i]! += row[i]! * pair.y; } }
  const fx = solve(m.map(row => [...row]), vx), fy = solve(m.map(row => [...row]), vy);
  A = [fx[0]!, fx[1]!, fy[0]!, fy[1]!]; b = [fx[2]!, fy[2]!];
}
const misses = pairs.map(pair => { const [x, y] = pixelOf([pair.east, pair.north]); return Math.hypot(x - pair.x, y - pair.y); });
const scaleX = 1 / Math.hypot(A[0]!, A[2]!), scaleY = 1 / Math.hypot(A[1]!, A[3]!), pixelArcsec = (scaleX + scaleY) / 2, rms = Math.sqrt(misses.reduce((sum, r) => sum + r * r, 0) / misses.length);
const northClockwiseDeg = Math.atan2(A[1]!, -A[3]!) / RAD, det = A[0]! * A[3]! - A[1]! * A[2]!;
const skyOf = (x: number, y: number): [number, number] => { const cx = x - b[0]!, cy = y - b[1]!, xi = (A[3]! * cx - A[1]! * cy) / det / 3600 * RAD, eta = (-A[2]! * cx + A[0]! * cy) / det / 3600 * RAD, d0 = DEC0 * RAD, rho = Math.hypot(xi, eta), c = Math.atan(rho);
  return rho ? [RA0 + Math.atan2(xi * Math.sin(c), rho * Math.cos(d0) * Math.cos(c) - eta * Math.sin(d0) * Math.sin(c)) / RAD, Math.asin(Math.cos(c) * Math.sin(d0) + eta * Math.sin(c) * Math.cos(d0) / rho) / RAD] : [RA0, DEC0]; };
const centre = skyOf((W - 1) / 2, (H - 1) / 2), field = [W * scaleX / 3600, H * scaleY / 3600] as const;
const inFrame = stars.filter(star => { const [x, y] = pixelOf(star.place); return x >= 12 && y >= 12 && x < W - 12 && y < H - 12; });
console.log(`visible picture, ${W} x ${H} px: ${peaks.length} peaks; the vote: ${vote.pairs} pairs at ${vote.scale.toFixed(4)} arcsec a pixel`);
console.log(`fit: ${pairs.length} of the ${inFrame.length} Gaia stars in the frame, missed by ${(rms * pixelArcsec).toFixed(2)} arcsec rms (${rms.toFixed(2)} px); ${scaleX.toFixed(5)} by ${scaleY.toFixed(5)} arcsec a pixel; north ${northClockwiseDeg.toFixed(3)} deg clockwise of up; east ${det > 0 ? 'left' : 'right'}`);
console.log(`     centre ${centre[0].toFixed(6)}, ${centre[1].toFixed(6)}; field ${field[0].toFixed(6)} by ${field[1].toFixed(6)} deg (${(field[0] * 60).toFixed(2)} by ${(field[1] * 60).toFixed(2)} arcmin)`);
// The bright stars: saturated patches the peak rule passes over, not in the fit.
{ const seen = new Uint8Array(W * H), patches: { x: number; y: number }[] = [];
  for (let start = 0; start < W * H; start++) { if (seen[start] || light[start]! < 250) continue; let n = 0, sx = 0, sy = 0; const stack = [start]; seen[start] = 1;
    for (let p = stack.pop(); p !== undefined; p = stack.pop()) { const x = p % W, y = (p - x) / W; n++; sx += x; sy += y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const qx = x + dx, qy = y + dy; if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue; const q = qy * W + qx; if (seen[q] || light[q]! < 250) continue; seen[q] = 1; stack.push(q); } }
    if (n >= 6 && n <= 6000) patches.push({ x: sx / n, y: sy / n }); }
  const brightStars = inFrame.filter(star => star.g < 16), away: number[] = [];
  for (const star of brightStars) { const [x, y] = pixelOf(star.place); let distance = 8, found = false; for (const patch of patches) { const r = Math.hypot(patch.x - x, patch.y - y); if (r < distance) { distance = r; found = true; } } if (found) away.push(distance); }
  away.sort((p, q) => p - q);
  console.log(`check: ${away.length} of the ${brightStars.length} stars brighter than G 16 have a saturated patch within 8 px, at a median ${((away[away.length >> 1] ?? NaN) * pixelArcsec).toFixed(2)} arcsec`); }

// 2. The gas picture over the visible picture's dust lanes.
const SHRINK = 4, REACH = 24;
const small = async (name: string, blur?: number) => { let image = sharp(resolve(source, name)).greyscale().resize({ width: Math.round(W / SHRINK) }); if (blur) image = image.blur(blur); return image.raw().toBuffer({ resolveWithObject: true }); };
const gas = await small(recipe.source.path), sharpLight = await small('registration-visible.jpg'), smoothLight = await small('registration-visible.jpg', 10);
const w = gas.info.width, h = Math.min(gas.info.height, sharpLight.info.height), dust = new Float32Array(w * h);
for (let p = 0; p < w * h; p++) { const lane = smoothLight.data[p]! - sharpLight.data[p]!; dust[p] = lane > 0 && smoothLight.data[p]! > 40 ? lane : 0; }
function slide(x0: number, y0: number, x1: number, y1: number) {
  const scores: number[] = []; let best = { score: -Infinity, dx: 0, dy: 0 };
  for (let dy = -REACH; dy <= REACH; dy++) for (let dx = -REACH; dx <= REACH; dx++) { let sum = 0, sa = 0, sb = 0, saa = 0, sbb = 0, n = 0;
    for (let y = Math.max(y0, REACH); y < Math.min(y1, h - REACH); y++) for (let x = Math.max(x0, REACH); x < Math.min(x1, w - REACH); x++) { const a = gas.data[y * w + x]!, d = dust[(y + dy) * w + x + dx]!; sum += a * d; sa += a; sb += d; saa += a * a; sbb += d * d; n++; }
    const score = (sum - sa * sb / n) / Math.sqrt((saa - sa * sa / n) * (sbb - sb * sb / n)); scores.push(score); if (score > best.score) best = { score, dx, dy }; }
  const scoreAt = (dx: number, dy: number) => scores[(dy + REACH) * (2 * REACH + 1) + dx + REACH] ?? best.score, middle = (low: number, high: number) => { const curve = low - 2 * best.score + high; return curve ? 0.5 * (low - high) / curve : 0; };
  const dx = best.dx + (Math.abs(best.dx) < REACH ? middle(scoreAt(best.dx - 1, best.dy), scoreAt(best.dx + 1, best.dy)) : 0), dy = best.dy + (Math.abs(best.dy) < REACH ? middle(scoreAt(best.dx, best.dy - 1), scoreAt(best.dx, best.dy + 1)) : 0);
  return `${(dx * SHRINK * pixelArcsec).toFixed(2)}, ${(dy * SHRINK * pixelArcsec).toFixed(2)} arcsec (correlation ${best.score.toFixed(2)}, ${scoreAt(0, 0).toFixed(2)} with no slide)`;
}
console.log(`gas over dust lanes, best slide right and down: whole frame ${slide(0, 0, w, h)}`);
for (const [name, x0, y0, x1, y1] of [['top left', 0, 0, w >> 1, h >> 1], ['top right', w >> 1, 0, w, h >> 1], ['bottom left', 0, h >> 1, w >> 1, h], ['bottom right', w >> 1, h >> 1, w, h]] as const) console.log(`     ${name}: ${slide(x0, y0, x1, y1)}`);

// 3. The gas picture's sky and how far its light reaches in the disc's plane.
const picture = await sharp(resolve(source, recipe.source.path)).removeAlpha().raw().toBuffer({ resolveWithObject: true }), rgb = picture.data;
const rim = Math.round(0.03 * W), ring: number[][] = [[], [], []];
for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (x < rim || y < rim || x >= W - rim || y >= H - rim) for (let c = 0; c < 3; c++) ring[c]!.push(rgb[3 * (y * W + x) + c]!);
for (const values of ring) values.sort((p, q) => p - q);
const sky = ring.map(values => values[values.length >> 1]!), high = ring.map(values => values[Math.floor(values.length * 0.99)]!);
const target = pixelOf(plane(recipe.target.centerRaDeg, recipe.target.centerDecDeg)), kpcPerArcsec = recipe.target.distancePc * Math.PI / 648000 / 1000, pa = recipe.geometry.lineOfNodesPaDeg * RAD, cosTilt = Math.cos(recipe.geometry.inclinationDeg * RAD);
let reach = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = 3 * (y * W + x); if (Math.max(rgb[i]! - sky[0]!, rgb[i + 1]! - sky[1]!, rgb[i + 2]! - sky[2]!) < 24) continue;
  const east = -(x - target[0]) * pixelArcsec, north = -(y - target[1]) * pixelArcsec; reach = Math.max(reach, Math.hypot(east * Math.sin(pa) + north * Math.cos(pa), (-east * Math.cos(pa) + north * Math.sin(pa)) / cosTilt) * kpcPerArcsec); }
const edge = Math.min(target[0], W - 1 - target[0], target[1], H - 1 - target[1]) * pixelArcsec * kpcPerArcsec;
console.log(`gas picture: sky ${sky.join(', ')} of 255 (99% of the outer ring under ${high.join(', ')}); light 24 of 255 above it reaches ${reach.toFixed(2)} kpc in the disc's plane; the frame's nearest edge is ${edge.toFixed(2)} kpc from the page's place`);

// The recipe against the fit.
const held = recipe.observation, off = Math.hypot((held.centerRaDeg - centre[0]) * Math.cos(DEC0 * RAD), held.centerDecDeg - centre[1]) * 3600;
const agrees = off < 0.3 && Math.abs(held.fieldOfViewDeg[0] / field[0] - 1) < 1e-3 && Math.abs(held.fieldOfViewDeg[1] / field[1] - 1) < 1e-3 && Math.abs(held.northClockwiseDeg - northClockwiseDeg) < 0.05;
console.log(`recipe: centre ${held.centerRaDeg}, ${held.centerDecDeg} (${off.toFixed(2)} arcsec from the fit), field ${held.fieldOfViewDeg.join(' by ')} deg, north ${held.northClockwiseDeg} deg: ${agrees ? 'the fit\'s' : 'NOT the fit\'s'}`);
if (!agrees) process.exitCode = 1;
