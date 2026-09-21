#!/usr/bin/env node
/** Fit the one display number a published colour image does not print: the brightness stretch that maps a reflectance-colour
 * lens onto the publisher's own figure panel.
 *
 *   node tools/objects/circumstellar/fit-figure-stretch.mts <object id> <lens id> <figure.png> [--raw <dir>]...
 *
 * The lens's recipe (circumstellar.json) names its bands, the stellar flux each is divided by and, under `stretch.fit`, the
 * figure panel: its pixel box and its scale in figure pixels per arcsecond, north up and east left. Each band's MAST mosaic
 * is read about the star onto exactly that panel's pixel grid, divided by the star's flux, and averaged into the red, green
 * and blue channels the recipe names; each channel is shown as log(1 + a u) / log(1 + a) with u = reflectance / top, the form
 * the same paper prints its single-filter scales in. `a`, `top` and the star's offset in the panel (up to six pixels either
 * way) are fitted to the panel's colours between 1 and 4.4 arcseconds, the ring and its halo; the mirrored image is fitted too,
 * as a handedness check. The figure is read, never retained: only these numbers go into the recipe. */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { sha256File } from '../../../src/platform/sha256.mts';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { requireArray, requireFiniteNumber, requireRecord } from '../../source-values.mts';
import { mastFile } from '../astronomy-packages/mast.mts';
import { readImagingProgram } from '../jwst/imaging/image3.mts';
import { readFitsFileHdus } from '../../fits.mts';
import { readSkyPlane } from './disc-envelope.mts';
import { CHANNELS, parseCircumstellarRecipe, type ImageDeposit } from './recipe.mts';

export { CHANNELS, type ImageDeposit };

/** The stretch the paper prints its scales in: 0 below zero reflectance, 1 at `top`. */
export const stretchOf = (a: number, top: number) => (value: number) => Math.log1p(a * Math.max(0, Math.min(1, value / top))) / Math.log1p(a);

export const depositUrl = (deposit: ImageDeposit, path: string) => `https://raw.githubusercontent.com/${deposit.repository}/${deposit.commit}/${path}`;

/** Download one deposit file unless a file of its pinned size is already there, then enforce its sha256. */
async function depositFile(deposit: ImageDeposit, band: string, directory: string): Promise<string> {
  const file = deposit.files[band];
  if (!file) throw new Error(`The deposit has no image for ${band}.`);
  if (!/^[A-Za-z0-9._/-]+$/u.test(file.path) || file.path.includes('..')) throw new TypeError(`Invalid deposit path ${file.path}.`);
  const target = resolve(directory, 'deposit', file.path.replaceAll('/', '__'));
  const present = await stat(target).then(info => info.size, () => -1);
  if (present !== file.bytes) {
    const response = await fetch(depositUrl(deposit, file.path));
    if (!response.ok) throw new Error(`${file.path}: HTTP ${response.status} from the deposit.`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
  }
  const { sha256: digest, bytes } = await sha256File(target);
  if (bytes !== file.bytes || digest !== file.sha256) throw new Error(`${file.path} differs from its pinned ${file.bytes} bytes and sha256.`);
  return target;
}

/** A lens's channels on a square grid about the star: each band read from its MAST coron3 mosaic or from an author's deposit,
 * divided by the star's flux when the lens shows reflectance or kept as surface brightness when it shows the dust's own
 * emission, then averaged by channel. */
export async function lensChannels(options: { program?: string; deposit?: ImageDeposit; quantity: 'reflectance' | 'surface-brightness';
  channels: Readonly<Record<(typeof CHANNELS)[number], readonly string[]>>; stellarFluxJy?: Readonly<Record<string, number>>;
  distancePc: number; halfUnits: number; size: number; backgroundAnnulusArcsec: readonly [number, number]; downloads: string; sources: readonly string[] }) {
  const planes = new Map<string, Awaited<ReturnType<typeof readSkyPlane>>>(), divisors = new Map<string, number>();
  const bands = [...new Set(CHANNELS.flatMap(channel => options.channels[channel]))], entries = [];
  const program = options.program === undefined ? undefined : (await readImagingProgram(options.program)).program;
  if ((program === undefined) === (options.deposit === undefined)) throw new TypeError('A lens reads either a pinned program or a deposit.');
  for (const band of bands) {
    const divisor = options.quantity === 'reflectance' ? options.stellarFluxJy?.[band] : 1;
    if (!(divisor! > 0)) throw new Error(`No stellar flux for ${band}.`);
    divisors.set(band, divisor!);
    const common = { arcsecPerUnit: 1 / options.distancePc, halfUnits: options.halfUnits, size: options.size, backgroundAnnulusArcsec: options.backgroundAnnulusArcsec };
    if (program) {
      const entry = program.bands.find(other => other.band === band);
      if (!entry || entry.stage !== 'coron3') throw new Error(`${options.program} has no coron3 band ${band}.`);
      const mosaic = await mastFile(entry.level3, resolve(options.downloads, 'observations'), options.sources), primary = (await readFitsFileHdus(mosaic))[0]!.header;
      planes.set(band, await readSkyPlane(mosaic, { ...common, starRaDeg: requireFiniteNumber(primary.TARG_RA, 'TARG_RA'), starDecDeg: requireFiniteNumber(primary.TARG_DEC, 'TARG_DEC') }));
      entries.push({ band, entry, mosaic, primary });
    } else {
      const deposit = options.deposit!, image = await depositFile(deposit, band, options.downloads), primary = (await readFitsFileHdus(image))[0]!.header;
      planes.set(band, await readSkyPlane(image, { ...common, starRaDeg: deposit.starRaDeg, starDecDeg: deposit.starDecDeg, ...(deposit.backgroundSubtracted ? { subtractBackground: false } : {}), ...(deposit.files[band]!.blankValue === undefined ? {} : { blankValue: deposit.files[band]!.blankValue }) }));
      entries.push({ band, image, file: deposit.files[band]!, primary });
    }
  }
  const count = options.size * options.size;
  const channels = CHANNELS.map(channel => Float32Array.from({ length: count }, (_, p) =>
    options.channels[channel].reduce((total, band) => total + planes.get(band)!.plane[p]! / divisors.get(band)!, 0) / options.channels[channel].length));
  return { channels, planes, entries, divisors };
}

/** The reflectance channels on a square grid about the star: each band over its star's flux, averaged by channel. */
export const reflectanceChannels = (options: { program: string; channels: Readonly<Record<(typeof CHANNELS)[number], readonly string[]>>; stellarFluxJy: Readonly<Record<string, number>>;
  distancePc: number; halfUnits: number; size: number; backgroundAnnulusArcsec: readonly [number, number]; downloads: string; sources: readonly string[] }) =>
  lensChannels({ ...options, quantity: 'reflectance' });

/** Fit `a`, `top` and the star's offset to the figure panel's colours; returns the fit and the mirrored fit's error. */
export async function fitFigureStretch(figure: string, panel: { x0: number; y0: number; width: number; height: number; pixelsPerArcsec: number }, channels: readonly Float32Array[], size: number,
  radiiArcsec: readonly [number, number] = [1, 4.4]) {
  const { data, info } = await sharp(await readFile(figure)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (size !== panel.width || size !== panel.height) throw new RangeError('The channels are sampled on the panel\'s own square grid.');
  const panelAt = (row: number, col: number, c: number) => data[((panel.y0 + row) * info.width + panel.x0 + col) * info.channels + c]!;
  // The sky grid's x grows west and y north; the panel is north up and east left, so panel row r is grid row size-1-r.
  const oursAt = (row: number, col: number, c: number, mirrored: boolean) => channels[c]![(size - 1 - row) * size + (mirrored ? size - 1 - col : col)]!;
  const centre = (size - 1) / 2, samples: [number, number][] = [];
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const r = Math.hypot(row - centre, col - centre) / panel.pixelsPerArcsec;
    if (r > radiiArcsec[0] && r < radiiArcsec[1]) samples.push([row, col]);
  }
  const error = (a: number, top: number, dx: number, dy: number, mirrored: boolean) => {
    const f = stretchOf(a, top); let sum = 0, n = 0;
    for (const [row, col] of samples) {
      const r2 = row - dy, c2 = col - dx; if (r2 < 0 || c2 < 0 || r2 >= size || c2 >= size) continue;
      for (let c = 0; c < 3; c++) { const v = oursAt(r2, c2, c, mirrored); if (!Number.isFinite(v)) continue; sum += (f(v) * 255 - panelAt(row, col, c)) ** 2; n++; }
    }
    return Math.sqrt(sum / n);
  };
  const fit = (mirrored: boolean) => {
    let best = { rms: Infinity, a: 10, top: 1, dx: 0, dy: 0 };
    const tops = channels.flatMap(channel => [...channel].filter(Number.isFinite)).sort((p, q) => p - q), p995 = tops[Math.floor(0.995 * (tops.length - 1))]!;
    for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) for (let la = 0; la <= 2.5; la += 0.25) for (let lt = -1; lt <= 1; lt += 0.2) {
      const a = 10 ** la, top = p995 * 10 ** lt, rms = error(a, top, dx, dy, mirrored); if (rms < best.rms) best = { rms, a, top, dx, dy };
    }
    for (let round = 0, step = 1; round < 3; round++, step /= 2) {
      const { a: a0, top: t0, dx: x0, dy: y0 } = best;
      for (let dy = y0 - 1; dy <= y0 + 1; dy++) for (let dx = x0 - 1; dx <= x0 + 1; dx++) for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
        const a = a0 * 10 ** (i * 0.05 * step), top = t0 * 10 ** (j * 0.05 * step), rms = error(a, top, dx, dy, mirrored); if (rms < best.rms) best = { rms, a, top, dx, dy };
      }
    }
    return best;
  };
  const best = fit(false), mirrored = fit(true);
  // Correlation of luminance, the check that does not depend on the stretch's exact shape.
  const f = stretchOf(best.a, best.top); let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
  for (const [row, col] of samples) {
    const r2 = row - best.dy, c2 = col - best.dx; if (r2 < 0 || c2 < 0 || r2 >= size || c2 >= size) continue;
    const ours = [0, 1, 2].map(c => oursAt(r2, c2, c, false)); if (!ours.every(Number.isFinite)) continue;
    const x = ours.reduce((t, v) => t + f(v) * 255, 0) / 3, y = [0, 1, 2].reduce((t, c) => t + panelAt(row, col, c), 0) / 3;
    sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; n++;
  }
  const luminanceCorrelation = (n * sab - sa * sb) / Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb));
  return { a: best.a, top: best.top, offsetPixels: [best.dx, best.dy] as const, rgbRms: best.rms, luminanceCorrelation, mirroredRgbRms: mirrored.rms, samples: samples.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, lensId, figure] = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--raw');
  if (!id || !lensId || !figure) throw new TypeError('Usage: fit-figure-stretch <object id> <lens id> <figure.png> [--raw <dir>]...');
  const repository = resolve(import.meta.dirname, '../../..'), recipe = requireRecord(JSON.parse(await readFile(resolve(repository, 'src/objects', id, 'source/circumstellar.json'), 'utf8')) as unknown);
  const lens = requireArray(recipe.lenses).map(value => requireRecord(value)).find(value => value.id === lensId);
  if (!lens) throw new Error(`${id} has no lens ${lensId}.`);
  const fitRecord = requireRecord(requireRecord(lens.stretch).fit), box = requireRecord(fitRecord.panel);
  const scene = requireRecord(requireRecord(JSON.parse(await readFile(resolve(repository, 'src/objects', String(recipe.host), 'prepared/scene.json'), 'utf8')) as unknown).worldFrame);
  const distancePc = Math.hypot(...requireArray(scene.originM).map(v => requireFiniteNumber(v))) / 3.085677581491367e16;
  const panel = { x0: requireFiniteNumber(box.x0), y0: requireFiniteNumber(box.y0), width: requireFiniteNumber(box.width), height: requireFiniteNumber(box.height), pixelsPerArcsec: requireFiniteNumber(fitRecord.pixelsPerArcsec) };
  const annulus = requireArray(lens.backgroundAnnulusArcsec).map(v => requireFiniteNumber(v)) as [number, number];
  const parsed = parseCircumstellarRecipe(recipe).lenses.find(value => value.id === lensId)!;
  const { channels } = await lensChannels({ ...(parsed.program ? { program: parsed.program } : {}), ...(parsed.deposit ? { deposit: parsed.deposit } : {}), quantity: parsed.quantity,
    channels: parsed.channels, ...(parsed.stellarFluxJy ? { stellarFluxJy: parsed.stellarFluxJy } : {}), distancePc,
    halfUnits: panel.width / 2 / panel.pixelsPerArcsec * distancePc, size: panel.width, backgroundAnnulusArcsec: annulus, downloads: resolve(repository, `.local/${id}`),
    sources: args.flatMap((arg, i) => arg === '--raw' ? [resolve(args[i + 1]!)] : []) });
  const radii = fitRecord.radiiArcsec === undefined ? undefined : requireArray(fitRecord.radiiArcsec).map(v => requireFiniteNumber(v)) as [number, number];
  const result = await fitFigureStretch(resolve(figure), panel, channels, panel.width, radii);
  console.log(`FIGURE_STRETCH ${JSON.stringify({ ...result, a: +result.a.toFixed(3), top: +result.top.toPrecision(5), rgbRms: +result.rgbRms.toFixed(2), mirroredRgbRms: +result.mirroredRgbRms.toFixed(2), luminanceCorrelation: +result.luminanceCorrelation.toFixed(4) })}`);
}
