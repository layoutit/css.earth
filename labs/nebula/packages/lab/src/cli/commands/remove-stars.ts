/** The star-free copy of an image-layer bank's picture: `remove-stars <object-directory>`.
 *
 * Reads the bank's image-layer recipe (`source/recipe.json`), downloads the picture it names (`source.downloadUrl`) into
 * the ignored lab cache, removes its stars with NOX, fills the glow NOX leaves around the catalogued stars brighter than
 * `HALO_G` (the recipe's `source.foregroundStars` table, placed by the picture's own sky projection), and writes the
 * result as the bank's picture (`source/<source.path>`). The bank's manifest names this command as that file's generator.
 * NOX predicts the light under a star; it does not measure it. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { imageLayerView, parseImageLayerRecipe } from '@cssearth/bake/image-layers';
import { removeStarHaloes } from '@cssearth/nebula-reconstruction/star-removal/haloes';
import { nativeStarless } from '../../server/workflows/emission-inference/native-source.ts';

/** Stars brighter than this Gaia G keep a glow after NOX on the Sloan pictures (M66's: G 9.5 to 13.6); fainter ones do not. */
const HALO_G = 14;
/** The written picture: JPEG at this quality without chroma subsampling. */
const JPEG_QUALITY = 95;

const [objectArgument, ...rest] = process.argv.slice(2);
if (!objectArgument || rest.length) throw new TypeError('Usage: remove-stars <object-directory>');
const objectDirectory = resolve(objectArgument), sourceDirectory = resolve(objectDirectory, 'source');
const recipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(sourceDirectory, 'recipe.json'), 'utf8')) as unknown);
if (recipe.source.parentPixelWindow) throw new TypeError(`${recipe.id}: a windowed picture has its own generator; remove-stars reads a whole download.`);
if (!/^https:\/\//.test(recipe.source.downloadUrl)) throw new TypeError(`${recipe.id}: source.downloadUrl is not an https address.`);
const [width, height] = recipe.source.dimensions;

const cache = resolve('.local/nebula-lab/starless', recipe.id), originalPath = resolve(cache, 'original.jpg');
await mkdir(cache, { recursive: true });
let original: Buffer;
try { original = await readFile(originalPath); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  const response = await fetch(recipe.source.downloadUrl);
  if (!response.ok) throw new Error(`${recipe.id}: ${recipe.source.downloadUrl} answered ${response.status}.`);
  original = Buffer.from(await response.arrayBuffer());
  await writeFile(originalPath, original);
}
const native = await sharp(original).removeAlpha().toColorspace('srgb').raw().toBuffer({ resolveWithObject: true });
if (native.info.width !== width || native.info.height !== height || native.info.channels !== 3)
  throw new Error(`${recipe.id}: the download is ${native.info.width} x ${native.info.height}; the recipe says ${width} x ${height}.`);

const removed = await nativeStarless(original, [width, height], { directory: `.local/nebula-lab/starless/${recipe.id}/nox`, model: { path: '.local/open-star-removal/noxGeneratorColor.pb' } });
const starless = Uint8Array.from(removed.pixels);

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
console.log(`STARS_REMOVED ${recipe.id}: NOX over ${width} x ${height} px; ${filled.length} of ${haloes.length} stars brighter than G ${HALO_G} had a glow filled` +
  (filled.length ? ` (${filled.map(halo => `G ${halo.gMag.toFixed(1)}: ${halo.radiusPx} px`).join(', ')})` : '') +
  `; ${haloes.filter(halo => halo.outcome === 'no-end').length} glows without an end left as they are; wrote ${outputPath}`);
