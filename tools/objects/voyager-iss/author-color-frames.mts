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
import { kernelBankPaths } from '../../kernel-banks/kernel-bank.mts';
import { loadKernelSet } from '@cssearth/spice/node';
import { orthographicPoint } from '../terrestrial-layers/orthographic-observation.mts';
import { sampleColorBand } from '../terrestrial-layers/scientific-raster.mts';
import { numericRasterBands } from '../terrestrial-layers/source-records.mts';
import { decodeGeomed, equirectangularGeoTiff, equirectangularTiles, frameSampler, placeFrame, projectFrame, type EquirectangularTile, type PlacedFrame, type VoyagerRoute } from './place.mts';
import { MOSAIC_REGISTER_POLICY, mosaicSampler, registerToMosaic, renderMosaicThroughCamera, renderStep, type MosaicReference } from './mosaic-register.mts';

interface Recipe {
  schema: 'cssearth-voyager-color-frames@1';
  kernelSet: string; kernels: string[]; ckToleranceSeconds: number;
  route: VoyagerRoute; cellDegrees: number;
  wavelengthsMicrometers: Record<string, number>;
  /** Body rotation written into every geometry label, copied from the pinned PCK the controlled release also used. */
  rotation: Record<'PoleRa' | 'PoleDec' | 'PrimeMeridian' | 'PoleRaNutPrec' | 'PoleDecNutPrec' | 'PmNutPrec' | 'SysNutPrec0' | 'SysNutPrec1', number[]>;
  /** The controlled release whose orthophotos `controlled-ortho` frames come from; a recipe of limb-placed frames only needs neither. */
  controlledArchive?: string; controlledDirectory?: string;
  /** The controlled reference the oracle compares against; with `registration: 'limb-then-mosaic'` a mosaic also refines each placement. */
  oracle?: { reference: 'controlled-orthophotos' } | MosaicReference;
  registration?: 'limb' | 'limb-then-mosaic';
  output: { frames: string; labels: string; report: string; oracle?: string };
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

export const groundFloor = (placed: PlacedFrame) => placed.limb.levels.sky + 0.1 * (placed.limb.levels.disc - placed.limb.levels.sky);

export async function authorColorFrames(objectId: string, write: boolean) {
  const objectDirectory = resolve(root, 'src/objects', objectId), sourceDirectory = resolve(objectDirectory, 'source');
  const recipe: Recipe = JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/voyager-color-frames.json'), 'utf8'));
  if (recipe.schema !== 'cssearth-voyager-color-frames@1') throw new TypeError('Unknown Voyager colour frame recipe.');
  const set = await loadKernelSet(await kernelBankPaths(recipe.kernelSet, recipe.kernels), { ckToleranceSeconds: recipe.ckToleranceSeconds });
  const radiusMeters = recipe.route.radiusKm * 1000, cell = recipe.cellDegrees, report: Record<string, unknown>[] = [];
  const registration = recipe.registration ?? 'limb';
  if (registration === 'limb-then-mosaic' && recipe.oracle?.reference !== 'mosaic') throw new TypeError('limb-then-mosaic registration needs a mosaic reference in `oracle`.');
  const mosaic = registration === 'limb-then-mosaic' && recipe.oracle?.reference === 'mosaic' ? await mosaicSampler(sourceDirectory, recipe.oracle) : null;
  const scratch = await mkdtemp(resolve(tmpdir(), 'cssearth-voyager-color-'));
  try {
    for (const observation of recipe.observations) {
     // Limb-placed frames of one set are first placed on their own, then the bands are tied to the set's anchor: the frame
     // the mosaic registered best. Each other band registers to that frame rendered through its own camera (same scene,
     // same light, so the correlation is high), which keeps the three bands' edges together to a pixel.
     const placedSet = new Map<string, { placed: PlacedFrame; image: ReturnType<typeof decodeGeomed>; entry: Record<string, unknown> }>();
     for (const frame of observation.frames) {
      if (frame.kind !== 'geomed') continue;
      const bytes = await readFile(resolve(sourceDirectory, frame.path!)), labelText = await readFile(resolve(sourceDirectory, frame.labelPath!), 'utf8');
      let placed = placeFrame(frame.id, bytes, labelText, set, recipe.route);
      let entry: Record<string, unknown> = { kind: 'geomed', pixelScaleKm: +placed.pixelScaleKm.toFixed(3), limb: { accepted: placed.accepted, seed: placed.limb.seed, edgePoints: placed.limb.edgePoints,
        candidates: placed.limb.candidates, rmsPixels: +placed.limb.rmsPixels.toFixed(3), shiftPixels: placed.limb.shift.map(v => +v.toFixed(2)), groundFloor: +groundFloor(placed).toFixed(4) } };
      if (!placed.accepted) { report.push({ id: frame.id, observation: observation.id, filter: placed.filter, ...entry, placed: false }); continue; }
      const image = decodeGeomed(bytes);
      if (mosaic) {
        // The limb fixes the disc centre to a pixel or two; the controlled mosaic, seen through that camera, fixes the rest.
        const rendered = renderMosaicThroughCamera(placed, recipe.route.radiusKm, mosaic.sample,
          { width: image.width, height: image.height, stepDegrees: renderStep(placed), maximumEmissionDegrees: recipe.route.maximumEmissionDegrees });
        const registered = registerToMosaic(image.values, rendered, image.width, image.height);
        const applied = registered.samples > 0 && registered.correlation >= MOSAIC_REGISTER_POLICY.minimumCorrelation;
        if (applied) placed = placed.shifted(registered.shiftPixels);
        entry = { ...entry, mosaic: { ...registered, correlation: registered.samples > 0 ? registered.correlation : null, applied } };
      }
      placedSet.set(frame.id, { placed, image, entry });
     }
     if (mosaic) {
      // A set stands on its anchor, the frame the mosaic registered best; that one must have registered (a disc a few dozen
      // pixels across, or one with no agreeing detail, is placed by its limb alone to a few percent of its radius, and its
      // bands would fringe). Every other band then registers to the anchor rendered through its own camera, or is dropped.
      const applied = (member: { entry: Record<string, unknown> }) => (member.entry.mosaic as { applied?: boolean } | undefined)?.applied === true;
      const anchorId = [...placedSet].filter(([, member]) => applied(member)).sort(([, a], [, b]) => (b.entry.mosaic as { correlation: number }).correlation - (a.entry.mosaic as { correlation: number }).correlation)[0]?.[0];
      for (const [id, member] of placedSet) {
        if (anchorId === undefined) { report.push({ id, observation: observation.id, filter: member.placed.filter, ...member.entry, placed: false, reason: 'no frame of this set registered against the mosaic' }); placedSet.delete(id); continue; }
        if (id === anchorId) { member.entry = { ...member.entry, bands: { anchor: anchorId } }; continue; }
        const anchor = placedSet.get(anchorId)!, anchorSampler = frameSampler(anchor.placed, anchor.image.values, recipe.route.radiusKm);
        const rendered = renderMosaicThroughCamera(member.placed, recipe.route.radiusKm, anchorSampler,
          { width: member.image.width, height: member.image.height, stepDegrees: renderStep(member.placed), maximumEmissionDegrees: 90 });
        const registered = registerToMosaic(member.image.values, rendered, member.image.width, member.image.height);
        const bandApplied = registered.samples > 0 && registered.correlation >= MOSAIC_REGISTER_POLICY.minimumCorrelation;
        if (bandApplied) member.placed = member.placed.shifted(registered.shiftPixels);
        member.entry = { ...member.entry, bands: { anchor: anchorId, shiftPixels: registered.shiftPixels, correlation: registered.samples > 0 ? registered.correlation : null, applied: bandApplied } };
        if (!bandApplied) { report.push({ id, observation: observation.id, filter: member.placed.filter, ...member.entry, placed: false, reason: 'band did not register to the set anchor' }); placedSet.delete(id); }
      }
     }
     for (const frame of observation.frames) {
      let tiles: EquirectangularTile[] = [], filter: string, et: number, entry: Record<string, unknown>, frameCellDegrees = cell;
      if (frame.kind === 'geomed') {
        const member = placedSet.get(frame.id);
        if (!member) continue;
        const { placed, image } = member; entry = member.entry; filter = placed.filter; et = placed.et;
        frameCellDegrees = frameCell(placed.pixelScaleKm, recipe.route.radiusKm, cell);
        // Ground is what the limb fit called disc: a tenth of the way up from the frame's sky level, so border rows and sky never project.
        tiles = projectFrame(placed, image.values, recipe.route, frameCellDegrees, groundFloor(placed)) ?? [];
      } else {
        // A controlled orthophoto: every pixel's latitude and longitude follow from its map projection.
        if (!recipe.controlledArchive || !recipe.controlledDirectory) throw new TypeError(`${frame.id} is a controlled orthophoto but the recipe names no controlled release.`);
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
