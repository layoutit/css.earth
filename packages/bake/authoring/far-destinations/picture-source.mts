import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
// Entry script: node packages/bake/authoring/far-destinations/picture-source.mts <object id>...
/**
 * The picture each far destination's image-layer bank bakes: a publisher's image, or the part of it that shows the
 * object. Each bank's acquisition record (`src/objects/<id>-layers/source/provenance.json`, `acquisition`) names the
 * publisher's file (`url`), its pixel size (`dimensions`) and, for a part, the window cut from it (`window`: x, y, width,
 * height from the top left) and the size it is written at (`outputDimensions`). The recipe's own `source.dimensions` is
 * that written size: the recipe's sky geometry describes the written picture, not the publisher's whole frame.
 *
 * The publisher's file is downloaded once into `output/far-destinations/` and kept there. The window is cut without
 * resampling when `outputDimensions` equals the window's size, otherwise resized with a Lanczos kernel, and written as
 * `source/source.jpg` (JPEG quality 95, 4:4:4 chroma). A record without a window takes the publisher's file unchanged.
 * How each window was placed and what one of its pixels spans on the sky is in the same record.
 *
 * A record may also keep only a band of the window (`band`: `points`, a path in the publisher's pixels, `halfWidthPx` and
 * `featherPx`): light within the half width of the path is kept whole, fades to black over the feather, and is black
 * beyond it. It is for a lensed arc that crosses a field of nearer galaxies, which do not stand at the arc's distance.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';
import type { Sharp } from 'sharp';

const repository = checkoutProjectRoot(import.meta.url);
const ids = process.argv.slice(2);
if (!ids.length) throw new TypeError('Usage: picture-source.mts <object id>...');

interface Band { points: [number, number][]; halfWidthPx: number; featherPx: number }
interface Acquisition { url: string; dimensions: [number, number]; window?: [number, number, number, number]; outputDimensions?: [number, number]; band?: Band }

/** The window's pixels with everything beyond the band's feather black: each pixel is scaled by how near the path it lies. */
async function keepBand(cut: Sharp, left: number, top: number, band: Band): Promise<Sharp> {
  const { data, info } = await cut.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const segments = band.points.slice(1).map((point, index) => [band.points[index]!, point] as const);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const px = x + left, py = y + top;
    let nearest = Infinity;
    for (const [[ax, ay], [bx, by]] of segments) {
      const dx = bx - ax, dy = by - ay, along = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
      nearest = Math.min(nearest, Math.hypot(px - ax - along * dx, py - ay - along * dy));
    }
    const kept = nearest <= band.halfWidthPx ? 1 : Math.max(0, 1 - (nearest - band.halfWidthPx) / band.featherPx), at = (y * info.width + x) * 3;
    data[at] = Math.round(data[at]! * kept); data[at + 1] = Math.round(data[at + 1]! * kept); data[at + 2] = Math.round(data[at + 2]! * kept);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } });
}
for (const id of ids) {
  const recordPath = resolve(repository, `src/objects/${id}-layers/source/provenance.json`);
  const source = (JSON.parse(await readFile(recordPath, 'utf8')) as { acquisition?: Acquisition }).acquisition;
  if (!source?.url || !Array.isArray(source.dimensions)) throw new TypeError(`${recordPath}: acquisition needs url and dimensions.`);
  const cachePath = resolve(repository, 'output/far-destinations', `${id}-${basename(new URL(source.url).pathname) || 'download'}`);
  await mkdir(resolve(repository, 'output/far-destinations'), { recursive: true });
  if (!await stat(cachePath).then(() => true, () => false)) {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`${id}: ${source.url} answered ${response.status}.`);
    await writeFile(cachePath, Buffer.from(await response.arrayBuffer()));
  }
  const parent = sharp(cachePath, { limitInputPixels: false }), meta = await parent.metadata();
  if (meta.width !== source.dimensions[0] || meta.height !== source.dimensions[1]) {
    throw new TypeError(`${id}: ${source.url} is ${meta.width} x ${meta.height} px, not the record's ${source.dimensions.join(' x ')}.`);
  }
  const outputPath = resolve(repository, `src/objects/${id}-layers/source/source.jpg`), window = source.window;
  if (!window) {
    await writeFile(outputPath, await readFile(cachePath));
  } else {
    const [left, top, width, height] = window;
    if (left + width > meta.width || top + height > meta.height) throw new TypeError(`${id}: window ${window.join(', ')} leaves the ${meta.width} x ${meta.height} px file.`);
    const whole = parent.extract({ left, top, width, height }), band = source.band;
    if (band && (!Array.isArray(band.points) || band.points.length < 2 || !(band.halfWidthPx > 0) || !(band.featherPx > 0))) throw new TypeError(`${id}: band needs at least two points, a half width and a feather, got ${JSON.stringify(band)}.`);
    const cut = band ? await keepBand(whole, left, top, band) : whole;
    const [outputWidth, outputHeight] = source.outputDimensions ?? [width, height];
    const sized = outputWidth === width && outputHeight === height ? cut : cut.resize(outputWidth, outputHeight, { kernel: 'lanczos3', fit: 'fill' });
    await sized.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toFile(outputPath);
  }
  console.log(JSON.stringify({ id, output: outputPath, bytes: (await stat(outputPath)).size, window: window ?? null, band: source.band ? source.band.points.length : null }));
}
