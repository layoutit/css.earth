// Entry script: node packages/bake/authoring/homunculus-nebula/filament-map.mts <bank directory> <raw directory> [--report=<directory>]
/**
 * The dust filaments on the Homunculus's lobes (`<bank>/source/filaments.png`, 0 to 255 for 0 to 1 on the bank's face
 * grid): the map the bake draws on the published surface as dark lines (`geometry.surface.filaments`).
 *
 * Images: the picture itself, and HST ACS/HRC F220W and F550M (GO 9973, 2003 September 13 and November 14, in
 * `<raw directory>` as MAST serves them). Dust absorbs the ultraviolet most, so F220W shows the dust lanes deepest;
 * F550M is the same camera's visible band. Each band is registered on the picture by its lobes' fine detail
 * (./sky-registration.mts `register`; both are the picture's own epoch).
 *
 * In each image the filaments are found as dark lines at four widths (`lineStrengths`, ./filaments.ts in the bake), and
 * the images and widths weighted into one map (`filamentMap`). The weights, threshold, gain and gamma were chosen on
 * the Nebula Lab's filament tuner, over the lobes (brightness above `LIT` of the picture's).
 */
import { filamentMap, imageLayerDisc, imageLayerView, lineStrengths, parseImageLayerRecipe, prepareImageLayerFace } from '@cssearth/bake/image-layers';
import { dot3 as dot } from '@cssearth/core';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { blurred, onPicture, readSkyImage, register, type PictureGrid } from './sky-registration.mts';

const FILES = { f220w: 'hst_9973_5a_acs_hrc_f220w_j8ma5a_drz.fits', f550m: 'hst_9973_6a_acs_hrc_f550m_j8ma6a_drz.fits' } as const;
/** WFC3/UVIS F280N (GO 15289, 2018 March 5): the lobes' detail beside the star, where the picture is the star's glare. */
const F280N = 'hst_15289_01_wfc3_uvis_f280n_idm501_drc.fits';
/** The picture's epoch (its ACS/HRC exposures, 2003 September to November) and the Great Eruption's: F280N starts its
 * registration from free expansion between them. */
const PICTURE_YEAR = 2003.79, EJECTED = 1843;
/** The detail map: each band's log brightness less its Gaussian blur over DETAIL_SMOOTH_PX, F220W's blurred over
 * DETAIL_DENOISE_PX first (its exposure is 84 s), in units of the band's own scatter over the lobes; F280N's saturated
 * pixels (above DETAIL_SATURATED of its brightest) and DETAIL_MASK_PX around them left out. A band counts as far as its
 * smooth brightness stands above the sky, from none at the sky's level to all at the lobes' median. */
export const DETAIL_SMOOTH_PX = 10, DETAIL_DENOISE_PX = 1.2, DETAIL_SATURATED = 0.12, DETAIL_MASK_PX = 8;
/** The lobes, where the strengths are scaled: picture brightness (the mean of its channels, 0 to 1) above this. */
export const LIT = 0.15;
/** The line widths, Gaussian sigmas in face pixels, and the tuner's settings: the picture, F220W and F550M's weights, each width's weight, then threshold, gain and gamma. */
export const WIDTHS_PX = [1, 1.5, 2.5, 4];
export const SETTINGS = { sources: [0.45, 0.25, 0.25], widths: [0.3, 0.65, 0.2, 0.35], threshold: 0.11, gain: 2.6, gamma: 1 };

const [bankArgument = '', rawArgument = '', ...flags] = process.argv.slice(2), report = flags.find(item => item.startsWith('--report='))?.slice(9);
if (!bankArgument || !rawArgument) throw new TypeError(`Usage: filament-map.mts <bank directory> <raw directory>; got ${JSON.stringify(process.argv.slice(2))}.`);
const bank = resolve(bankArgument), recipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(bank, 'source/recipe.json'), 'utf8')) as unknown);
const path = recipe.geometry.surface?.filaments?.path;
if (!path) throw new TypeError(`${bank}: the recipe's surface names no filament map (geometry.surface.filaments.path).`);
const { rgb, info } = await prepareImageLayerFace({ sourceDirectory: resolve(bank, 'source'), recipe }), W = info.width, H = info.height, count = W * H;
// Each picture pixel's place, arcsec east and north of the star, as the bake reads it.
const view = imageLayerView(recipe), disc = imageLayerDisc(recipe), arcsec = 180 * 3600 / Math.PI, grid: PictureGrid = { width: W, height: H, east: new Float32Array(count), north: new Float32Array(count), star: { raDeg: recipe.target.centerRaDeg, decDeg: recipe.target.centerDecDeg } };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const ray = view.ray(2 * (x + .5) / W - 1, 1 - 2 * (y + .5) / H), along = dot(ray, disc.target); grid.east[y * W + x] = dot(ray, disc.east) / along * arcsec; grid.north[y * W + x] = dot(ray, disc.north) / along * arcsec; }
const brightness = Float32Array.from({ length: count }, (_, p) => (rgb[3 * p]! + rgb[3 * p + 1]! + rgb[3 * p + 2]!) / 765), lit = Uint8Array.from(brightness, value => value > LIT ? 1 : 0);
const luminance = Float32Array.from(brightness, value => 765 * value), place = { ...grid.star, radiusArcsec: 20 }, images: Float32Array[] = [brightness];
for (const [name, file] of Object.entries(FILES)) {
  const image = await readSkyImage(resolve(rawArgument, file), place, name.toUpperCase()), found = register(image, grid, luminance, { scale: 1, east: 0, north: 0 });
  console.log(`${image.name}: registered at scale ${found.scale.toFixed(4)}, ${found.east.toFixed(3)}″ east, ${found.north.toFixed(3)}″ north, correlation ${found.correlation.toFixed(3)}`);
  images.push(onPicture(image, grid, found));
}
// With `--report`: each band as placed, over the picture (red the picture, green the band), and the map over the picture.
const grey = (values: ArrayLike<number>) => { const sorted = Array.from(values).filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b), lo = Math.log(sorted[Math.floor(sorted.length * .02)] ?? 1e-6), hi = Math.log(sorted[Math.floor(sorted.length * .998)] ?? 1);
  return Uint8Array.from({ length: count }, (_, p) => { const v = values[p]!; return Number.isFinite(v) && v > 0 ? Math.round(255 * Math.max(0, Math.min(1, (Math.log(v) - lo) / (hi - lo)))) : 0; }); };
const pair = (a: Uint8Array, b: Uint8Array, file: string) => { const out = Buffer.alloc(3 * count); for (let p = 0; p < count; p++) { out[3 * p] = a[p]!; out[3 * p + 1] = b[p]!; } return sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile(resolve(report!, file)); };
if (report) { const picture = grey(brightness); for (const [index, name] of Object.keys(FILES).entries()) await pair(picture, grey(images[index + 1]!), `${name}-on-picture.png`); await pair(grey(images[1]!), grey(images[2]!), 'f220w-f550m.png'); }
const map = filamentMap(images.map(image => lineStrengths(image, W, H, lit, WIDTHS_PX)), SETTINGS);
await sharp(Buffer.from(Uint8Array.from(map, value => Math.round(255 * value))), { raw: { width: W, height: H, channels: 1 } }).png().toFile(resolve(bank, 'source', path));
if (report) { const out = Buffer.alloc(3 * count); for (let p = 0; p < count; p++) for (let c = 0; c < 3; c++) out[3 * p + c] = Math.round(rgb[3 * p + c]! * (1 - .65 * map[p]!)); await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile(resolve(report, 'filaments-over-picture.png')); }
console.log(`${resolve(bank, 'source', path)}: ${W} x ${H}, ${(100 * map.filter(value => value > .5).length / count).toFixed(1)}% of pixels above half strength`);
// The detail map (`geometry.surface.filaments.detailPath`): red 128 plus 40 times the detail in units of scatter, green how far it counts.
const detailPath = recipe.geometry.surface?.filaments?.detailPath;
if (detailPath) {
  const f280n = await readSkyImage(resolve(rawArgument, F280N), place, 'F280N'), grown = (f280n.year - EJECTED) / (PICTURE_YEAR - EJECTED), placed280 = onPicture(f280n, grid, register(f280n, grid, luminance, { scale: grown, east: 0, north: 0 }, .5));
  const sky = Uint8Array.from(brightness, value => value < .05 ? 1 : 0), median = (values: Float32Array, mask: Uint8Array) => { const v: number[] = []; for (let p = 0; p < count; p++) if (mask[p] && Number.isFinite(values[p]!)) v.push(values[p]!); v.sort((a, b) => a - b); return v[v.length >> 1] ?? 0; };
  const bandDetail = (values: Float32Array, denoise: number, saturated: boolean) => {
    const positive = Array.from(values).filter(v => v > 0).sort((a, b) => a - b), floor = positive[Math.floor(positive.length * .05)] ?? 1e-6, top = positive[positive.length - 1] ?? 1;
    const log = Float32Array.from(values, v => Math.log(Math.max(floor, Number.isFinite(v) ? v : floor))), own = denoise ? blurred(log, W, H, denoise) : log, smooth = blurred(log, W, H, DETAIL_SMOOTH_PX);
    const bad = new Uint8Array(count); if (saturated) for (let p = 0; p < count; p++) if (values[p]! >= DETAIL_SATURATED * top) { const x = p % W, y = (p - x) / W; for (let dy = -DETAIL_MASK_PX; dy <= DETAIL_MASK_PX; dy++) for (let dx = -DETAIL_MASK_PX; dx <= DETAIL_MASK_PX; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) bad[Y * W + X] = 1; } }
    const detail = Float32Array.from(own, (v, p) => v - smooth[p]!), spread = (() => { const v: number[] = []; for (let p = 0; p < count; p++) if (lit[p] && !bad[p]) v.push(Math.abs(detail[p]!)); v.sort((a, b) => a - b); return (v[v.length >> 1] ?? 1) / .6745 || 1; })();
    const skyLevel = median(smooth, sky), lobeLevel = median(smooth, lit);
    return { detail: Float32Array.from(detail, v => v / spread), weight: Float32Array.from(smooth, (v, p) => bad[p] ? 0 : Math.max(0, Math.min(1, (v - skyLevel) / (lobeLevel - skyLevel || 1)))) }; };
  const bands = [bandDetail(images[1]!, DETAIL_DENOISE_PX, false), bandDetail(placed280, 0, true)], out = Buffer.alloc(3 * count);
  for (let p = 0; p < count; p++) { let sum = 0, weight = 0; for (const band of bands) { sum += band.weight[p]! * band.detail[p]!; weight += band.weight[p]!; }
    out[3 * p] = Math.max(0, Math.min(255, Math.round(128 + 40 * (weight > 0 ? sum / weight : 0)))); out[3 * p + 1] = Math.round(255 * Math.min(1, Math.max(...bands.map(band => band.weight[p]!)))); }
  await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile(resolve(bank, 'source', detailPath));
  console.log(`${resolve(bank, 'source', detailPath)}: F280N registered at scale ${grown.toFixed(4)} from ${f280n.year}`);
}
