#!/usr/bin/env node
/** One command from a star's public raw interferometry to a verdict on its surface image.
 *
 *   node tools/objects/interferometry/image-star.mts <season directory> <work directory> [--raw <directory>] [--calibrated <oifits> ...]
 *
 * A season (tools/objects/interferometry/seasons/<id>/season.json) pins what an image is made from: the instrument, the target's
 * archive name, the observing windows or exposures, a reference diameter with its source, the selection, the reconstruction recipe,
 * the check settings, and optionally an author's calibrated file and image to compare with. The run, each step kept and skipped
 * on a rerun:
 *
 * 1. Calibrate. PIONIER and AMBER windows through their night planners, GRAVITY and MATISSE exposures through the archive's
 *    association trees. One calibration at a time.
 * 2. Select. Every calibrated file concatenated (oifits-concat.mts), then the season's wavelength windows and error floors
 *    (oifits-select.mts); for MATISSE, the beam-commuting repeats of each block averaged in continuum windows into one
 *    monochromatic file (matisse-continuum.mts).
 * 3. Size. A uniform disc fitted around the reference diameter (disc-fit.mts): the start image, the spotless twins' size and the beam.
 * 4. Twins. The two interleaved halves of the data, a spotless limb-darkened disc on the season's sampling and errors
 *    (spotless-disc.mts), and the same two halves of that disc.
 * 5. Reconstruct. SQUEEZE with the season's recipe on the season, its five spotless twins, its halves and their twins: nine runs,
 *    one at a time.
 * 6. Check. The fit SQUEEZE reports, the spot ratio against the spottiest of spotless twins across ±2 percent in size
 *    (TWIN_SCALES), and the correlation of the halves once each half's twin is subtracted, combined by reconstructionVerdict into
 *    cast or not cast with the reasons.
 * 7. Compare. When the season names them, the calibrated squared visibilities against the author's file and the image against the
 *    author-derived image already shipped.
 *
 * Nights calibrate into <work>/nights/<date>. The result is verdict.json in the work directory. */
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { imageCorrelation, matchVis2, vis2Agreement } from './author-comparison.mts';
import { readReconstruction } from './beam-convolve.mts';
import { calibrateAmberWindow } from './calibrate-amber.mts';
import { GRAVITY_REDUCTION } from './calibrate-gravity.mts';
import { MATISSE_REDUCTION } from './calibrate-matisse.mts';
import { calibratePionierWindow } from './calibrate-pionier.mts';
import { discStartImage, fitUniformDisc } from './disc-fit.mts';
import { calibrateFromAssociations } from './eso-associations.mts';
import { mergeContinuum, mergedOifits, type ContinuumRecipe } from './matisse-continuum.mts';
import { concatenateOifits } from './oifits-concat.mts';
import { readChannelRows } from './oifits-rows.mts';
import { selectOifits } from './oifits-select.mts';
import { readReconstructionPlane, reconstructionVerdict, reproducibility, simulateSpotlessDisc, spotMap, compareSpotMaps } from './spotless-disc.mts';
import { runSqueeze, type SqueezeFit, type SqueezeRecipe } from './squeeze.mts';

type Window = { readonly from: string; readonly to: string };
type Exposure = { readonly science: string; readonly calibrators: readonly string[] };
export type SeasonData =
  | { readonly instrument: 'pionier'; readonly nights: readonly Window[] }
  | { readonly instrument: 'amber'; readonly nights: readonly Window[]; readonly calibrators: ReadonlyMap<string, { diameterMas: number; errorMas: number }> }
  | { readonly instrument: 'gravity' | 'matisse'; readonly exposures: readonly Exposure[] };

export interface Season {
  readonly id: string; readonly object: string; readonly target: string; readonly data: SeasonData;
  readonly referenceDiameterMas: number;
  readonly selection: {
    readonly windowsMetres: readonly (readonly [number, number])[]; readonly errorFloors?: { readonly vis2Relative: number; readonly closureDegrees: number; readonly vis2Minimum?: number };
    /** MATISSE: average the beam-commuting repeats of each block inside the windows into one monochromatic file (matisse-continuum.mts). */
    readonly continuum?: ContinuumRecipe;
  };
  readonly recipe: SqueezeRecipe;
  readonly limbDarkening: number;
  /** Twin sizes as fractions of the fitted disc; the spot ratio is taken against the spottiest twin. */
  readonly twinScales: readonly number[];
  readonly oracles: { readonly calibrated?: string; readonly image?: string };
}

const WINDOW_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/u;

export function parseSeason(value: unknown): Season {
  const record = requireRecord(value, 'season');
  if (record.schema !== 'cssearth-star-season@1') throw new TypeError('Unexpected season schema.');
  const instrument = requireString(record.instrument);
  const windows = () => requireArray(record.nights).map(night => {
    const window = requireRecord(night, 'night'), from = requireString(window.from), to = requireString(window.to);
    if (!WINDOW_TIME.test(from) || !WINDOW_TIME.test(to) || !(to > from)) throw new TypeError(`Night ${from} to ${to} is not an ordered window of ISO times.`);
    return { from, to };
  });
  let data: SeasonData;
  if (instrument === 'pionier') data = { instrument, nights: windows() };
  else if (instrument === 'amber') {
    const calibrators = new Map(Object.entries(requireRecord(record.calibrators, 'calibrators')).map(([name, entry]) => {
      const calibrator = requireRecord(entry, name);
      requireString(calibrator.source);
      return [name, { diameterMas: requireFiniteNumber(calibrator.diameterMas), errorMas: requireFiniteNumber(calibrator.errorMas) }] as const;
    }));
    data = { instrument, nights: windows(), calibrators };
  } else if (instrument === 'gravity' || instrument === 'matisse') {
    data = { instrument, exposures: requireArray(record.exposures).map(entry => { const exposure = requireRecord(entry, 'exposure'); return { science: requireString(exposure.science), calibrators: requireArray(exposure.calibrators ?? []).map(id => requireString(id)) }; }) };
  } else throw new TypeError(`No calibration for instrument ${instrument}.`);
  const reference = requireRecord(record.referenceDiameter, 'referenceDiameter'), selection = requireRecord(record.selection ?? {}, 'selection');
  const recipe = requireRecord(record.reconstruction, 'reconstruction'), check = requireRecord(record.check ?? {}, 'check'), oracles = requireRecord(record.oracles ?? {}, 'oracles');
  if (recipe.code !== 'squeeze') throw new TypeError('Seasons reconstruct with SQUEEZE.');
  requireString(reference.source);
  const floors = selection.errorFloors === undefined ? undefined : requireRecord(selection.errorFloors, 'errorFloors');
  const continuum = selection.continuum === undefined ? undefined : requireRecord(selection.continuum, 'continuum');
  if (continuum && (floors || selection.windowsMicrons !== undefined)) throw new TypeError('A continuum selection states its own windows and floors.');
  const target = continuum === undefined ? undefined : requireRecord(continuum.target, 'continuum target');
  return {
    id: requireString(record.id), object: requireString(record.object), target: requireString(record.target), data,
    referenceDiameterMas: requireFiniteNumber(reference.mas),
    selection: {
      windowsMetres: requireArray(selection.windowsMicrons ?? []).map(entry => { const [min, max] = requireArray(entry).map(number => requireFiniteNumber(number) * 1e-6); return [min!, max!] as const; }),
      ...(floors ? { errorFloors: { vis2Relative: requireFiniteNumber(floors.vis2Relative), closureDegrees: requireFiniteNumber(floors.closureDegrees), ...(floors.vis2Minimum === undefined ? {} : { vis2Minimum: requireFiniteNumber(floors.vis2Minimum) }) } } : {}),
      ...(continuum && target ? { continuum: {
        windowsMicrometres: requireArray(continuum.windowsMicrometres).map(entry => { const [min, max] = requireArray(entry).map(number => requireFiniteNumber(number)); if (!(max! > min!)) throw new TypeError('A continuum window is an ordered pair.'); return [min!, max!] as const; }),
        referenceWavelengthMetres: requireFiniteNumber(continuum.referenceWavelengthMetres), referenceBandMetres: requireFiniteNumber(continuum.referenceBandMetres),
        vis2MultiplicativeFloor: requireFiniteNumber(continuum.vis2MultiplicativeFloor), vis2AdditiveFloor: requireFiniteNumber(continuum.vis2AdditiveFloor), closurePhaseFloorDegrees: requireFiniteNumber(continuum.closurePhaseFloorDegrees),
        outputMjd: requireFiniteNumber(continuum.outputMjd), outputDateObs: requireString(continuum.outputDateObs),
        target: { name: requireString(target.name), rightAscensionDegrees: requireFiniteNumber(target.rightAscensionDegrees), declinationDegrees: requireFiniteNumber(target.declinationDegrees), spectralType: requireString(target.spectralType) },
      } } : {}),
    },
    recipe: { pixelMas: requireFiniteNumber(recipe.pixelMas), width: requireFiniteNumber(recipe.width), entropy: requireFiniteNumber(recipe.entropy), elements: requireFiniteNumber(recipe.elements), iterations: requireFiniteNumber(recipe.iterations), discard: requireFiniteNumber(recipe.discard) },
    limbDarkening: check.limbDarkening === undefined ? 0 : requireFiniteNumber(check.limbDarkening),
    twinScales: check.twinScales === undefined ? TWIN_SCALES : requireArray(check.twinScales).map(value => { const scale = requireFiniteNumber(value); if (!(scale > 0.8 && scale < 1.2)) throw new RangeError(`Twin scale ${scale} is not near the fitted disc.`); return scale; }),
    oracles: { ...(oracles.calibrated ? { calibrated: requireString(oracles.calibrated) } : {}), ...(oracles.image ? { image: requireString(oracles.image) } : {}) },
  };
}

const exists = (path: string) => access(path).then(() => true, () => false);

/** A reconstruction of a spotless disc can come out as spotty as a real star at one size and clean at a size 1 percent away:
 * on Betelgeuse's February 2020 MATISSE coverage, twins between 42.0 and 44.3 mas left spot maps with rms 0.03 to 0.14 against
 * the real image's 0.13, while π¹ Gruis's twins stayed between 0.012 and 0.019 over ±2 percent. Neither more iterations, four
 * chains nor half-size pixels made a spotty twin clean. So the season's spots are compared with twins across ±2 percent, about
 * the uncertainty of a diameter fitted to a star that is not a disc, and the spottiest decides. */
export const TWIN_SCALES: readonly number[] = [0.98, 0.99, 1, 1.01, 1.02];
const repository = resolve(import.meta.dirname, '../../..');

interface Progress { calibrated: Record<string, string[]>; runs: Record<string, SqueezeFit & { seconds: number; inputs: string }> }

export async function imageStar(seasonDirectory: string, work: string, rawDirectory: string, { calibrated }: { calibrated?: readonly string[] } = {}) {
  const season = parseSeason(JSON.parse(await readFile(resolve(seasonDirectory, 'season.json'), 'utf8')) as unknown);
  await mkdir(work, { recursive: true });
  const progressPath = resolve(work, 'progress.json');
  const progress = await readFile(progressPath, 'utf8').then(text => JSON.parse(text) as Progress, () => ({ calibrated: {}, runs: {} }) as Progress);
  const save = () => writeFile(progressPath, `${JSON.stringify(progress, null, 2)}\n`);

  // 1. Calibrate, unless calibrated files are given (an author's, to check stages 2 to 7 on their own).
  const seasonData = season.data;
  const units = 'exposures' in seasonData
    ? seasonData.exposures.map(exposure => ({ key: exposure.science, exposure }))
    : seasonData.nights.map(night => ({ key: night.from.slice(0, 10), night }));
  // Always run: each calibration reuses its own finished pipeline steps, and its last steps depend on all of them.
  for (const unit of calibrated ? [] : units) {
    const directory = resolve(work, 'nights', unit.key.replaceAll(':', '-'));
    const data = season.data;
    let files: string[];
    if (data.instrument === 'pionier' && 'night' in unit) files = (await calibratePionierWindow(directory, season.target, unit.night.from, unit.night.to, rawDirectory)).files;
    else if (data.instrument === 'amber' && 'night' in unit) files = (await calibrateAmberWindow(directory, season.target, unit.night.from, unit.night.to, rawDirectory, data.calibrators)).files;
    else if ((data.instrument === 'gravity' || data.instrument === 'matisse') && 'exposure' in unit) {
      files = [(await calibrateFromAssociations(data.instrument === 'gravity' ? GRAVITY_REDUCTION : MATISSE_REDUCTION, unit.exposure.science, directory, rawDirectory, unit.exposure.calibrators)).calibrated];
    } else throw new Error(`Season unit ${unit.key} does not match instrument ${data.instrument}.`);
    progress.calibrated[unit.key] = files;
    await save();
  }

  // 2. Select.
  const calibratedFiles = calibrated ?? Object.values(progress.calibrated).flat();
  const continuum = season.selection.continuum;
  const selected = continuum ? { bytes: mergedOifits(await mergeContinuum(calibratedFiles, continuum), continuum), raisedErrors: 0 }
    : selectOifits(concatenateOifits(await Promise.all(calibratedFiles.map(path => readFile(path)))).bytes, { windowsMetres: season.selection.windowsMetres, ...(season.selection.errorFloors ? { errorFloors: season.selection.errorFloors } : {}) });
  const seasonFile = resolve(work, 'season.fits');
  await writeFile(seasonFile, selected.bytes);

  // 3. Size.
  const rows = readChannelRows(selected.bytes), disc = fitUniformDisc(rows, { referenceMas: season.referenceDiameterMas });
  await writeFile(resolve(work, 'start.fits'), discStartImage(disc.diameterMas, season.recipe.pixelMas, season.recipe.width));

  // 4. Twins.
  // Each half's twin is that half of the season's twin, so a point carries the same noise draw in both.
  const twin = (scale: number) => simulateSpotlessDisc(selected.bytes, { diameterMas: disc.diameterMas * scale, limbDarkening: season.limbDarkening }).bytes;
  const twinName = (scale: number) => scale === 1 ? 'season-spotless' : `season-spotless-${scale}`;
  const spotless = twin(1);
  const inputs: Record<string, Buffer> = { season: selected.bytes };
  for (const scale of new Set([1, ...season.twinScales])) inputs[twinName(scale)] = scale === 1 ? spotless : twin(scale);
  for (const half of ['even', 'odd'] as const) { inputs[half] = selectOifits(selected.bytes, { half }).bytes; inputs[`${half}-spotless`] = selectOifits(spotless, { half }).bytes; }
  for (const [name, bytes] of Object.entries(inputs)) await writeFile(resolve(work, `${name}.fits`), bytes);

  // 5. Reconstruct, one run at a time.
  // A run is reused only when its data, start image and recipe are the ones it was made from.
  const start = await readFile(resolve(work, 'start.fits'));
  for (const [name, bytes] of Object.entries(inputs)) {
    const key = createHash('sha256').update(bytes).update(start).update(JSON.stringify(season.recipe)).digest('hex');
    if (progress.runs[name]?.inputs === key && await exists(resolve(work, `${name}-image.fits`))) continue;
    const { fit, seconds } = await runSqueeze(resolve(work, `${name}.fits`), resolve(work, 'start.fits'), `${name}-image`, season.recipe);
    progress.runs[name] = { ...fit, seconds, inputs: key };
    await save();
  }

  // 6. Check.
  const map = async (name: string) => spotMap(await readReconstructionPlane(resolve(work, `${name}-image.fits`)), disc.diameterMas, disc.beamMas);
  const real = await map('season'), twins = [];
  for (const scale of new Set([1, ...season.twinScales])) twins.push({ scale, diameterMas: disc.diameterMas * scale, ...compareSpotMaps(real, await map(twinName(scale))) });
  // The spottiest twin decides; every size is kept in the verdict.
  const spots = { ...twins.reduce((worst, entry) => entry.ratio < worst.ratio ? entry : worst), twins: twins.map(({ scale, diameterMas, spotlessRms, ratio }) => ({ scale, diameterMas, spotlessRms, ratio })) };
  const halves = reproducibility(await map('even'), await map('even-spotless'), await map('odd'), await map('odd-spotless'));
  const fit = progress.runs.season!;
  const verdict = reconstructionVerdict({ vis2: fit.vis2, closurePhase: fit.closurePhase }, spots, halves);

  // 7. Compare with the author's calibrated file and image.
  const comparison: Record<string, unknown> = {};
  if (season.oracles.calibrated) comparison.calibrated = vis2Agreement(matchVis2(rows.vis2, readChannelRows(await readFile(resolve(repository, season.oracles.calibrated))).vis2));
  if (season.oracles.image) {
    const ours = readReconstruction(await readFile(resolve(work, 'season-image.fits'))), theirs = readReconstruction(await readFile(resolve(repository, season.oracles.image)));
    comparison.imageCorrelation = imageCorrelation(ours, theirs, disc.beamMas / season.recipe.pixelMas, disc.diameterMas / 2 / season.recipe.pixelMas);
  }

  const result = {
    season: season.id, object: season.object, calibratedFiles: calibratedFiles.length, ...(calibrated ? { calibratedFrom: calibrated.map(path => relative(repository, path)) } : {}),
    points: { vis2: rows.vis2.length, closurePhases: rows.t3.length, raisedErrors: selected.raisedErrors },
    disc, fit: progress.runs, spots, halves, verdict, comparison,
  };
  await writeFile(resolve(work, 'verdict.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [seasonDirectory, work, ...rest] = process.argv.slice(2);
  const rawIndex = rest.indexOf('--raw'), calibrated = rest.flatMap((flag, index) => flag === '--calibrated' ? [resolve(rest[index + 1]!)] : []);
  if (!seasonDirectory || !work) throw new TypeError('Usage: image-star <season directory> <work directory> [--raw <directory>] [--calibrated <oifits> ...]');
  const result = await imageStar(resolve(seasonDirectory), resolve(work), resolve(rawIndex < 0 ? resolve(work, 'raw') : rest[rawIndex + 1]!), calibrated.length ? { calibrated } : {});
  console.log(result.verdict.cast ? `${result.season}: cast.` : `${result.season}: not cast, because ${result.verdict.reasons.join('; ')}.`);
  console.log(JSON.stringify({ disc: result.disc, fit: result.fit.season, spotRatio: result.spots.ratio, halves: result.halves.correlation, comparison: result.comparison }, null, 2));
}
