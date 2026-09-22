/**
 * Author a body's Voyager colour frames as the per-frame products the observed-colour lens reads: an equirectangular float32
 * GeoTIFF of calibrated I/F and a geometry label (exposure epoch and body rotation) for each frame.
 *
 *   node tools/objects/voyager-iss/author-color-frames.mts <object> [--write]
 *
 * Two kinds of frame, named by the recipe `source/preparation/voyager-color-frames.json`:
 * - `geomed`: a PDS Ring-Moon Systems Node GEOMED frame placed here by its recorded pointing and a limb fit (place.mts). A frame
 *   whose limb does not agree with one circle is rejected and reported, never placed.
 * - `controlled-ortho`: an orthophoto from a controlled release, already placed by its authors; only reprojected.
 * Limb-placed frames are moved by the recipe's measured datum shift onto the controlled release's grid.
 */
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fromFile } from 'geotiff';
import { kernelBankPaths } from '../../spice/kernel-bank.mts';
import { loadKernelSet } from '../../spice/kernel-set.mts';
import { orthographicPoint } from '../terrestrial-layers/orthographic-observation.mts';
import { sampleColorBand } from '../terrestrial-layers/scientific-raster.mts';
import { numericRasterBands } from '../terrestrial-layers/source-records.mts';
import { decodeGeomed, equirectangularGeoTiff, equirectangularTiles, placeFrame, projectFrame, type EquirectangularTile, type VoyagerRoute } from './place.mts';

interface Recipe {
  schema: 'cssearth-voyager-color-frames@1';
  kernelSet: string; kernels: string[]; ckToleranceSeconds: number;
  route: VoyagerRoute; cellDegrees: number;
  wavelengthsMicrometers: Record<string, number>;
  /** Body rotation written into every geometry label, copied from the pinned PCK the controlled release also used. */
  rotation: Record<'PoleRa' | 'PoleDec' | 'PrimeMeridian' | 'PoleRaNutPrec' | 'PoleDecNutPrec' | 'PmNutPrec' | 'SysNutPrec0' | 'SysNutPrec1', number[]>;
  controlledArchive: string; controlledDirectory: string;
  output: { frames: string; labels: string; report: string };
  observations: { id: string; frames: { id: string; kind: 'geomed' | 'controlled-ortho'; path?: string; labelPath?: string }[] }[];
}

const root = resolve(import.meta.dirname, '../../..');
/** Grid cells that divide the globe evenly; a frame takes the coarsest one no larger than half its own pixel, and never finer than the recipe's cell. */
const CELL_LADDER = [0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6];
const frameCell = (pixelScaleKm: number, radiusKm: number, finest: number) => {
  const half = pixelScaleKm / 2 / (radiusKm * Math.PI / 180);
  return Math.max(finest, ...CELL_LADDER.filter(c => c <= half));
};
const pvl = (key: string, values: number[]) => `  ${key.padEnd(18)} = (${values.join(', ')})`;
const geometryLabel = (et: number, rotation: Recipe['rotation']) => [
  'Object = VoyagerColorFrameGeometry',
  `  CkTableStartTime   = ${et}`,
  ...Object.entries(rotation).map(([key, values]) => pvl(key, values)),
  'End_Object', 'End', ''].join('\n');

export async function authorColorFrames(objectId: string, write: boolean) {
  const objectDirectory = resolve(root, 'src/objects', objectId), sourceDirectory = resolve(objectDirectory, 'source');
  const recipe: Recipe = JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/voyager-color-frames.json'), 'utf8'));
  if (recipe.schema !== 'cssearth-voyager-color-frames@1') throw new TypeError('Unknown Voyager colour frame recipe.');
  const set = await loadKernelSet(await kernelBankPaths(recipe.kernelSet, recipe.kernels), { ckToleranceSeconds: recipe.ckToleranceSeconds });
  const radiusMeters = recipe.route.radiusKm * 1000, cell = recipe.cellDegrees, report: Record<string, unknown>[] = [];
  const scratch = await mkdtemp(resolve(tmpdir(), 'cssearth-voyager-color-'));
  try {
    for (const observation of recipe.observations) for (const frame of observation.frames) {
      let tiles: EquirectangularTile[] = [], filter: string, et: number, entry: Record<string, unknown>, frameCellDegrees = cell;
      if (frame.kind === 'geomed') {
        const bytes = await readFile(resolve(sourceDirectory, frame.path!)), labelText = await readFile(resolve(sourceDirectory, frame.labelPath!), 'utf8');
        const placed = placeFrame(frame.id, bytes, labelText, set, recipe.route);
        filter = placed.filter; et = placed.et;
        entry = { kind: 'geomed', pixelScaleKm: +placed.pixelScaleKm.toFixed(3), limb: { accepted: placed.accepted, edgePoints: placed.limb.edgePoints,
          candidates: placed.limb.candidates, rmsPixels: +placed.limb.rmsPixels.toFixed(3), shiftPixels: placed.limb.shift.map(v => +v.toFixed(2)) } };
        if (!placed.accepted) { report.push({ id: frame.id, observation: observation.id, filter, ...entry, placed: false }); continue; }
        frameCellDegrees = frameCell(placed.pixelScaleKm, recipe.route.radiusKm, cell);
        tiles = projectFrame(placed, decodeGeomed(bytes).values, recipe.route, frameCellDegrees) ?? [];
      } else {
        // A controlled orthophoto: every pixel's latitude and longitude follow from its map projection.
        const member = `${recipe.controlledDirectory}/${frame.id}.ortho.tif`, archive = resolve(sourceDirectory, recipe.controlledArchive);
        const xml = execFileSync('unzip', ['-p', archive, `${member}.aux.xml`]).toString();
        const meta = JSON.parse(xml.match(/<Metadata[^>]*>([\s\S]*?)<\/Metadata>/)![1]!);
        filter = meta.IsisCube.BandBin.FilterName; et = meta.Table_BodyRotation.CkTableStartTime;
        const mapping = meta.IsisCube.Mapping, tif = resolve(scratch, 'frame.tif');
        await writeFile(tif, execFileSync('unzip', ['-p', archive, member], { maxBuffer: 1 << 28 }));
        const file = await fromFile(tif), image = await file.getImage();
        const band = { data: numericRasterBands(await image.readRasters())[0], width: image.getWidth(), height: image.getHeight(), origin: image.getOrigin(),
          resolution: image.getResolution(), noData: image.getGDALNoData(), specialValueMagnitude: 1e30 };
        await file.close();
        const columns = Math.round(360 / cell), rows = Math.round(180 / cell), full = new Float32Array(columns * rows).fill(NaN);
        for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
          const point = orthographicPoint((x + 0.5) * cell, 90 - (y + 0.5) * cell, { centerLongitude: mapping.CenterLongitude, centerLatitude: mapping.CenterLatitude, radius: radiusMeters });
          if (!point) continue;
          const value = sampleColorBand(band as never, point[0], point[1]);
          if (value === null || !Number.isFinite(value)) continue;
          full[y * columns + x] = value;
        }
        tiles = equirectangularTiles(full, columns, rows);
        entry = { kind: 'controlled-ortho', pixelScaleKm: +(band.resolution[0]! / 1000).toFixed(3) };
      }
      if (!tiles.length) { report.push({ id: frame.id, observation: observation.id, filter, ...entry, placed: false, reason: 'no usable surface on the grid' }); continue; }
      const wavelengthMicrometers = recipe.wavelengthsMicrometers[filter];
      if (wavelengthMicrometers === undefined) throw new Error(`No wavelength for filter ${filter}.`);
      // A frame across 0 degrees longitude is written as two tiles; each tile is its own product with its own geometry label.
      const products = tiles.map((tile, index) => {
        const tileId = tiles.length > 1 ? `${frame.id}-${index + 1}` : frame.id;
        return { tile, tileId, framePath: `${recipe.output.frames}/${tileId}.equi.tif`, labelPath: `${recipe.output.labels}/${tileId}.equi.lbl` };
      });
      if (write) for (const { tile, framePath, labelPath } of products) {
        const tiff = equirectangularGeoTiff(tile, { radiusMeters, filter, wavelengthMicrometers, cellDegrees: frameCellDegrees });
        for (const [path, bytes] of [[framePath, tiff], [labelPath, geometryLabel(et, recipe.rotation)]] as const) {
          await mkdir(dirname(resolve(sourceDirectory, path)), { recursive: true }); await writeFile(resolve(sourceDirectory, path), bytes);
        }
      }
      report.push({ id: frame.id, observation: observation.id, filter, et, ...entry, placed: true, wavelengthMicrometers, cellDegrees: frameCellDegrees,
        tiles: products.map(({ tile, tileId, framePath, labelPath }) => ({ id: tileId, framePath, labelPath, width: tile.width, height: tile.height, firstColumn: tile.firstColumn, firstRow: tile.firstRow })) });
    }
  } finally { await rm(scratch, { recursive: true, force: true }); }
  const document = { schema: 'cssearth-voyager-color-placement@1', objectId, route: recipe.route, cellDegrees: cell, frames: report };
  if (write) await mkdir(dirname(resolve(sourceDirectory, recipe.output.report)), { recursive: true });
  if (write) await writeFile(resolve(sourceDirectory, recipe.output.report), JSON.stringify(document, null, 2) + '\n');
  return document;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [objectId, ...flags] = process.argv.slice(2);
  if (!objectId) throw new TypeError('Usage: author-color-frames <object> [--write]');
  const result = await authorColorFrames(objectId, flags.includes('--write'));
  for (const frame of result.frames) console.log(JSON.stringify(frame));
}
