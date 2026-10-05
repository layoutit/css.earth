/**
 * Author Neptune's Voyager 2 map: the color equirectangular map the observed-surfaces dataset reads, from the frames named
 * by `src/objects/neptune/source/preparation/voyager-map.json`.
 *
 *   node packages/bake/authoring/neptune/author-voyager-map.mts [--write]
 *
 * Without `--write` it runs the whole chain and prints the report; with it, it writes the map and the report beside the
 * body's sources. The steps and why each is there are described in the modules: `voyager-frames` (placement on the
 * spheroid), `voyager-flat` (camera blemishes), `voyager-drift` (cloud drift), `voyager-map` (the mosaic) and
 * `voyager-color` (color from the earlier sets).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { kernelBankPaths } from '@cssearth/bake/objects/cameras';
import { loadKernelSet } from '@cssearth/spice/node';
import { frameEt, placeNeptuneFrame, type NeptuneFrame, type Spheroid } from './voyager-frames.mts';
import { applyCameraPattern, cameraPattern } from './voyager-flat.mts';
import { driftBands, driftProfile, driftSpeed, measureDrift, windSpeed } from './voyager-drift.mts';
import { MOSAIC_POLICY, columnShifts, equaliseGains, fitMinnaert, frameMap, measureLimbResidual, mosaic, rotationGroups, rowLatitude, type DriftRate, type MapGrid } from './voyager-map.mts';
import { composeColor, ratioMap, reduceMap, registerBands, wholeRows } from './voyager-color.mts';

interface Recipe {
  schema: 'cssearth-neptune-voyager-map@1';
  kernelSet: string; kernels: string[]; ckToleranceSeconds: number;
  spheroid: Spheroid;
  /** `sharp` frames make the map's detail, `drift` frames only help measure the cloud drift, `color` frames give the color ratios. */
  frames: { directory: string; sharp: string[]; drift: string[]; color: string[] };
  grid: MapGrid; colorGrid: MapGrid;
  /**
   * The map's color: the mean reflectance of the map between two planetographic latitudes becomes the mean color of a sample
   * of a published true-color picture. Each channel takes one gain in linear light, so the planet's own contrast is kept.
   */
  colorTie: { source: string; targetSample: { left: number; top: number; width: number; height: number }; mapLatitudes: [number, number] };
  /** `map` is beside the body's sources; `report` is under the checkout's ignored `output/`. */
  output: { map: string; report: string };
}

const root = checkoutProjectRoot(import.meta.url), sourceDirectory = resolve(root, 'src/objects/neptune/source');
const round = (value: number, digits = 3) => Number(value.toFixed(digits));
interface SharpImage { extract(region: { left: number; top: number; width: number; height: number }): SharpImage; removeAlpha(): SharpImage; raw(): SharpImage; toBuffer(): Promise<Buffer>; png(options: { compressionLevel: number }): SharpImage; toFile(path: string): Promise<unknown> }
const sharpImage = createRequire(import.meta.url)('sharp') as (input: Buffer | string, options?: { raw: { width: number; height: number; channels: 3 } }) => SharpImage;

export async function authorVoyagerMap(write: boolean) {
  const recipe: Recipe = JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/voyager-map.json'), 'utf8'));
  if (recipe.schema !== 'cssearth-neptune-voyager-map@1') throw new TypeError('Unknown Neptune Voyager map recipe.');
  const set = await loadKernelSet(await kernelBankPaths(recipe.kernelSet, recipe.kernels), { ckToleranceSeconds: recipe.ckToleranceSeconds });
  const ids = [...recipe.frames.sharp, ...recipe.frames.drift, ...recipe.frames.color];
  if (new Set(ids).size !== ids.length) throw new TypeError('A frame is listed twice in the Voyager map recipe.');
  const file = (id: string, extension: string) => resolve(sourceDirectory, recipe.frames.directory, `${id}_GEOMED.${extension}`);
  const labels = new Map<string, string>();
  for (const id of ids) labels.set(id, await readFile(file(id, 'LBL'), 'utf8'));
  const ets = new Map(ids.map(id => [id, frameEt(labels.get(id)!, set)]));
  const recorded = ids.filter(id => { try { set.rotation('VG2_ISSNA', ets.get(id)!); return true; } catch { return false; } });
  if (recorded.length === 0) throw new Error('No listed frame has a recorded attitude.');
  const placed = new Map<string, NeptuneFrame>(), placement: Record<string, unknown>[] = [];
  for (const id of ids) {
    const et = ets.get(id)!, donor = recorded.includes(id) ? id : recorded.reduce((best, other) => Math.abs(ets.get(other)! - et) < Math.abs(ets.get(best)! - et) ? other : best);
    const frame = placeNeptuneFrame(id.toLowerCase(), await readFile(file(id, 'IMG')), labels.get(id)!, set, recipe.spheroid, donor === id ? undefined : ets.get(donor)!);
    placement.push({ id, filter: frame.filter, imageTime: frame.imageTime, pixelScaleKm: round(frame.pixelScaleKm, 1), attitudeFrom: donor === id ? 'recorded' : donor,
      limb: { edgePoints: frame.limb.edgePoints, rmsPixels: round(frame.limb.rmsPixels, 2), shiftPixels: frame.limb.shift.map(v => round(v, 1)), seed: frame.limb.seed } });
    if (!frame.limb.accepted) throw new Error(`${id}: the limb fit was not accepted (${frame.limb.edgePoints} edge points, rms ${frame.limb.rmsPixels}). Remove the frame from the recipe.`);
    placed.set(id, frame);
  }
  const camera = cameraPattern([...placed.values()]);
  const frames = new Map([...placed].map(([id, frame]) => [id, applyCameraPattern(frame, camera.pattern)]));
  const of = (list: readonly string[]) => list.map(id => frames.get(id)!);
  const sharpFrames = of(recipe.frames.sharp), driftFrames = [...sharpFrames, ...of(recipe.frames.drift)], colorFrames = of(recipe.frames.color);
  const grid = recipe.grid, colorGrid = recipe.colorGrid, coarse: MapGrid = { width: 720, height: 360 };
  if (grid.width % colorGrid.width !== 0 || grid.height !== grid.width / 2 || colorGrid.height !== colorGrid.width / 2) throw new TypeError('The color grid must divide the map grid, and both must be 2:1.');

  const minnaert: Record<string, number> = {};
  for (const filter of new Set([...frames.values()].map(frame => frame.filter))) minnaert[filter] = fitMinnaert([...frames.values()].filter(frame => frame.filter === filter), recipe.spheroid, colorGrid, MOSAIC_POLICY).k;

  // Cloud drift from the sharp day's frames; the published wind fit where they gave no rate.
  const driftMaps = driftFrames.map(frame => frameMap(frame, minnaert[frame.filter]!, recipe.spheroid, colorGrid, { ...MOSAIC_POLICY, maximumEmissionDegrees: 68 }));
  const bands = driftBands(measureDrift(driftFrames, driftMaps, colorGrid)), drift: DriftRate = driftProfile(bands, recipe.spheroid);

  const build = (list: readonly NeptuneFrame[], target: MapGrid, epoch: number) => {
    const gains = equaliseGains(list.map(frame => frameMap(frame, minnaert[frame.filter]!, recipe.spheroid, coarse, { ...MOSAIC_POLICY, maximumEmissionDegrees: 60 }, columnShifts(frame, coarse, drift, epoch))));
    const entries = list.map((frame, i) => ({ frame, k: minnaert[frame.filter]!, gain: gains[i]!, shifts: columnShifts(frame, target, drift, epoch) }));
    const first = mosaic(rotationGroups(entries, MOSAIC_POLICY.groupHours), recipe.spheroid, target, MOSAIC_POLICY, drift, epoch);
    const limb = measureLimbResidual(entries, first.value, recipe.spheroid, target, MOSAIC_POLICY);
    return { value: mosaic(rotationGroups(entries.map(entry => ({ ...entry, limb })), MOSAIC_POLICY.groupHours), recipe.spheroid, target, MOSAIC_POLICY, drift, epoch).value, gains };
  };
  const midpoint = (list: readonly NeptuneFrame[]) => (Math.min(...list.map(frame => frame.et)) + Math.max(...list.map(frame => frame.et))) / 2;
  const sharpEpoch = midpoint(sharpFrames), colorEpoch = midpoint(colorFrames);
  const sharp = build(sharpFrames, grid, sharpEpoch);
  const color = (filter: string) => build(colorFrames.filter(frame => frame.filter === filter), colorGrid, colorEpoch).value;
  const orange = color('ORANGE'), green = color('GREEN'), blue = color('BLUE');
  const registration = registerBands(green, reduceMap(sharp.value, grid, grid.width / colorGrid.width), colorGrid, drift, (sharpEpoch - colorEpoch) / 3600);
  const rows = wholeRows(sharp.value, grid);
  const rgb = composeColor(sharp.value, grid, ratioMap(orange, green, registration, colorGrid), ratioMap(blue, green, registration, colorGrid), colorGrid, rows);

  // Color: one gain per channel in linear light, then the sRGB transfer.
  const toLinear = (byte: number) => { const v = byte / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const toDisplay = (linear: number) => { const v = Math.min(1, Math.max(0, linear)); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)); };
  const sample = recipe.colorTie.targetSample, reference = await sharpImage(resolve(sourceDirectory, recipe.colorTie.source)).extract(sample).removeAlpha().raw().toBuffer();
  if (reference.length !== sample.width * sample.height * 3) throw new Error('The color reference sample is not RGB.');
  const target = [0, 0, 0], mapMean = [0, 0, 0]; let mapCells = 0;
  for (let i = 0; i < reference.length; i += 3) for (let c = 0; c < 3; c++) target[c]! += toLinear(reference[i + c]!) / (reference.length / 3);
  const [south, north] = recipe.colorTie.mapLatitudes;
  for (let y = rows.first; y <= rows.last; y++) { const latitude = rowLatitude(y, grid); if (latitude < south || latitude > north) continue; for (let x = 0; x < grid.width; x++) { const i = (y * grid.width + x) * 3; for (let c = 0; c < 3; c++) mapMean[c]! += rgb[i + c]!; mapCells++; } }
  if (mapCells === 0) throw new Error('The color tie latitudes hold no map rows.');
  const gains = target.map((value, c) => value / (mapMean[c]! / mapCells));
  const bytes = Buffer.alloc(rgb.length); let clipped = 0;
  for (let i = 0; i < bytes.length; i++) { const value = rgb[i]!; if (Number.isNaN(value)) continue; const linear = value * gains[i % 3]!; if (linear > 1) clipped++; bytes[i] = Math.max(1, toDisplay(linear)); }
  const sharpTimes = sharpFrames.map(frame => frame.imageTime).sort(), colorTimes = colorFrames.map(frame => frame.imageTime).sort();
  const report = {
    schema: 'cssearth-neptune-voyager-map-report@1',
    map: { width: grid.width, height: grid.height, rows: 'planetographic latitude, north first', columns: 'east longitude from 0, IAU_NEPTUNE, at the sharp epoch',
      firstWholeRow: rows.first, lastWholeRow: rows.last, northLatitude: round(rowLatitude(rows.first, grid), 2), southLatitude: round(rowLatitude(rows.last, grid), 2) },
    colorTie: { reference: recipe.colorTie.source, targetLinear: target.map(v => round(v, 4)), mapReflectance: mapMean.map(v => round(v / mapCells, 4)), gains: gains.map(v => round(v, 4)), clippedShare: round(clipped / (rgb.length || 1), 5) },
    sharp: { filter: 'GREEN', frames: sharpFrames.length, first: sharpTimes[0], last: sharpTimes.at(-1), pixelScaleKm: [round(Math.min(...sharpFrames.map(f => f.pixelScaleKm)), 1), round(Math.max(...sharpFrames.map(f => f.pixelScaleKm)), 1)], gains: sharp.gains.map(g => round(g)) },
    color: { frames: colorFrames.length, first: colorTimes[0], last: colorTimes.at(-1), hoursBeforeSharp: round((sharpEpoch - colorEpoch) / 3600, 1) },
    camera: { frames: frames.size, detectorShareCorrected: round(camera.coveredShare, 2) },
    minnaert: Object.fromEntries(Object.entries(minnaert).map(([filter, k]) => [filter, round(k)])),
    drift: bands.map(band => ({ latitude: round(band.latitude, 1), degreesPerHour: round(band.rateDegreesPerHour, 2), pairs: band.pairs, spread: round(band.spread, 2), metersPerSecond: Math.round(driftSpeed(band.rateDegreesPerHour, band.latitude, recipe.spheroid)), publishedFit: Math.round(windSpeed(band.latitude)) })),
    colorRegistration: registration.filter(band => band.registered).map(band => ({ latitude: round(band.latitude, 1), lagDegrees: round(((band.lagColumns * 360 / colorGrid.width + 180) % 360) - 180, 1), correlation: round(band.correlation, 2), bridged: band.bridged })),
    placement,
  };
  if (write) {
    const mapPath = resolve(sourceDirectory, recipe.output.map), reportPath = resolve(root, recipe.output.report);
    await mkdir(dirname(mapPath), { recursive: true }); await mkdir(dirname(reportPath), { recursive: true });
    await sharpImage(bytes, { raw: { width: grid.width, height: grid.height, channels: 3 } }).png({ compressionLevel: 9 }).toFile(mapPath);
    await writeFile(reportPath, `${JSON.stringify(report, null, 1)}\n`);
  }
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await authorVoyagerMap(process.argv.includes('--write'));
  const { placement, ...summary } = report;
  console.log(JSON.stringify(summary, null, 1));
  const rms = placement.map(entry => (entry.limb as { rmsPixels: number }).rmsPixels).sort((p, q) => p - q);
  console.log(`placed ${placement.length} frames; limb rms median ${rms[Math.floor(rms.length / 2)]} px, largest ${rms.at(-1)} px; ${placement.filter(entry => entry.attitudeFrom !== 'recorded').length} borrowed an attitude`);
}
