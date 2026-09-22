/**
 * Oracle for the limb placement: place a raw GEOMED frame exactly as author-color-frames does (recorded pointing, limb fit,
 * no datum shift) and compare it with the controlled release's orthophoto of the same frame, which its authors placed by
 * bundle adjustment. Surface detail is high-passed and cross-correlated over a lat/lon offset search; the offset that
 * maximises the correlation is our residual against the controlled placement, and its mean over the frames is the datum
 * shift the recipe applies to every limb-placed frame.
 *
 *   node tools/objects/voyager-iss/oracle.mts <object> --frames <directory of *_GEOMED.IMG/.LBL> [--write]
 *
 * The oracle frames are the controlled release's own colour frames, which the recipe lists as `controlled-ortho`; their raw
 * GEOMED products are read from the given directory (the same PDS Ring-Moon Systems Node volume as the pinned approach frames).
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
import { sampleColorBand } from '../terrestrial-layers/scientific-raster.mts';
import { numericRasterBands } from '../terrestrial-layers/source-records.mts';
import { decodeGeomed, placeFrame, type PlacedFrame, type VoyagerRoute } from './place.mts';

interface Recipe {
  schema: string; kernelSet: string; kernels: string[]; ckToleranceSeconds: number; route: VoyagerRoute;
  controlledArchive: string; controlledDirectory: string; output: { oracle?: string };
  observations: { id: string; frames: { id: string; kind: 'geomed' | 'controlled-ortho' }[] }[];
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

export async function runOracle(objectId: string, framesDirectory: string, write: boolean) {
  const sourceDirectory = resolve(root, 'src/objects', objectId, 'source');
  const recipe: Recipe = JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/voyager-color-frames.json'), 'utf8'));
  const set = await loadKernelSet(await kernelBankPaths(recipe.kernelSet, recipe.kernels), { ckToleranceSeconds: recipe.ckToleranceSeconds });
  // Measure the raw residual: the datum shift under test is not applied here.
  const route: VoyagerRoute = { ...recipe.route, datumShiftDegrees: { longitude: 0, latitude: 0 } };
  const archive = resolve(sourceDirectory, recipe.controlledArchive), scratch = await mkdtemp(resolve(tmpdir(), 'cssearth-voyager-oracle-'));
  const frames: Record<string, unknown>[] = [];
  try {
    for (const observation of recipe.observations) for (const frame of observation.frames) {
      if (frame.kind !== 'controlled-ortho') continue;
      const upper = frame.id.toUpperCase();
      const bytes = await readFile(resolve(framesDirectory, `${upper}_GEOMED.IMG`)), labelText = await readFile(resolve(framesDirectory, `${upper}_GEOMED.LBL`), 'utf8');
      const placed = placeFrame(frame.id, bytes, labelText, set, route);
      const base = { id: frame.id, observation: observation.id, filter: placed.filter, pixelScaleKm: +placed.pixelScaleKm.toFixed(3),
        limb: { accepted: placed.accepted, edgePoints: placed.limb.edgePoints, rmsPixels: +placed.limb.rmsPixels.toFixed(3), sedrShiftPixels: placed.limb.shift.map(v => +v.toFixed(2)) } };
      if (!placed.accepted) { frames.push({ ...base, compared: false, reason: 'limb not accepted' }); continue; }
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
      const ours = placedSampler(placed, decodeGeomed(bytes).values, route.radiusKm);
      const longitudes: number[] = [], latitudes: number[] = [];
      for (let longitude = mapping.MinimumLongitude; longitude <= mapping.MaximumLongitude; longitude += STEP_DEGREES) longitudes.push(longitude);
      for (let latitude = mapping.MaximumLatitude; latitude >= mapping.MinimumLatitude; latitude -= STEP_DEGREES) latitudes.push(latitude);
      const best = bestOffset(latitudes.map(la => longitudes.map(lo => ours(lo, la))), latitudes.map(la => longitudes.map(lo => controlled(lo, la))));
      if (best.samples === 0) { frames.push({ ...base, compared: false, reason: 'too little overlapping detail' }); continue; }
      // A feature at our (i, j) appears in the controlled frame at (i + dx, j + dy): rows run south, so latitude moves by -dy.
      const midLatitude = (mapping.MinimumLatitude + mapping.MaximumLatitude) / 2 * Math.PI / 180, kmPerDegree = route.radiusKm * Math.PI / 180;
      const residualDegrees = { longitude: +(best.dx * STEP_DEGREES).toFixed(3), latitude: +(-best.dy * STEP_DEGREES).toFixed(3) };
      const residualKm = +Math.hypot(best.dx * STEP_DEGREES * kmPerDegree * Math.cos(midLatitude), best.dy * STEP_DEGREES * kmPerDegree).toFixed(2);
      frames.push({ ...base, compared: true, controlledPixelKm: +(band.resolution[0]! / 1000).toFixed(3), correlation: +best.correlation.toFixed(3), samples: best.samples,
        residualDegrees, residualKm });
    }
  } finally { await rm(scratch, { recursive: true, force: true }); }
  const compared = frames.filter(frame => frame.compared) as { residualDegrees: { longitude: number; latitude: number }; residualKm: number }[];
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const meanResidual = compared.length ? { longitude: +mean(compared.map(f => f.residualDegrees.longitude)).toFixed(3), latitude: +mean(compared.map(f => f.residualDegrees.latitude)).toFixed(3) } : null;
  const spreadKm = compared.length ? +Math.sqrt(mean(compared.map(f => (f.residualDegrees.longitude - meanResidual!.longitude) ** 2 * (route.radiusKm * Math.PI / 180) ** 2 * Math.cos(-30 * Math.PI / 180) ** 2
    + (f.residualDegrees.latitude - meanResidual!.latitude) ** 2 * (route.radiusKm * Math.PI / 180) ** 2))).toFixed(2) : null;
  const document = { schema: 'cssearth-voyager-color-oracle@1', objectId, method: 'Recorded pointing plus limb fit, no datum shift; high-passed detail cross-correlated against the controlled orthophoto over ±3° at 0.05° cells.',
    stepDegrees: STEP_DEGREES, searchCells: SEARCH_CELLS, framesDirectory: 'PDS Ring-Moon Systems Node GEOMED products of the controlled release\'s own colour frames (not pinned; same volume as the pinned approach frames)',
    recipeDatumShiftDegrees: recipe.route.datumShiftDegrees, meanResidualDegrees: meanResidual, residualSpreadKm: spreadKm, comparedFrames: compared.length, frames };
  if (write) {
    const path = resolve(sourceDirectory, recipe.output.oracle ?? 'reference/voyager-color-oracle.json');
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(document, null, 2) + '\n');
  }
  return document;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), objectId = args[0], at = args.indexOf('--frames');
  if (!objectId || at < 0 || !args[at + 1]) throw new TypeError('Usage: oracle <object> --frames <directory> [--write]');
  const result = await runOracle(objectId, resolve(args[at + 1]!), args.includes('--write'));
  for (const frame of result.frames) console.log(JSON.stringify(frame));
  console.log(JSON.stringify({ meanResidualDegrees: result.meanResidualDegrees, residualSpreadKm: result.residualSpreadKm, recipeDatumShiftDegrees: result.recipeDatumShiftDegrees }));
}
