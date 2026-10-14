#!/usr/bin/env node
/**
 * TRAPPIST-1's stellar wind as one picture on a plane in its system: the package `trappist-1-stellar-wind`, a plane bank
 * the world draws while the star's dataset "Stellar wind" is selected.
 *
 *   node packages/bake/authoring/trappist-1/stellar-wind.mts
 *
 * The wind is the model of Garraffo et al. (2017, ApJL 843, L33). Its Figure 3 (left) maps the wind's total pressure in the
 * plane of the orbits on a color scale, with the seven orbits as circles and the Alfven surface as a white line. The
 * figure is read from the preprint's source bundle on arXiv (kept beside the recipe, fetched when missing) and is not
 * tracked or redistributed: the script reads each pixel's place on the color scale and the white line's coverage, and
 * draws the pressure on the application's own scale palette with the line dashed over it. The figure's circles for planets b to g are laid on the orbits the world draws. Writes the
 * descriptor, the prepared plane and picture, and the inventory; prints what it measured.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import { bodyData, hostedOrbit, type BodyId, type HostedPlanetId } from '@cssearth/astronomy';
import { readArchiveMember } from '@cssearth/bake/galaxy-catalog';
import { encodeLossyWebp } from '@cssearth/bake/raster';
import { AU_M, systemOrbitPlane, writePlaneBank } from '../system-planes/system-plane.mts';

const root = findProjectRoot(import.meta.url), id = 'trappist-1-stellar-wind';
const objectDirectory = resolve(root, 'src/objects', id);
const recipe = requireRecord(JSON.parse(await readFile(resolve(objectDirectory, 'source/wind.json'), 'utf8')));
if (recipe.schema !== 'cssearth-stellar-wind-source@1' || recipe.id !== id) throw new TypeError(`source/wind.json: expected a cssearth-stellar-wind-source@1 record of ${id}.`);
const host = requireString(recipe.host), figure = requireRecord(recipe.figure), member = requireString(figure.member);
const orbits = requireArray(figure.orbits).map(value => requireString(value)), registerOn = requireArray(figure.registerOn).map(value => requireString(value));

// The figure, from the copy beside the recipe (not tracked) or the preprint's source bundle.
const cache = resolve(objectDirectory, requireString(figure.source));
if (!(await stat(cache).then(() => true, () => false))) {
  const bundle = requireString(figure.bundle), response = await fetch(bundle, { headers: { 'user-agent': 'css.earth preparation (https://css.earth)' } });
  if (!response.ok) throw new Error(`${bundle}: HTTP ${response.status}`);
  await mkdir(resolve(cache, '..'), { recursive: true }); await writeFile(cache, readArchiveMember(new Uint8Array(await response.arrayBuffer()), member));
}
const png = await readFile(cache);
if (png.length !== requireFiniteNumber(figure.memberBytes)) throw new TypeError(`${member}: ${png.length} bytes, not the ${String(figure.memberBytes)} of the figure this recipe was written for.`);
const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;

// The color scale runs red, yellow, green, cyan, blue, each step with one channel at 0 and one at 255. A pixel's place on
// it is 0 at red (the highest pressure) to 4 at blue; NaN off the scale (a line, the white background).
const SLACK = 8;
const scalePlace = (r: number, g: number, b: number): number => {
  if (Math.min(r, g, b) > SLACK || Math.max(r, g, b) < 255 - SLACK) return NaN;
  if (b <= SLACK && r >= 255 - SLACK) return g / 255;
  if (b <= SLACK && g >= 255 - SLACK) return 1 + (255 - r) / 255;
  if (r <= SLACK && g >= 255 - SLACK) return 2 + b / 255;
  if (r <= SLACK && b >= 255 - SLACK) return 3 + (255 - g) / 255;
  return NaN;
};
const place = new Float32Array(W * H), white = new Float32Array(W * H);
let x0 = W, x1 = 0, y0 = H, y1 = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const at = (y * W + x) * 3, r = data[at]!, g = data[at + 1]!, b = data[at + 2]!;
  place[y * W + x] = scalePlace(r, g, b); white[y * W + x] = Math.min(r, g, b) / 255;
  // The disc is everything that is not the white page, inside the figure's frame.
  if (white[y * W + x]! < 0.9 && x > 3 && y > 3 && x < W - 4 && y < H - 4) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
}
const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, discPx = Math.min(x1 - x0, y1 - y0) / 2;
if (Math.abs((x1 - x0) - (y1 - y0)) > 2) throw new TypeError(`${member}: the disc is ${x1 - x0 + 1} by ${y1 - y0 + 1} pixels, not round.`);

// The orbit circles: radii at which the scale's place, taken round the disc, leaves its neighbors' on each side and their
// mean. A slope leaves neither's mean, and a circle beside the radius is one of the two sides.
const median = (values: number[]) => { const kept = values.filter(value => !Number.isNaN(value)).sort((a, b) => a - b); return kept.length === 0 || kept.length < values.length / 2 ? NaN : kept[kept.length >> 1]!; };
const ANGLES = 720, CENTRE_DOT_PX = 12;
const round = Array.from({ length: Math.floor(discPx) + 1 }, (_, radius) => median(Array.from({ length: ANGLES }, (_, step) => {
  const angle = step * 2 * Math.PI / ANGLES; return place[Math.round(cy - radius * Math.sin(angle)) * W + Math.round(cx + radius * Math.cos(angle))]!;
})));
const lines: { radiusPx: number; halfWidthPx: number }[] = [];
for (let radius = CENTRE_DOT_PX + 8, start = -1; radius <= round.length; radius++) {
  const inner = median(round.slice(radius - 14, radius - 7)), outer = median(round.slice(radius + 8, radius + 15));
  const sides = [inner, outer].filter(value => !Number.isNaN(value)), far = (value: number) => Math.abs(round[radius]! - value) > 0.2;
  const off = radius < round.length && (Number.isNaN(round[radius]!) || (sides.every(far) && far(sides.reduce((sum, value) => sum + value, 0) / sides.length)));
  if (off && start < 0) start = radius;
  if (!off && start >= 0) { lines.push({ radiusPx: (start + radius - 1) / 2, halfWidthPx: (radius - start) / 2 }); start = -1; }
}
if (lines.length !== orbits.length) throw new TypeError(`${member}: found ${lines.length} circles at ${lines.map(line => line.radiusPx).join(', ')} px, not the ${orbits.length} orbits.`);

// The figure's scale: its circles for the registered planets, laid on the orbits the world draws.
const starRadiusKm = bodyData(host as BodyId).meanRadiusKm;
const orbitM = orbits.map(planet => hostedOrbit(planet as HostedPlanetId).semiMajorAxisStellarRadii * starRadiusKm * 1000);
const registered = orbits.map((planet, index) => ({ planet, index })).filter(({ planet }) => registerOn.includes(planet));
if (registered.length !== registerOn.length || registered.length < 2) throw new TypeError('source/wind.json figure.registerOn: expected two or more of figure.orbits.');
const metersPerPx = registered.reduce((sum, { index }) => sum + orbitM[index]! * lines[index]!.radiusPx, 0) / registered.reduce((sum, { index }) => sum + lines[index]!.radiusPx ** 2, 0);
const misfit = orbits.map((_, index) => lines[index]!.radiusPx * metersPerPx / orbitM[index]! - 1);
if (registered.some(({ index }) => Math.abs(misfit[index]!) > 0.015)) throw new TypeError(`${member}: a registered circle lies ${Math.max(...registered.map(({ index }) => Math.abs(misfit[index]!) * 100)).toFixed(1)} % off its orbit.`);

// The field under the lines: only pixels on the scale, clear of the circles and the centre dot, count; a Gaussian
// average of those fills the rest. The outermost circle is the figure's edge.
const edge = lines.at(-1)!, edgePx = edge.radiusPx, valid = new Float32Array(W * H), weighted = new Float32Array(W * H);
const share = white.slice(), softOnCircle: number[] = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const at = y * W + x, radius = Math.hypot(x - cx, y - cy), onLine = lines.some(line => Math.abs(radius - line.radiusPx) <= line.halfWidthPx + 2);
  if (!Number.isNaN(place[at]!) && !onLine && radius >= CENTRE_DOT_PX && radius < edgePx) { valid[at] = 1; weighted[at] = place[at]!; }
  // The white line's coverage: a pixel between the line and the field keeps one channel's share of white. A circle's
  // edge against the field holds up to half of white too, so on a circle only pixels the white line fills count, and
  // the softer ones that touch them: the line's own edge there.
  const within = radius >= CENTRE_DOT_PX && radius <= edgePx - edge.halfWidthPx - 2;
  if (within && onLine && white[at]! >= 0.1 && white[at]! < 0.8) softOnCircle.push(at);
  if (!within || white[at]! < (onLine ? 0.8 : 0.1)) white[at] = 0;
}
const filled = (at: number) => [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1].some(step => white[at + step]! >= 0.8);
for (const at of softOnCircle.filter(filled)) white[at] = share[at]!;
const SIGMA = 4, REACH = 3 * SIGMA, kernel = Array.from({ length: 2 * REACH + 1 }, (_, tap) => Math.exp(-((tap - REACH) ** 2) / (2 * SIGMA ** 2)));
const blur = (source: Float32Array) => {
  const across = new Float32Array(W * H), down = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = REACH; x < W - REACH; x++) { let sum = 0; for (let tap = -REACH; tap <= REACH; tap++) sum += source[y * W + x + tap]! * kernel[tap + REACH]!; across[y * W + x] = sum; }
  for (let y = REACH; y < H - REACH; y++) for (let x = 0; x < W; x++) { let sum = 0; for (let tap = -REACH; tap <= REACH; tap++) sum += across[(y + tap) * W + x]! * kernel[tap + REACH]!; down[y * W + x] = sum; }
  return down;
};
const sum = blur(weighted), weight = blur(valid);

// How often each orbit meets the white line: runs of covered samples round the figure's own circle.
const crossings = lines.map(line => {
  const covered = Array.from({ length: 3600 }, (_, step) => { const angle = step * 2 * Math.PI / 3600; return white[Math.round(cy - line.radiusPx * Math.sin(angle)) * W + Math.round(cx + line.radiusPx * Math.cos(angle))]! >= 0.5; });
  return covered.filter((value, step) => value && !covered[(step + covered.length - 1) % covered.length]).length;
});

// The figure's line is about seven pixels wide, and thinner at a few joints. A line of one width keeps the pixels within
// half that width of the line's middle, the middle being where a pixel lies deepest inside the line; a three-by-three
// average then softens its edge.
const picture = requireRecord(recipe.picture), boundaryWidth = requireFiniteNumber(picture.boundaryWidthPx);
if (!(boundaryWidth >= 1 && boundaryWidth <= 7)) throw new TypeError('source/wind.json picture.boundaryWidthPx: expected the width to draw the line with, 1 to 7 figure pixels.');
const NEAR = 6, onLinePixels: number[] = [], depth = new Float32Array(W * H), thin = new Float32Array(W * H);
for (let at = 0; at < W * H; at++) {
  if (!(white[at]! >= 0.5)) continue;
  let nearest = NEAR + 1;
  for (let dy = -NEAR; dy <= NEAR; dy++) for (let dx = -NEAR; dx <= NEAR; dx++) if (!(white[at + dy * W + dx]! >= 0.5)) nearest = Math.min(nearest, Math.hypot(dx, dy));
  depth[at] = nearest; onLinePixels.push(at);
}
for (const at of onLinePixels) {
  let deepest = 0;
  for (let dy = -NEAR; dy <= NEAR; dy++) for (let dx = -NEAR; dx <= NEAR; dx++) deepest = Math.max(deepest, depth[at + dy * W + dx]!);
  if (deepest - depth[at]! < boundaryWidth / 2) thin[at] = 1;
}
white.fill(0);
for (const at of onLinePixels) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) white[at + dy * W + dx]! += thin[at]! * (2 - Math.abs(dx)) * (2 - Math.abs(dy)) / 16;

// The boundary as dashes: each stretch of the white line is measured along itself from one of its ends, and the dashes
// are cut by that length, so they keep their size where the line turns.
const dash = requireArray(picture.boundaryDashPx).map(value => requireFiniteNumber(value));
if (dash.length !== 2 || !(dash[0]! > 0 && dash[1]! > 0)) throw new TypeError('source/wind.json picture.boundaryDashPx: expected a dash and a gap, in figure pixels.');
const along = (seed: number, reach?: Float64Array) => {
  // Shortest paths over the line's pixels, a step to a corner neighbor costing the diagonal.
  const length = reach ?? new Float64Array(W * H).fill(Infinity), heap: [number, number][] = [[0, seed]], seen: number[] = [];
  length[seed] = 0;
  while (heap.length) {
    const [reached, at] = heap[0]!, last = heap.pop()!;
    if (heap.length) { heap[0] = last; for (let node = 0; ;) { const left = 2 * node + 1, right = left + 1; let least = node; if (left < heap.length && heap[left]![0] < heap[least]![0]) least = left; if (right < heap.length && heap[right]![0] < heap[least]![0]) least = right; if (least === node) break; [heap[node], heap[least]] = [heap[least]!, heap[node]!]; node = least; } }
    if (reached > length[at]!) continue;
    seen.push(at);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const next = at + dy * W + dx, further = reached + Math.hypot(dx, dy);
      if ((dx || dy) && white[next]! > 0 && further < length[next]!) {
        length[next] = further; heap.push([further, next]);
        for (let node = heap.length - 1; node > 0;) { const parent = (node - 1) >> 1; if (heap[parent]![0] <= heap[node]![0]) break; [heap[node], heap[parent]] = [heap[parent]!, heap[node]!]; node = parent; }
      }
    }
  }
  return { length, seen };
};
const lineLength = new Float64Array(W * H).fill(Infinity), stretches: number[] = [], dashed = new Float32Array(W * H);
for (let at = 0; at < W * H; at++) {
  if (!(white[at]! > 0) || lineLength[at]! < Infinity) continue;
  // From any pixel of the stretch its farthest pixel is an end; the stretch is measured from that end.
  const first = along(at), end = first.seen.at(-1)!, measured = along(end, lineLength);
  if (measured.seen.length < 50) { for (const pixel of measured.seen) white[pixel] = 0; continue; }
  // A whole number of dashes fits the stretch, with half a dash at each end: a line that closes on itself meets in a dash.
  const whole = lineLength[measured.seen.at(-1)!]!, period = whole / Math.max(1, Math.round(whole / (dash[0]! + dash[1]!))), on = period * dash[0]! / (dash[0]! + dash[1]!);
  for (const pixel of measured.seen) if ((lineLength[pixel]! + on / 2) % period < on) dashed[pixel] = white[pixel]!;
  stretches.push(whole);
}

// The picture: the pressure on the palette, more opaque where it is higher, and the dashed boundary over it.
const size = requireFiniteNumber(picture.sizePx), outerPx = requireFiniteNumber(picture.outerRadiusPx);
const opacity = requireRecord(picture.opacity), low = requireFiniteNumber(opacity.low), high = requireFiniteNumber(opacity.high), boundaryOpacity = requireFiniteNumber(picture.boundaryOpacity);
const palette = requireArray(picture.palette).map(stop => requireArray(stop).map(channel => requireFiniteNumber(channel)));
const boundaryHex = requireString(picture.boundaryColor);
if (!/^#[0-9a-f]{6}$/u.test(boundaryHex)) throw new TypeError('source/wind.json picture.boundaryColor: expected a color like #a0b0c0.');
const boundaryColor = [1, 3, 5].map(at => parseInt(boundaryHex.slice(at, at + 2), 16));
if (!Number.isInteger(size) || !(outerPx > 0 && outerPx < size / 2) || !(low >= 0 && low <= high && high <= 1) || !(boundaryOpacity > 0 && boundaryOpacity <= 1) ||
    palette.length < 2 || palette.some(stop => stop.length !== 3 || stop.some(channel => !(channel >= 0 && channel <= 255)))) throw new TypeError('source/wind.json picture: expected a size, an outer radius inside it, a palette of colors and opacities from 0 to 1.');
const perPx = edgePx / outerPx, rgba = Buffer.alloc(size * size * 4), strengthAt: number[] = orbits.map(() => 0);
const sample = (grid: Float32Array, x: number, y: number) => {
  const left = Math.floor(x), top = Math.floor(y), fx = x - left, fy = y - top, at = top * W + left;
  return (grid[at]! * (1 - fx) + grid[at + 1]! * fx) * (1 - fy) + (grid[at + W]! * (1 - fx) + grid[at + W + 1]! * fx) * fy;
};
// 0 at the blue end of the figure's scale (the lowest pressure) to 1 at its red end.
const strength = (x: number, y: number) => Math.min(1, Math.max(0, 1 - sample(sum, x, y) / sample(weight, x, y) / 4));
const paletteColor = (value: number, channel: number) => { const place = value * (palette.length - 1), stop = Math.min(palette.length - 2, Math.floor(place)); return palette[stop]![channel]! + (palette[stop + 1]![channel]! - palette[stop]![channel]!) * (place - stop); };
let drawn = 0;
for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
  const dx = i - (size - 1) / 2, dy = j - (size - 1) / 2, inside = Math.min(1, Math.max(0, outerPx + 0.5 - Math.hypot(dx, dy)));
  if (inside === 0) continue;
  const x = cx + dx * perPx, y = cy + dy * perPx, value = strength(x, y), field = (low + (high - low) * value) * inside, boundary = boundaryOpacity * sample(dashed, x, y) * inside;
  const alpha = boundary + field * (1 - boundary), at = (j * size + i) * 4;
  for (let channel = 0; channel < 3; channel++) rgba[at + channel] = Math.round((boundaryColor[channel]! * boundary + paletteColor(value, channel) * field * (1 - boundary)) / alpha);
  rgba[at + 3] = Math.round(alpha * 255); if (rgba[at + 3]! > 0) drawn++;
}
orbits.forEach((_, index) => { strengthAt[index] = strength(cx + lines[index]!.radiusPx, cy); });
const image = sharp(rgba, { raw: { width: size, height: size, channels: 4 } });
const webp = await encodeLossyWebp(image, { effort: 6 }), lossless = await image.clone().webp({ lossless: true, effort: 6 }).toBuffer();

const plane = await systemOrbitPlane(root, host, orbits), outerRadiusM = edgePx * metersPerPx;
await writePlaneBank({ id, objectDirectory, host, recipe: 'source/wind.json', plane, texturePath: 'wind/wind.webp', webp, sizePx: size, alphaCoverage: drawn / size ** 2,
  outerRadiusPx: outerPx, outerRadiusM, source: `Garraffo et al. (2017), Figure 3 left (${member} of ${requireString(figure.bundle)})`, meaning: requireString(recipe.meaning),
  centreFadeM: requireArray(recipe.centreFadeOuterRadii).map(value => requireFiniteNumber(value) * outerRadiusM), orbitOpacity: requireFiniteNumber(recipe.orbitOpacity) });
console.log(`${id}: figure ${W} by ${H} px, disc centre ${cx}, ${cy}, radius ${discPx} px; ${(metersPerPx / AU_M * 1e6).toFixed(2)} millionths of an au per pixel.`);
orbits.forEach((planet, index) => console.log(`  ${planet}: circle at ${lines[index]!.radiusPx} px, ${(lines[index]!.radiusPx * metersPerPx / AU_M).toFixed(5)} au against the world's ${(orbitM[index]! / AU_M).toFixed(5)} au (${(misfit[index]! * 100).toFixed(2)} %); ` +
  `meets the white line ${crossings[index]} times; scale place ${((1 - strengthAt[index]!) * 4).toFixed(2)}, opacity ${(low + (high - low) * strengthAt[index]!).toFixed(3)}.`));
console.log(`  the picture ends at ${(outerRadiusM / AU_M).toFixed(5)} au; the planets' orbit normals lie within ${plane.spreadDegrees.toFixed(3)} degrees of the plane's; the white line, measured from an end of each stretch: ${stretches.map(length => `${length.toFixed(0)} px`).join(', ')}; picture ${webp.length} bytes (${lossless.length} lossless).`);
