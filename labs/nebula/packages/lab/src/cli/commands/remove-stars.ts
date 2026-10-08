/** The star-free copy of an image-layer bank's picture: `remove-stars <object-directory> [--from=<file>] [--coarse=<factor>] [--star-red-over-blue=<ratio>] [--star-green-over-blue=<ratio>] [--star-most-pixels=<count>] [--spike-lines=<count>]`.
 *
 * Reads the bank's image-layer recipe (`source/recipe.json`), downloads the picture it names (`source.downloadUrl`) into
 * the ignored lab cache, or with `--from` takes a picture another generator wrote into the bank's `source/` directory (a
 * window cut from the download), and removes its stars with NOX. With `--coarse` NOX runs again over a copy that many
 * times smaller, for the saturated stars too wide for the first pass, and the picture takes that pass's result where it
 * took a star. With `--star-red-over-blue` the light NOX took is read by its color and the picture keeps its own pixels
 * where that light is redder than a star's: NOX takes a remnant's bright knots for stars; with `--star-green-over-blue`
 * also where it is greener than a star's, and with `--star-most-pixels` a patch NOX took that is larger than that is
 * read pixel by pixel, not as one star (both need `--star-red-over-blue`). With `--spike-lines` (it needs
 * `--star-red-over-blue`) the bright stars NOX leaves, with their diffraction spikes on that many lines, are taken out
 * (../../../../reconstruction/src/star-removal/spikes.ts). Then it fills the glow NOX leaves around the catalogued stars brighter than `HALO_G` (the recipe's
 * `source.foregroundStars` table, placed by the picture's own sky projection), and writes the result as the bank's
 * picture (`source/<source.path>`). The bank's manifest names this command as that file's generator.
 * NOX predicts the light under a star; it does not measure it. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { imageLayerView, parseImageLayerRecipe } from '@cssearth/bake/image-layers';
import { takeCoarsePass } from '@cssearth/nebula-reconstruction/star-removal/coarse';
import { giveBackGas } from '@cssearth/nebula-reconstruction/star-removal/star-color';
import { removeSpikedStars } from '@cssearth/nebula-reconstruction/star-removal/spikes';
import { removeStarHaloes } from '@cssearth/nebula-reconstruction/star-removal/haloes';
import { nativeStarless } from '../../server/workflows/emission-inference/native-source.ts';

/** Stars brighter than this Gaia G keep a glow after NOX on the Sloan pictures (M66's: G 9.5 to 13.6); fainter ones do not. */
const HALO_G = 14;
/** The written picture: JPEG at this quality without chroma subsampling. */
const JPEG_QUALITY = 95;

const USAGE = 'Usage: remove-stars <object-directory> [--from=<file in its source directory>] [--coarse=<whole factor, 2 to 8>] [--star-red-over-blue=<ratio, above 0>] [--star-green-over-blue=<ratio, above 0>] [--star-most-pixels=<whole count>] [--spike-lines=<whole count, 1 to 8>]';
const [objectArgument, ...rest] = process.argv.slice(2), options = new Map(rest.map(argument => { const match = /^--(from|coarse|star-red-over-blue|star-green-over-blue|star-most-pixels|spike-lines)=(.+)$/.exec(argument); if (!match) throw new TypeError(`${USAGE}; got ${JSON.stringify(argument)}.`); return [match[1]!, match[2]!] as const; }));
if (!objectArgument || options.size !== rest.length) throw new TypeError(USAGE);
const from = options.get('from'), coarse = options.has('coarse') ? Number(options.get('coarse')) : undefined, starRedOverBlue = options.has('star-red-over-blue') ? Number(options.get('star-red-over-blue')) : undefined;
if (from !== undefined && (from.startsWith('/') || from.split('/').includes('..') || /[\\\0]/.test(from))) throw new TypeError(`--from names a file inside the bank's source directory; got ${JSON.stringify(from)}.`);
if (coarse !== undefined && (!Number.isInteger(coarse) || coarse < 2 || coarse > 8)) throw new TypeError(`--coarse is a whole factor from 2 to 8; got ${JSON.stringify(options.get('coarse'))}.`);
if (starRedOverBlue !== undefined && !(starRedOverBlue > 0 && Number.isFinite(starRedOverBlue))) throw new TypeError(`--star-red-over-blue is a ratio above 0; got ${JSON.stringify(options.get('star-red-over-blue'))}.`);
const starGreenOverBlue = options.has('star-green-over-blue') ? Number(options.get('star-green-over-blue')) : undefined, starMostPixels = options.has('star-most-pixels') ? Number(options.get('star-most-pixels')) : undefined;
if (starGreenOverBlue !== undefined && (!(starGreenOverBlue > 0 && Number.isFinite(starGreenOverBlue)) || starRedOverBlue === undefined)) throw new TypeError(`--star-green-over-blue is a ratio above 0, with --star-red-over-blue; got ${JSON.stringify(options.get('star-green-over-blue'))}.`);
if (starMostPixels !== undefined && (!Number.isInteger(starMostPixels) || starMostPixels < 1 || starRedOverBlue === undefined)) throw new TypeError(`--star-most-pixels is a whole count of pixels, with --star-red-over-blue; got ${JSON.stringify(options.get('star-most-pixels'))}.`);
const spikeLines = options.has('spike-lines') ? Number(options.get('spike-lines')) : undefined;
if (spikeLines !== undefined && (!Number.isInteger(spikeLines) || spikeLines < 1 || spikeLines > 8 || starRedOverBlue === undefined)) throw new TypeError(`--spike-lines is a whole count from 1 to 8, with --star-red-over-blue; got ${JSON.stringify(options.get('spike-lines'))}.`);
const objectDirectory = resolve(objectArgument), sourceDirectory = resolve(objectDirectory, 'source');
const recipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(sourceDirectory, 'recipe.json'), 'utf8')) as unknown);
if (recipe.source.parentPixelWindow) throw new TypeError(`${recipe.id}: a windowed picture has its own generator; remove-stars reads a whole download.`);
if (!/^https:\/\//.test(recipe.source.downloadUrl)) throw new TypeError(`${recipe.id}: source.downloadUrl is not an https address.`);
const [width, height] = recipe.source.dimensions;

const cache = resolve('.local/nebula-lab/starless', recipe.id), originalPath = resolve(cache, 'original.jpg');
await mkdir(cache, { recursive: true });
let original: Buffer;
if (from !== undefined) {
  if (from === recipe.source.path) throw new TypeError(`${recipe.id}: --from is the file remove-stars writes (${from}); the recipe's source.path names the star-free copy.`);
  original = await readFile(resolve(sourceDirectory, from));
} else {
  try { original = await readFile(originalPath); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const response = await fetch(recipe.source.downloadUrl);
    if (!response.ok) throw new Error(`${recipe.id}: ${recipe.source.downloadUrl} answered ${response.status}.`);
    original = Buffer.from(await response.arrayBuffer());
    await writeFile(originalPath, original);
  }
}
const native = await sharp(original).removeAlpha().toColorspace('srgb').raw().toBuffer({ resolveWithObject: true });
if (native.info.width !== width || native.info.height !== height || native.info.channels !== 3)
  throw new Error(`${recipe.id}: the download is ${native.info.width} x ${native.info.height}; the recipe says ${width} x ${height}.`);

const model = { path: '.local/open-star-removal/noxGeneratorColor.pb' };
const removed = await nativeStarless(original, [width, height], { directory: `.local/nebula-lab/starless/${recipe.id}/nox`, model });
const starless = Uint8Array.from(removed.pixels);

let colorPass = '';
if (starRedOverBlue !== undefined) {
  const gas = giveBackGas(starless, Uint8Array.from(native.data), width, height, starRedOverBlue, { ...(starGreenOverBlue === undefined ? {} : { greenOverBlue: starGreenOverBlue }), ...(starMostPixels === undefined ? {} : { mostPixels: starMostPixels }) });
  colorPass = `; of ${gas.patches} patches NOX took, ${gas.starPatches} are star-colored (red at most ${starRedOverBlue} of blue${starGreenOverBlue === undefined ? '' : `, green at most ${starGreenOverBlue}`}${starMostPixels === undefined ? '' : `, at most ${starMostPixels} px`}); ${gas.givenBackPixels} px given back, ${gas.takenPixels} px taken`;
}

let spikePass = '';
if (spikeLines !== undefined) {
  const spiked = removeSpikedStars(starless, Uint8Array.from(native.data), width, height, spikeLines, starRedOverBlue!);
  spikePass = `; ${spiked.stars.length} bright stars with spikes on lines at ${spiked.angles.join(', ')}° taken out (${spiked.spikePixels} spike px, ${spiked.corePixels} core and glow px)`;
}

let coarsePass = '';
if (coarse !== undefined) {
  const smallWidth = Math.round(width / coarse), smallHeight = Math.round(height / coarse);
  const small = sharp(Buffer.from(starless), { raw: { width, height, channels: 3 } }).resize(smallWidth, smallHeight, { kernel: 'lanczos3', fit: 'fill' });
  const before = Uint8Array.from(await small.clone().raw().toBuffer());
  const again = await nativeStarless(await small.clone().png().toBuffer(), [smallWidth, smallHeight], { directory: `.local/nebula-lab/starless/${recipe.id}/nox-coarse${coarse}`, model });
  const { replacedPixels } = takeCoarsePass(starless, width, height, before, Uint8Array.from(again.pixels), smallWidth, smallHeight);
  coarsePass = `; NOX again over a ${smallWidth} x ${smallHeight} px copy replaced ${(replacedPixels / (width * height) * 100).toFixed(2)}% of the picture`;
}

const table = recipe.source.foregroundStars;
let haloes: ReturnType<typeof removeStarHaloes> = [];
if (table) {
  const lines = (await readFile(resolve(sourceDirectory, table.path), 'utf8')).trim().split(/\r?\n/), header = lines[0]!.split(',');
  const column = (name: string) => { const index = header.indexOf(name); if (index < 0) throw new TypeError(`${recipe.id}: ${table.path} has no ${JSON.stringify(name)} column; its header is ${lines[0]}.`); return index; };
  const ra = column(table.raDegColumn), dec = column(table.decDegColumn), g = column(table.gMagColumn), view = imageLayerView(recipe);
  const stars = lines.slice(1).flatMap((line, row) => {
    const cells = line.split(','), values = [ra, dec, g].map(index => cells[index]?.trim() ? Number(cells[index]) : Number.NaN);
    if (values.some(value => !Number.isFinite(value))) throw new TypeError(`${recipe.id}: ${table.path} row ${row + 2} has no finite ${table.raDegColumn}, ${table.decDegColumn} or ${table.gMagColumn}: ${line}.`);
    if (values[2]! >= HALO_G) return [];
    const crop = view.crop(values[0]!, values[1]!);
    return crop ? [{ id: cells[0]!.trim(), x: (crop[0] + 1) / 2 * width - 0.5, y: (1 - crop[1]) / 2 * height - 0.5, gMag: values[2]! }] : [];
  }).filter(star => star.x >= 0 && star.y >= 0 && star.x < width && star.y < height);
  // The target sits where the recipe says, which need not be the picture's centre.
  const target = view.crop(recipe.target.centerRaDeg, recipe.target.centerDecDeg) ?? [0, 0];
  haloes = removeStarHaloes(starless, width, height, stars, [(target[0] + 1) / 2 * width - 0.5, (1 - target[1]) / 2 * height - 0.5]);
}

const outputPath = resolve(sourceDirectory, recipe.source.path);
await sharp(Buffer.from(starless), { raw: { width, height, channels: 3 } }).jpeg({ quality: JPEG_QUALITY, chromaSubsampling: '4:4:4' }).toFile(outputPath);
const filled = haloes.filter(halo => halo.outcome === 'filled');
console.log(`STARS_REMOVED ${recipe.id}: NOX over ${width} x ${height} px${colorPass}${spikePass}${coarsePass}; ${filled.length} of ${haloes.length} stars brighter than G ${HALO_G} had a glow filled` +
  (filled.length ? ` (${filled.map(halo => `G ${halo.gMag.toFixed(1)}: ${halo.radiusPx} px`).join(', ')})` : '') +
  `; ${haloes.filter(halo => halo.outcome === 'no-end').length} glows without an end left as they are; wrote ${outputPath}`);
