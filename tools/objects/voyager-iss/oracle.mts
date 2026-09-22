/**
 * Oracle for the limb placement: place a raw GEOMED frame exactly as author-color-frames does (recorded pointing, limb fit,
 * no datum shift) and compare it with the controlled release's orthophoto of the same frame, which its authors placed by
 * bundle adjustment. Surface detail is high-passed and cross-correlated over a lat/lon offset search; the offset that
 * maximises the correlation is our residual against the controlled placement, and its mean over the frames is the datum
 * shift the recipe applies to every limb-placed frame.
 *
 *   node tools/objects/voyager-iss/oracle.mts <object> --frames <directory of *_GEOMED.IMG/.LBL> [--write]
 *
 * Two references, chosen by the recipe's `oracle.reference`:
 * - `controlled-orthophotos` (the default): the controlled release's own colour frames, which the recipe lists as
 *   `controlled-ortho`; their raw GEOMED products are read from the given directory (the same PDS Ring-Moon Systems Node
 *   volume as the pinned approach frames), so the comparison is frame against the same frame placed by bundle adjustment.
 * - `mosaic`: every limb-placed frame against a controlled cylindrical mosaic of the body (an ISIS cube pinned as another
 *   lens), for bodies whose controlled release is a mosaic rather than per-frame orthophotos. The comparison grid follows the
 *   mosaic's pixel, and the search reaches ±60 cells.
 * With --write, the report goes to the recipe's `output.oracle` path beside the placement report.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fromFile } from 'geotiff';
import { kernelBankPaths } from '../../spice/kernel-bank.mts';
import { loadKernelSet } from '../../spice/kernel-set.mts';
import { orthographicPoint } from '../terrestrial-layers/orthographic-observation.mts';
import { sampleColorBand, sampleScienceGrid, scienceMapPoint } from '../terrestrial-layers/scientific-raster.mts';
import { loadIsis3Raster } from '../terrestrial-layers/isis3-raster.mts';
import { parseScienceGrid } from '../terrestrial-layers/source-records.mts';
import { numericRasterBands } from '../terrestrial-layers/source-records.mts';
import { decodeGeomed, placeFrame, type PlacedFrame, type VoyagerRoute } from './place.mts';
import { MOSAIC_REGISTER_POLICY, mosaicSampler, registerToMosaic, renderMosaicThroughCamera, renderStep, type MosaicReference } from './mosaic-register.mts';

interface Recipe {
  schema: string; kernelSet: string; kernels: string[]; ckToleranceSeconds: number; route: VoyagerRoute; cellDegrees: number;
  controlledArchive?: string; controlledDirectory?: string; output: { oracle?: string };
  oracle?: { reference: 'controlled-orthophotos' } | MosaicReference; registration?: 'limb' | 'limb-then-mosaic';
  observations: { id: string; frames: { id: string; kind: 'geomed' | 'controlled-ortho'; path?: string; labelPath?: string }[] }[];
}
type Grid = (number | null)[][];
const root = resolve(import.meta.dirname, '../../..');
/** Grid step of the comparison in degrees (about 1.2 km on Triton) and the offset search half-width in cells. */
const STEP_DEGREES = 0.05, SEARCH_CELLS = 60, MINIMUM_SAMPLES = 500, DARK_IF = 0.02;

/** Our placed frame sampled at a longitude and latitude: calibrated I/F, or null off the usable disc. */
function placedSampler(placed: PlacedFrame, values: Float32Array, radiusKm: number) {
  const { matrix: m, positionKm: obs } = placed.camera, d2r = Math.PI / 180;
  return (longitude: number, latitude: number) => {
    const p = [radiusKm * Math.cos(latitude * d2r) * Math.cos(longitude * d2r), radiusKm * Math.cos(latitude * d2r) * Math.sin(longitude * d2r), radiusKm * Math.sin(latitude * d2r)];
    if ((obs[0]! - p[0]!) * p[0]! + (obs[1]! - p[1]!) * p[1]! + (obs[2]! - p[2]!) * p[2]! <= 0) return null;
    const w = m[2]![0]! * p[0]! + m[2]![1]! * p[1]! + m[2]![2]! * p[2]! + m[2]![3]!;
    const x = Math.round((m[0]![0]! * p[0]! + m[0]![1]! * p[1]! + m[0]![2]! * p[2]! + m[0]![3]!) / w);
    const y = Math.round((m[1]![0]! * p[0]! + m[1]![1]! * p[1]! + m[1]![2]! * p[2]! + m[1]![3]!) / w);
    if (x < 15 || y < 15 || x > 984 || y > 984) return null;
    const value = values[y * 1000 + x]!;
    return value > DARK_IF ? value : null;
  };
}

/** Subtract a 15-cell box mean so only surface detail correlates, never the shading. */
function highPass(grid: Grid): Grid {
  return grid.map((row, j) => row.map((value, i) => {
    if (value === null) return null;
    let sum = 0, count = 0;
    for (let y = Math.max(0, j - 7); y <= Math.min(grid.length - 1, j + 7); y += 2) for (let x = Math.max(0, i - 7); x <= Math.min(row.length - 1, i + 7); x += 2) {
      const other = grid[y]![x]; if (other !== null) { sum += other; count++; }
    }
    return count > 10 ? value - sum / count : null;
  }));
}

/** The offset (in cells, ours → controlled) with the highest correlation of high-passed detail. */
export function bestOffset(ours: Grid, controlled: Grid) {
  const a = highPass(ours), b = highPass(controlled);
  let best = { correlation: -2, dx: 0, dy: 0, samples: 0 };
  for (let dy = -SEARCH_CELLS; dy <= SEARCH_CELLS; dy++) for (let dx = -SEARCH_CELLS; dx <= SEARCH_CELLS; dx++) {
    let n = 0, sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0;
    for (let j = 0; j < a.length; j += 3) for (let i = 0; i < a[j]!.length; i += 3) {
      const p = a[j]![i], q = b[j + dy]?.[i + dx];
      if (p === null || p === undefined || q === null || q === undefined) continue;
      n++; sa += p; sb += q; sab += p * q; saa += p * p; sbb += q * q;
    }
    if (n < MINIMUM_SAMPLES) continue;
    const correlation = (n * sab - sa * sb) / Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb));
    if (correlation > best.correlation) best = { correlation, dx, dy, samples: n };
  }
  return best;
}

export async function runOracle(objectId: string, framesDirectory: string | null, write: boolean) {
  const sourceDirectory = resolve(root, 'src/objects', objectId, 'source');
  const recipe: Recipe = JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/voyager-color-frames.json'), 'utf8'));
  const set = await loadKernelSet(await kernelBankPaths(recipe.kernelSet, recipe.kernels), { ckToleranceSeconds: recipe.ckToleranceSeconds });
  // Measure the raw residual: the datum shift under test is not applied here.
  const route: VoyagerRoute = { ...recipe.route, datumShiftDegrees: { longitude: 0, latitude: 0 } };
  const reference = recipe.oracle ?? { reference: 'controlled-orthophotos' as const };
  const frames: Record<string, unknown>[] = [];
  const kmPerDegree = route.radiusKm * Math.PI / 180;
  const compare = (id: string, observation: string, placed: PlacedFrame, values: Float32Array, controlled: (longitude: number, latitude: number) => number | null,
    longitudes: number[], latitudes: number[], stepDegrees: number, extra: Record<string, unknown>) => {
    const base = { id, observation, filter: placed.filter, pixelScaleKm: +placed.pixelScaleKm.toFixed(3),
      limb: { accepted: placed.accepted, edgePoints: placed.limb.edgePoints, rmsPixels: +placed.limb.rmsPixels.toFixed(3), sedrShiftPixels: placed.limb.shift.map(v => +v.toFixed(2)) }, ...extra };
    if (!placed.accepted) { frames.push({ ...base, compared: false, reason: 'limb not accepted' }); return; }
    const ours = placedSampler(placed, values, route.radiusKm);
    const best = bestOffset(latitudes.map(la => longitudes.map(lo => ours(lo, la))), latitudes.map(la => longitudes.map(lo => controlled(lo, la))));
    if (best.samples === 0) { frames.push({ ...base, compared: false, reason: 'too little overlapping detail' }); return; }
    // A feature at our (i, j) appears in the controlled frame at (i + dx, j + dy): rows run south, so latitude moves by -dy.
    const midLatitude = (latitudes[0]! + latitudes[latitudes.length - 1]!) / 2 * Math.PI / 180;
    const residualDegrees = { longitude: +(best.dx * stepDegrees).toFixed(3), latitude: +(-best.dy * stepDegrees).toFixed(3) };
    const residualKm = +Math.hypot(best.dx * stepDegrees * kmPerDegree * Math.cos(midLatitude), best.dy * stepDegrees * kmPerDegree).toFixed(2);
    frames.push({ ...base, compared: true, correlation: +best.correlation.toFixed(3), samples: best.samples, stepDegrees, residualDegrees, residualKm });
  };
  const range = (from: number, to: number, step: number) => { const out: number[] = []; for (let v = from; v <= to + 1e-9; v += step) out.push(v); return out; };
  let stepDegrees = STEP_DEGREES, method: string, framesNote: string;
  if (reference.reference === 'mosaic') {
    // Frame-plane registration against the controlled mosaic: the limb places the disc, the mosaic seen through that camera
    // says how far the placement still misses, in detector pixels, and how well the detail agrees.
    const mosaic = await mosaicSampler(sourceDirectory, reference);
    method = `Recorded pointing plus limb fit; the controlled mosaic rendered through the fitted camera and cross-correlated with the frame's high-passed detail over ±${MOSAIC_REGISTER_POLICY.searchPixels} detector pixels (box half-width ${MOSAIC_REGISTER_POLICY.highPassPixels} px).`;
    framesNote = 'Every limb-placed frame of the recipe, read from the pinned observations.';
    for (const observation of recipe.observations) for (const frame of observation.frames) {
      if (frame.kind !== 'geomed' || !frame.path || !frame.labelPath) continue;
      const bytes = await readFile(resolve(sourceDirectory, frame.path)), labelText = await readFile(resolve(sourceDirectory, frame.labelPath), 'utf8');
      const placed = placeFrame(frame.id, bytes, labelText, set, route), image = decodeGeomed(bytes);
      const base = { id: frame.id, observation: observation.id, filter: placed.filter, pixelScaleKm: +placed.pixelScaleKm.toFixed(3),
        limb: { accepted: placed.accepted, seed: placed.limb.seed, edgePoints: placed.limb.edgePoints, rmsPixels: +placed.limb.rmsPixels.toFixed(3), sedrShiftPixels: placed.limb.shift.map(v => +v.toFixed(2)) } };
      if (!placed.accepted) { frames.push({ ...base, compared: false, reason: 'limb not accepted' }); continue; }
      const rendered = renderMosaicThroughCamera(placed, route.radiusKm, mosaic.sample, { width: image.width, height: image.height, stepDegrees: renderStep(placed), maximumEmissionDegrees: route.maximumEmissionDegrees });
      const registered = registerToMosaic(image.values, rendered, image.width, image.height);
      if (registered.samples === 0) { frames.push({ ...base, compared: false, reason: 'too few overlapping pixels for a registration' }); continue; }
      const residualKm = +(Math.hypot(...registered.shiftPixels) * placed.pixelScaleKm).toFixed(2);
      frames.push({ ...base, compared: true, correlation: registered.correlation, samples: registered.samples, limbResidualPixels: registered.shiftPixels, residualKm,
        applied: recipe.registration === 'limb-then-mosaic' && registered.correlation >= MOSAIC_REGISTER_POLICY.minimumCorrelation });
    }
  } else {
    if (!framesDirectory) throw new TypeError('The controlled-orthophoto oracle needs --frames <directory of the release\'s raw GEOMED frames>.');
    if (!recipe.controlledArchive || !recipe.controlledDirectory) throw new TypeError('The controlled-orthophoto oracle needs the recipe\'s controlled release.');
    method = `Recorded pointing plus limb fit, no datum shift; high-passed detail cross-correlated against the controlled orthophoto over ±${SEARCH_CELLS} cells at ${STEP_DEGREES}° cells.`;
    framesNote = "PDS Ring-Moon Systems Node GEOMED products of the controlled release's own colour frames (not pinned; same volume as the pinned approach frames)";
    const archive = resolve(sourceDirectory, recipe.controlledArchive), scratch = await mkdtemp(resolve(tmpdir(), 'cssearth-voyager-oracle-'));
    try {
      for (const observation of recipe.observations) for (const frame of observation.frames) {
        if (frame.kind !== 'controlled-ortho') continue;
        const upper = frame.id.toUpperCase();
        const bytes = await readFile(resolve(framesDirectory, `${upper}_GEOMED.IMG`)), labelText = await readFile(resolve(framesDirectory, `${upper}_GEOMED.LBL`), 'utf8');
        const placed = placeFrame(frame.id, bytes, labelText, set, route), values = decodeGeomed(bytes).values;
        if (!placed.accepted) { compare(frame.id, observation.id, placed, values, () => null, [], [], STEP_DEGREES, {}); continue; }
        const member = `${recipe.controlledDirectory}/${frame.id}.ortho.tif`;
        const meta = JSON.parse(execFileSync('unzip', ['-p', archive, `${member}.aux.xml`]).toString().match(/<Metadata[^>]*>([\s\S]*?)<\/Metadata>/)![1]!);
        const mapping = meta.IsisCube.Mapping, tif = resolve(scratch, 'frame.tif');
        await writeFile(tif, execFileSync('unzip', ['-p', archive, member], { maxBuffer: 1 << 28 }));
        const file = await fromFile(tif), image = await file.getImage();
        const band = { data: numericRasterBands(await image.readRasters())[0]!, width: image.getWidth(), height: image.getHeight(), origin: image.getOrigin(),
          resolution: image.getResolution(), noData: image.getGDALNoData(), specialValueMagnitude: 1e30 };
        await file.close();
        const controlled = (longitude: number, latitude: number) => {
          const point = orthographicPoint(longitude, latitude, { centerLongitude: mapping.CenterLongitude, centerLatitude: mapping.CenterLatitude, radius: route.radiusKm * 1000 });
          if (!point) return null;
          const value = sampleColorBand(band as never, point[0], point[1]);
          return value !== null && value > DARK_IF ? value : null;
        };
        compare(frame.id, observation.id, placed, values, controlled, range(mapping.MinimumLongitude, mapping.MaximumLongitude, STEP_DEGREES),
          range(mapping.MinimumLatitude, mapping.MaximumLatitude, STEP_DEGREES).reverse(), STEP_DEGREES, { controlledPixelKm: +(band.resolution[0]! / 1000).toFixed(3) });
      }
    } finally { await rm(scratch, { recursive: true, force: true }); }
  }
  const compared = frames.filter(frame => frame.compared) as { residualDegrees?: { longitude: number; latitude: number }; residualKm: number; correlation: number }[];
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const withDegrees = compared.filter((f): f is typeof f & { residualDegrees: { longitude: number; latitude: number } } => f.residualDegrees !== undefined);
  const meanResidual = withDegrees.length ? { longitude: +mean(withDegrees.map(f => f.residualDegrees.longitude)).toFixed(3), latitude: +mean(withDegrees.map(f => f.residualDegrees.latitude)).toFixed(3) } : null;
  const spreadKm = withDegrees.length ? +Math.sqrt(mean(withDegrees.map(f => (f.residualDegrees.longitude - meanResidual!.longitude) ** 2 * kmPerDegree ** 2 * Math.cos(-30 * Math.PI / 180) ** 2
    + (f.residualDegrees.latitude - meanResidual!.latitude) ** 2 * kmPerDegree ** 2))).toFixed(2) : null;
  const document = { schema: 'cssearth-voyager-color-oracle@1', objectId, reference: reference.reference, method, stepDegrees, searchCells: SEARCH_CELLS, framesDirectory: framesNote,
    recipeDatumShiftDegrees: recipe.route.datumShiftDegrees, meanResidualDegrees: meanResidual, residualSpreadKm: spreadKm,
    meanResidualKm: compared.length ? +mean(compared.map(f => f.residualKm)).toFixed(2) : null, meanCorrelation: compared.length ? +mean(compared.map(f => f.correlation)).toFixed(3) : null,
    comparedFrames: compared.length, frames };
  if (write) {
    const path = resolve(sourceDirectory, recipe.output.oracle ?? 'reference/voyager-color-oracle.json');
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(document, null, 2) + '\n');
  }
  return document;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), objectId = args[0], at = args.indexOf('--frames');
  if (!objectId) throw new TypeError('Usage: oracle <object> [--frames <directory>] [--write]');
  const result = await runOracle(objectId, at >= 0 && args[at + 1] ? resolve(args[at + 1]!) : null, args.includes('--write'));
  for (const frame of result.frames) console.log(JSON.stringify(frame));
  console.log(JSON.stringify({ meanResidualDegrees: result.meanResidualDegrees, residualSpreadKm: result.residualSpreadKm, meanResidualKm: result.meanResidualKm, meanCorrelation: result.meanCorrelation, comparedFrames: result.comparedFrames }));
}
