// Entry script: node packages/bake/authoring/ngc-3132/grid-fit.mts [bank id, ngc-3132-layers if none]
/**
 * How the published density grid of NGC 3132 (Monteiro et al. 2025, github.com/hektor-monteiro/NGC3132_model) lies on
 * the bank's picture. The paper made the grid from velocity cubes: one of its axes is the sight line, the other two the
 * sky. The file says neither which, nor how the sky axes are turned, nor which end of the sight line is toward the Sun.
 *
 * Measured here:
 *  - The sight line is the axis along which the gas is smoothest. An emission line is some 27 km/s wide in the
 *    instrument, which is many cells of depth, so no detail a cell wide survives along that axis; across the sky it does.
 *  - The turn on the sky: the grid's emission (density squared, summed along the sight line) is laid on the picture for
 *    each handedness and every turn about the star, and for small shifts of its middle. Both are compared after the mean
 *    in rings about the star is taken off each, so what is compared is how the nebula departs from round. The best is
 *    the placement that correlates most.
 *  - Which end is toward the Sun: Kastner et al. (2024) find the main ring's eastern edge approaching and its western
 *    edge receding. The end of the sight-line axis at which the gas east of the star stands, along the ring's minor
 *    axis, is the end toward the Sun.
 *  - How far the star's own light reaches in the picture: past its saturated middle, its brightness in rings about the
 *    star falls until a ring is no brighter than the ten past it.
 *
 * Input: the bank's `source/recipe.json` for the star's place, `source/source.jpg` with its embedded sky tags and the grid
 * file beside it. Each picture of the nebula is its own bank; the grid's place on the sky must come out the same from each.
 * Output: printed.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { densityGrid } from '@cssearth/bake/image-layers';

/** The grid: its file, its side in cells, and a cell in centimetres (the step between its rows). */
const GRID_FILE = 'ngc3132_density_structure_101.dat', CELLS = 101, CELL_CM = 1.015e16;
/** The distance the paper adopts (Gaia DR3, Bailer-Jones et al. 2021), parsecs, and an astronomical unit in centimetres. */
const DISTANCE_PC = 754, AU_CM = 1.495978707e13;
/** The picture is searched at this many pixels across. */
const SEARCH_PIXELS = 400;
/** The minor axis of the main ring (Kastner et al. 2024), degrees east of north, and how far along it the two sides are read, arcseconds. */
const MINOR_AXIS_PA_DEG = 60, SIDE_FROM_ARCSEC = 8, SIDE_TO_ARCSEC = 28;
/** The width of the rings the star's light is measured in, arcseconds, and the level from which a ring is saturated. */
const RING_ARCSEC = 0.1, SATURATED = 250;
/** The star's patch of saturated pixels is looked for within this many arcseconds of where the picture's tags put it:
 * the mid-infrared picture shows a second star 1.8 arcsec away. */
const STAR_WITHIN_ARCSEC = 1;

const bank = process.argv[2] ?? 'ngc-3132-layers', sourceDirectory = resolve(checkoutProjectRoot(import.meta.url), 'src/objects', bank, 'source'), rad = Math.PI / 180;
if (!/^ngc-3132(-[a-z]+)?-layers$/u.test(bank)) throw new TypeError(`${JSON.stringify(bank)} is not a bank of NGC 3132.`);
const grid = densityGrid(await readFile(resolve(sourceDirectory, GRID_FILE), 'utf8'), CELLS, GRID_FILE), N = CELLS, middle = (N - 1) / 2, cellArcsec = CELL_CM / AU_CM / DISTANCE_PC;
const at = (i: number, j: number, k: number) => grid[(i * N + j) * N + k]!;

// The sight line: the axis with the least detail a cell wide.
const detail = [0, 1, 2].map(axis => { let sum = 0, mean = 0;
  for (let i = 1; i < N - 1; i++) for (let j = 1; j < N - 1; j++) for (let k = 1; k < N - 1; k++) { const here = at(i, j, k), before = axis === 0 ? at(i - 1, j, k) : axis === 1 ? at(i, j - 1, k) : at(i, j, k - 1), after = axis === 0 ? at(i + 1, j, k) : axis === 1 ? at(i, j + 1, k) : at(i, j, k + 1); if (here > 0 && before > 0 && after > 0) { sum += Math.abs(here - (before + after) / 2); mean += here; } }
  return sum / mean; });
const sight = detail.indexOf(Math.min(...detail));
console.log(`A cell is ${cellArcsec.toFixed(4)} arcsec at ${DISTANCE_PC} pc. Detail a cell wide, as a share of the density, along the file's axes: ${detail.map(value => value.toFixed(4)).join(', ')}: axis ${sight + 1} is the sight line.`);
if (sight !== 0) throw new Error('The bake reads a grid whose first axis is the sight line; this one is not.');

// The picture, its sky tags and its star.
const file = await readFile(resolve(sourceDirectory, 'source.jpg')), tags = file.toString('latin1');
const tag = (name: string) => { const found = new RegExp(`<avm:${name}>([\\s\\S]*?)</avm:${name}>`, 'u').exec(tags) ?? new RegExp(`avm:${name}="([^"]*)"`, 'u').exec(tags); if (!found) throw new Error(`source.jpg has no avm:${name}.`); return found[1]!.replace(/<[^>]+>/gu, ' ').trim().split(/\s+/u).map(Number); };
const pixelArcsec = Math.abs(tag('Spatial.Scale')[0]!) * 3600, rotation = tag('Spatial.Rotation')[0]! * rad;
const full = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true }), fullWidth = full.info.width, fullHeight = full.info.height;
// Where the tags alone put the star: the recipe's target, from the tags' reference place and pixel (counted from the bottom).
const target = (JSON.parse(await readFile(resolve(sourceDirectory, 'recipe.json'), 'utf8')) as { target: { centerRaDeg: number; centerDecDeg: number } }).target, reference = tag('Spatial.ReferenceValue'), referencePixel = tag('Spatial.ReferencePixel'), degrees = Math.abs(tag('Spatial.Scale')[0]!);
const eastPixels = (target.centerRaDeg - reference[0]!) * Math.cos(target.centerDecDeg * rad) / degrees, northPixels = (target.centerDecDeg - reference[1]!) / degrees;
const tagged = [referencePixel[0]! - eastPixels * Math.cos(rotation) - northPixels * Math.sin(rotation), fullHeight - (referencePixel[1]! - eastPixels * Math.sin(rotation) + northPixels * Math.cos(rotation))] as const, within = Math.round(STAR_WITHIN_ARCSEC / pixelArcsec);
// The star: the largest patch of saturated pixels that starts within that reach of the place.
const saturated = (p: number) => full.data[3 * p]! >= 250 && full.data[3 * p + 1]! >= 250 && full.data[3 * p + 2]! >= 250, seen = new Uint8Array(fullWidth * fullHeight); let star = { pixels: 0, x: 0, y: 0, from: 0 };
for (let y = Math.max(0, Math.round(tagged[1] - within)); y <= Math.min(fullHeight - 1, tagged[1] + within); y++) for (let x = Math.max(0, Math.round(tagged[0] - within)); x <= Math.min(fullWidth - 1, tagged[0] + within); x++) { const start = y * fullWidth + x; if (seen[start] || !saturated(start) || Math.hypot(x - tagged[0], y - tagged[1]) > within) continue; let pixels = 0, sumX = 0, sumY = 0; const stack = [start]; seen[start] = 1;
  for (let p = stack.pop(); p !== undefined; p = stack.pop()) { const px = p % fullWidth, py = (p - px) / fullWidth; pixels++; sumX += px; sumY += py; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const q = (py + dy) * fullWidth + px + dx; if (px + dx < 0 || py + dy < 0 || px + dx >= fullWidth || py + dy >= fullHeight || seen[q] || !saturated(q)) continue; seen[q] = 1; stack.push(q); } }
  if (pixels > star.pixels) star = { pixels, x: sumX / pixels, y: sumY / pixels, from: Math.hypot(sumX / pixels - tagged[0], sumY / pixels - tagged[1]) }; }
if (!star.pixels) throw new Error(`${bank}: source.jpg has no saturated pixel within ${STAR_WITHIN_ARCSEC} arcsec of where its tags put the nebula's star (pixel ${tagged[0].toFixed(1)}, ${tagged[1].toFixed(1)}).`);
// North and east in the picture, in pixels right and down: the tags turn north counter-clockwise from up.
const north = [-Math.sin(rotation), -Math.cos(rotation)] as const, east = [-Math.cos(rotation), Math.sin(rotation)] as const;
console.log(`The picture: ${fullWidth} x ${fullHeight} px, ${pixelArcsec.toFixed(5)} arcsec a pixel, north ${Math.abs(rotation / rad).toFixed(2)} degrees ${rotation < 0 ? 'right' : 'left'} of vertical. The star: ${star.pixels} saturated pixels about ${star.x.toFixed(1)}, ${star.y.toFixed(1)}, ${(star.from * pixelArcsec).toFixed(2)} arcsec from where the tags alone put it.`);

// The picture, smaller, and the grid's emission summed along the sight line.
const width = SEARCH_PIXELS, shrink = fullWidth / width, height = Math.round(fullHeight / shrink), small = await sharp(file).resize(width, height).greyscale().blur(1).raw().toBuffer(), arcsecPerPixel = pixelArcsec * shrink, starX = star.x / shrink, starY = star.y / shrink;
const emission = new Float32Array(N * N); for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) { let sum = 0; for (let i = 0; i < N; i++) sum += at(i, j, k) ** 2; emission[j * N + k] = sum; }
const sample = (u: number, v: number) => { const j = Math.floor(u), k = Math.floor(v); if (j < 0 || k < 0 || j >= N - 1 || k >= N - 1) return 0; const a = u - j, b = v - k; return (1 - a) * ((1 - b) * emission[j * N + k]! + b * emission[j * N + k + 1]!) + a * ((1 - b) * emission[(j + 1) * N + k]! + b * emission[(j + 1) * N + k + 1]!); };
// The mean in rings about the star, taken off: how an image departs from round.
const ringOf = new Int32Array(width * height); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) ringOf[y * width + x] = Math.round(Math.hypot(x - starX, y - starY) / 2);
const unround = (values: ArrayLike<number>) => { const sum: number[] = [], count: number[] = []; for (let p = 0; p < width * height; p++) { sum[ringOf[p]!] = (sum[ringOf[p]!] ?? 0) + values[p]!; count[ringOf[p]!] = (count[ringOf[p]!] ?? 0) + 1; } const out = new Float32Array(width * height); for (let p = 0; p < width * height; p++) out[p] = values[p]! - sum[ringOf[p]!]! / count[ringOf[p]!]!; return out; };
const picture = unround(small), model = new Float32Array(width * height);
/** How well the grid's emission matches the picture with its second axis toward `turn` degrees east of north, its third a
 * quarter turn on (`hand` 1) or back (`hand` -1), and its middle `shift` arcseconds east and north of the star. */
const match = (turn: number, hand: number, shiftEast: number, shiftNorth: number) => { const t = turn * rad, second = [Math.sin(t), Math.cos(t)] as const, third = [Math.sin(t + hand * Math.PI / 2), Math.cos(t + hand * Math.PI / 2)] as const;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const dx = (x - starX) * arcsecPerPixel, dy = (y - starY) * arcsecPerPixel, e = dx * east[0] + dy * east[1] - shiftEast, n = dx * north[0] + dy * north[1] - shiftNorth; model[y * width + x] = sample(middle + (e * second[0] + n * second[1]) / cellArcsec, middle + (e * third[0] + n * third[1]) / cellArcsec); }
  const flat = unround(model); let top = 0, a = 0, b = 0; for (let p = 0; p < width * height; p++) { top += flat[p]! * picture[p]!; a += flat[p]! * flat[p]!; b += picture[p]! * picture[p]!; } return top / Math.sqrt(a * b); };
const found: { turn: number; hand: number; r: number }[] = []; for (const hand of [1, -1]) for (let turn = 0; turn < 360; turn += 2) found.push({ turn, hand, r: match(turn, hand, 0, 0) });
let best = { ...[...found].sort((a, b) => b.r - a.r)[0]!, east: 0, north: 0 };
const others = [{ name: 'half a turn on', turn: (best.turn + 180) % 360, hand: best.hand }, { name: 'the other handedness', hand: -best.hand, turn: [...found].filter(one => one.hand === -best.hand).sort((a, b) => b.r - a.r)[0]!.turn }].map(one => `${one.name} ${found.find(other => other.turn === one.turn && other.hand === one.hand)!.r.toFixed(3)}`);
console.log(`Unshifted: best ${best.r.toFixed(3)} with the second axis ${best.turn} degrees east of north, the third a quarter turn ${best.hand > 0 ? 'on (toward east from north)' : 'back'}; ${others.join(', ')}.`);
for (let pass = 0; pass < 2; pass++) {
  for (let de = -4; de <= 4; de += .5) for (let dn = -4; dn <= 4; dn += .5) { const r = match(best.turn, best.hand, de, dn); if (r > best.r) best = { ...best, r, east: de, north: dn }; }
  for (let turn = best.turn - 4; turn <= best.turn + 4; turn += .5) { const r = match(turn, best.hand, best.east, best.north); if (r > best.r) best = { ...best, r, turn }; } }
console.log(`Placed: second axis ${((best.turn % 360) + 360) % 360} degrees east of north, third ${(((best.turn + best.hand * 90) % 360) + 360) % 360}; the grid's middle ${best.east} arcsec east and ${best.north} arcsec north of the star; correlation ${best.r.toFixed(3)}.`);

// Which end is toward the Sun: where the gas east of the star stands along the sight-line axis, against the gas west of it.
const t = best.turn * rad, second = [Math.sin(t), Math.cos(t)] as const, third = [Math.sin(t + best.hand * Math.PI / 2), Math.cos(t + best.hand * Math.PI / 2)] as const, minor = [Math.sin(MINOR_AXIS_PA_DEG * rad), Math.cos(MINOR_AXIS_PA_DEG * rad)] as const;
const side = (sign: number) => { let sum = 0, weight = 0; for (let along = SIDE_FROM_ARCSEC; along <= SIDE_TO_ARCSEC; along += cellArcsec) { const e = sign * along * minor[0] - best.east, n = sign * along * minor[1] - best.north, j = Math.round(middle + (e * second[0] + n * second[1]) / cellArcsec), k = Math.round(middle + (e * third[0] + n * third[1]) / cellArcsec); if (j < 0 || k < 0 || j >= N || k >= N) continue; for (let i = 0; i < N; i++) { const light = at(i, j, k) ** 2; sum += light * (i - middle); weight += light; } } return sum / weight * cellArcsec; };
const eastSide = side(1), westSide = side(-1);
console.log(`Along position angle ${MINOR_AXIS_PA_DEG}, ${SIDE_FROM_ARCSEC} to ${SIDE_TO_ARCSEC} arcsec from the star, the gas stands ${eastSide.toFixed(1)} arcsec from the grid's middle along the sight-line axis on the east side and ${westSide.toFixed(1)} on the west: the eastern edge approaches (Kastner et al. 2024), so the ${eastSide > westSide ? 'high' : 'low'} end is toward the Sun.`);

// The gas's outline and the star's light.
let low = [N, N], high = [-1, -1]; for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) if (emission[j * N + k]! > 0) { low = [Math.min(low[0]!, j), Math.min(low[1]!, k)]; high = [Math.max(high[0]!, j), Math.max(high[1]!, k)]; }
console.log(`The gas spans ${((high[0]! - low[0]! + 1) * cellArcsec).toFixed(0)} arcsec along the second axis and ${((high[1]! - low[1]! + 1) * cellArcsec).toFixed(0)} along the third.`);
const rings: number[][] = []; for (let y = 0; y < fullHeight; y++) for (let x = 0; x < fullWidth; x++) { const p = 3 * (y * fullWidth + x), ring = Math.floor(Math.hypot(x - star.x, y - star.y) * pixelArcsec / RING_ARCSEC); if (ring < 80) (rings[ring] ??= []).push(Math.max(full.data[p]!, full.data[p + 1]!, full.data[p + 2]!)); }
const middleOf = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!, levels = rings.map(middleOf), ends = levels.findIndex((level, ring) => level < SATURATED && ring + 10 < levels.length && level <= middleOf(levels.slice(ring + 1, ring + 11)));
if (ends < 0) throw new Error(`The star's light does not end within ${(rings.length * RING_ARCSEC).toFixed(0)} arcsec of the star.`);
console.log(`The star's light: ${(Math.sqrt(star.pixels / Math.PI) * pixelArcsec).toFixed(2)} arcsec of saturated pixels in radius; it ends ${(ends * RING_ARCSEC).toFixed(1)} arcsec from the star, where the picture is as bright (${levels[ends]} of 255) as over the arcsecond past it.`);
