#!/usr/bin/env node
/** Reduce a pinned ESPaDOnS program to a magnetic map: line mask, mean lines, longitudinal fields, and the map.
 *
 *   node packages/telescope-cli/src/archives/espadons/reduce.mts <program id> [--half-width <km/s>]
 *
 * 1. The program's products are read from the archive, each at its pinned size (cadc.mts, product.mts).
 * 2. The star's line mask is made from the pinned atomic line list, each line with the depth Korg computes for it in a model
 *    atmosphere of the program's catalogued temperature and gravity (line-data.json, mask.mts).
 * 3. LSDpy averages each spectrum over the mask's lines and SpecpolFlow measures its longitudinal field (lsd.mts).
 * 4. With the program's cited rotation and tilt, ZDIpy fits the field to the Stokes V profiles at a ladder of target
 *    chi-squares (zdi.mts), from the spectra whose null check shows no signal. `chooseFit` picks the step that is the map.
 *    A program without a `star` block stops after step 3.
 *
 * The depths of step 2 and steps 3 and 4 are the published codes toolchain.json pins; install them once with toolchain.mts. The result is the
 * receipt `<program id>.map.json` beside the program: every input by its pin, what each step measured, every step of the
 * ladder and the chosen map's coefficients as ZDIpy wrote them. The mean lines, ZDIpy's files and the map as a table and a
 * picture go under output/espadons/<program id>. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { flagValue, positionalArguments } from '@cssearth/core';
import { WORKSPACE } from '@cssearth/telescope/node';
import { productFiles } from './cadc.mts';
import { meanLines, type MeanLine } from './lsd.mts';
import { lineMask, MINIMUM_DEPTH } from './mask.mts';
import { readPolarisedSpectrum, type PolarisedSpectrum } from './product.mts';
import { DOWNLOADS, MAP_SCHEMA, PROGRAMS, readProgram } from './program.mts';
import { toolchainPins } from './toolchain.mts';
import { fieldGrid, fitMap, mapTable, middleMjd, prepareRun, type MapFit, type MapRun } from './zdi.mts';

/** A spectrum whose null check, which a real signal cancels in, shows a signal as surely as Donati et al. (1997) ask of a
 * definite detection (a false-alarm chance below 1e-5) is left out of the map: its four sub-exposures do not make a valid
 * polarimetric sequence. */
export const NULL_FALSE_ALARM = 1e-5;
/** A spectrum whose longitudinal-field error is over this many times the run's median is left out too: it would carry
 * under a twenty-fifth of a typical spectrum's weight, and what its noise adds to chi-square can only be fitted with field.
 * HD 189733's sixteenth spectrum of 2007 (39 G against a median of 1.1 G) moves the map's mean field at a reduced
 * chi-square of 1.3 from 22 G to 36 G. */
export const ERROR_LIMIT = 5;
/** A run's field is detected when its Stokes V profiles, taken together, stand this many standard deviations above none:
 * with N profile points their reduced chi-square with no field is 1 ± sqrt(2 / N) when there is nothing to see. Below it
 * no map is fitted. On the published runs, those under 4 (DX Cnc's three, at 1.6 to 3.4) gave mean fields 2 to 11 times
 * the published ones, and those above 4 that fit well are within a factor 2. */
export const DETECTION_SIGMA = 4;
export const detectionSigma = (chiSquareNoField: number, points: number) => (chiSquareNoField - 1) * Math.sqrt(points / 2);
/** A map whose reduced chi-square stays above this, or whose ladder has fewer steps than `FEWEST_STEPS`, does not describe
 * its spectra: the field changed during the run (HD 189733's June and August 2006 together stop at 8.9), or it is too
 * strong for ZDIpy's weak-field treatment (the red dwarfs GJ 51, WX UMa, EV Lac and AD Leo stop at 2.3 to 19.5, with mean
 * fields 0.06 to 3.6 times the published ones). The 21 published runs that stay under it are within a factor 2. */
export const POOR_FIT = 2, FEWEST_STEPS = 3;
/** The targets a map is fitted to, from loose to tight: steps of a fifth less from the fit with no field down to 3, then
 * these. The ladder stops at the first target ZDIpy does not reach within `ITERATIONS`. */
export const FINE_TARGETS = [2.6, 2.3, 2, 1.8, 1.6, 1.5, 1.4, 1.3, 1.25, 1.2, 1.15, 1.1, 1.05, 1, 0.95, 0.9] as const, COARSE_STEP = 0.8, ITERATIONS = 150;
export function ladderTargets(chiSquareNoField: number): number[] { const targets: number[] = [];
  for (let target = chiSquareNoField * COARSE_STEP; target > 3; target *= COARSE_STEP) targets.push(Number(target.toPrecision(3)));
  return [...targets, ...FINE_TARGETS.filter(target => target < chiSquareNoField * 0.98)]; }
/** The step of a ladder that is the map. A tighter target always fits better and always holds more field; past some point
 * the field grows to fit noise. Between two steps, the fit bought is the percent of chi-square lost for each percent of
 * mean field added. The map is the last step before that price, past its best, first falls under `KNEE`. At 0.5 the maps of
 * 21 published runs have a median mean field 1.05 times the published one, with a scatter of a factor 1.4 (benchmark.mts);
 * 0.3 gives 1.06 and 0.7 gives 0.97. */
export const KNEE = 0.5;
export function chooseFit<T extends Pick<MapFit, 'chiSquare' | 'meanGauss'>>(ladder: readonly T[], knee = KNEE): T {
  if (!ladder.length) throw new RangeError('The ladder has no step.'); if (ladder.length < 3) return ladder.at(-1)!;
  const bought = ladder.slice(1).map((to, i) => { const field = Math.log(to.meanGauss / ladder[i]!.meanGauss); return field > 0 ? Math.log(ladder[i]!.chiSquare / to.chiSquare) / field : Infinity; });
  let step = bought.indexOf(Math.max(...bought)) + 1; while (step < bought.length && bought[step]! >= knee) step++;
  return ladder[step]!; }
/** The width of a mean profile's bins, km/s: one ESPaDOnS pixel. */
const PROFILE_STEP_KMS = 1.8;
const utc = (mjd: number) => new Date((mjd - 40587) * 86400000).toISOString().slice(0, 19);

/** Every step of a run's ladder: each fit starts from the one before it, which reaches the same map as a start from no
 * field and reaches it sooner. */
export async function fitLadder(run: MapRun, log: (line: string) => void = () => undefined) { const ladder: MapFit[] = [], { chiSquareNoField } = await prepareRun(run);
  const points = run.profiles.length * (2 * Math.floor(run.lineHalfWidthKmS / PROFILE_STEP_KMS) + 1), sigma = detectionSigma(chiSquareNoField, points);
  if (sigma < DETECTION_SIGMA) return { ladder, chiSquareNoField, points, sigma };
  for (const target of ladderTargets(chiSquareNoField)) {
    const fit = { ...await fitMap(run, { target, iterations: ITERATIONS, ...(ladder.length ? { startFrom: ladder.at(-1)!.coefficients } : {}) }), chiSquareNoField };
    log(`  target ${target}: ${fit.converged ? `reached in ${fit.iterations} iterations` : `not reached (${fit.chiSquare.toFixed(3)} after ${fit.iterations})`}; mean ${fit.meanGauss.toFixed(1)} G, toroidal ${fit.toroidalPercent.toFixed(0)}%, axisymmetric ${fit.axisymmetricPercent.toFixed(0)}%`);
    if (!fit.converged) break; ladder.push(fit); }
  return { ladder, chiSquareNoField, points, sigma }; }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), [id] = positionalArguments(args, ['--half-width']);
  if (!id) throw new TypeError('Usage: reduce.mts <program id> [--half-width <km/s>]');
  const program = await readProgram(id), directory = resolve(DOWNLOADS, id), run = resolve(WORKSPACE, 'output/espadons', id), round = (value: number, digits = 3) => Number(value.toFixed(digits));
  // Six products at a time from the archive; a product already in the directory at its size is read from there.
  // A product that is not a sequence of four sub-exposures (an interrupted one), or whose file in the archive is not the
  // image its catalogue describes, is named and left out.
  const read: (PolarisedSpectrum | string)[] = new Array<PolarisedSpectrum | string>(program.observations.length); let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (next < program.observations.length) { const i = next++;
    try { const { cards, rows } = await productFiles(program.observations[i]!, directory); read[i] = readPolarisedSpectrum(cards, rows); }
    catch (error) { if (!(error instanceof TypeError) && !(error instanceof Error && /no END card|describes a file of/u.test(error.message))) throw error; read[i] = error.message; } } }));
  const unread = read.flatMap((entry, i) => typeof entry === 'string' ? [{ product: program.observations[i]!.product, reason: entry }] : []), observations = program.observations.filter((_, i) => typeof read[i] !== 'string'), spectra = read.filter((entry): entry is PolarisedSpectrum => typeof entry !== 'string');
  for (const one of unread) console.log(`  ${one.product} LEFT OUT: ${one.reason}`);
  if (!spectra.length) throw new Error(`${id}: none of its ${program.observations.length} products is a polarimetric sequence.`);
  console.log(`${id}: ${spectra.length} spectra of ${program.target.name} read.`);
  await mkdir(run, { recursive: true });
  if (!program.atmosphere) throw new Error(`${id} has no atmosphere block: the line mask needs the star's temperature and gravity.`);
  const mask = await lineMask(program.atmosphere);
  const bySpecies = new Map<string, number>(); for (const line of mask.lines) { const key = `${line.element}.${String(line.charge).padStart(2, '0')}`; bySpecies.set(key, (bySpecies.get(key) ?? 0) + 1); }
  const species = [...bySpecies].sort((a, b) => b[1] - a[1]);
  console.log(`mask: ${mask.lines.length} lines at least ${MINIMUM_DEPTH} deep in a ${mask.teff} K, log g ${mask.logg}, [M/H] ${mask.metallicity} atmosphere (Korg ${mask.korg}; ${mask.synthesised} of ${mask.candidates} candidate lines computed)`);
  // The profile runs far enough either side of the line to hold continuum. The map is fitted over the line with its Stokes V,
  // which reaches the star's rotation and the local line's own wings beyond the centre; the longitudinal field is measured
  // over the line's core, where HD 189733's fifteen fields of 2007 come closest to the published ones (0.73 G rms, against
  // 0.86 G over the wider range).
  const vsini = program.star?.vsiniKmS.value ?? 0, lineHalfWidth = Math.ceil(1.3 * vsini + 15), fieldHalfWidth = vsini + 10.8, halfWidth = Number(flagValue(args, '--half-width') ?? NaN) || Math.ceil((lineHalfWidth + 16) / 1.8) * 1.8;
  const averaged = await meanLines({ spectra, products: observations.map(observation => observation.product), lines: mask.lines, ...(program.radialVelocity ? { radialVelocityKmS: program.radialVelocity.value } : {}), halfWidthKmS: halfWidth, lineHalfWidthKmS: fieldHalfWidth, directory: run });
  console.log(`${averaged.means.lines} lines outside the Earth's bands and the hydrogen lines; the star's line at ${averaged.velocityKmS.toFixed(1)} km/s${program.radialVelocity ? ` (catalogued ${program.radialVelocity.value})` : ', found with no catalogued velocity'}, ${(100 * averaged.searchDepth).toFixed(1)}% deep in the first spectrum`);
  const medianError = averaged.lines.map(line => line.error).sort((a, b) => a - b)[Math.floor(averaged.lines.length / 2)]!, reason = averaged.lines.map(line => line.nullFalseAlarm < NULL_FALSE_ALARM ? 'a signal in the null check' : line.error > ERROR_LIMIT * medianError ? `its error is over ${ERROR_LIMIT} times the run's median` : ''), valid = reason.map(text => !text);
  for (const [i, line] of averaged.lines.entries()) console.log(`  ${line.product} ${utc(line.mjd)}${valid[i] ? '' : ` LEFT OUT, ${reason[i]}`}: longitudinal field ${line.gauss.toFixed(1)} ± ${line.error.toFixed(1)} G (null ${line.nullGauss.toFixed(1)}); false-alarm chance ${line.falseAlarm.toExponential(1)} (null ${line.nullFalseAlarm.toExponential(1)}); errors scaled by a chi-square of ${line.chiSquare.stokesV?.toFixed(2) ?? '?'}`);
  await mkdir(PROGRAMS, { recursive: true });
  const pins = await toolchainPins(), spectrumRecord = (line: MeanLine, i: number) => ({ product: line.product, utc: utc(line.mjd), mjd: round(line.mjd, 5), used: valid[i]!, ...(valid[i] ? {} : { leftOut: reason[i]! }), longitudinal: { gauss: round(line.gauss, 2), error: round(line.error, 2), nullGauss: round(line.nullGauss, 2) }, falseAlarm: line.falseAlarm, nullFalseAlarm: line.nullFalseAlarm, centreKmS: round(line.centreKmS, 2), chiSquare: line.chiSquare, offset: line.offset });
  const receipt: Record<string, unknown> = { schema: MAP_SCHEMA, program: id, target: program.target, inputs: { observations: observations.map(({ product, uri, bytes }) => ({ product, uri, bytes })), ...(unread.length ? { leftOut: unread } : {}), lineData: { url: mask.pin.url, bytes: mask.pin.bytes, credit: mask.pin.credit }, toolchain: { file: pins.file, requirements: pins.entry.requirements, zdipy: pins.entry.zdipy, julia: pins.entry.julia } },
    mask: { atmosphere: program.atmosphere, korg: mask.korg, candidates: mask.candidates, synthesised: mask.synthesised, minimumDepth: MINIMUM_DEPTH, deepEnough: mask.lines.length, lines: averaged.means.lines, species: Object.fromEntries(species),
      meanDepth: round(averaged.means.depth, 4), meanWavelengthNm: round(averaged.means.wavelengthNm, 2), meanLande: round(averaged.means.lande, 4) },
    velocity: { kmS: round(averaged.velocityKmS, 2), ...(program.radialVelocity ? { catalogued: program.radialVelocity } : {}), searchCentreKmS: round(averaged.searchCentreKmS, 1), searchDepth: round(averaged.searchDepth, 4) },
    profiles: { halfWidthKmS: halfWidth, stepKmS: 1.8, fieldHalfWidthKmS: round(fieldHalfWidth, 1), lineHalfWidthKmS: lineHalfWidth, spectra: averaged.lines.map(spectrumRecord) } };
  if (program.star) {
    const used = averaged.lines.filter((_, i) => valid[i]);
    if (used.length < 4) throw new Error(`${id}: only ${used.length} valid spectra; a map needs the star seen at several phases.`);
    const mapRun: MapRun = { star: program.star, means: averaged.means, profiles: used.map(line => ({ file: line.profile, mjd: line.mjd })), velocityKmS: averaged.velocityKmS, lineHalfWidthKmS: lineHalfWidth, directory: resolve(run, 'zdi') };
    console.log(`map of degree ${program.star.maximumDegree.value} from ${used.length} spectra:`);
    const { ladder, chiSquareNoField, points, sigma } = await fitLadder(mapRun, line => console.log(line));
    const step = (fit: MapFit) => ({ target: fit.target, iterations: fit.iterations, chiSquare: round(fit.chiSquare), entropy: round(fit.entropy, 2), meanGauss: round(fit.meanGauss, 2), maxGauss: round(fit.maxGauss, 1), poloidalPercent: round(fit.poloidalPercent, 1), toroidalPercent: round(fit.toroidalPercent, 1), axisymmetricPercent: round(fit.axisymmetricPercent, 1), dipolePercent: fit.dipolePercent, quadrupolePercent: fit.quadrupolePercent, octupolePercent: fit.octupolePercent });
    const map: Record<string, unknown> = { star: program.star, spectraUsed: used.length, maximumDegree: program.star.maximumDegree.value, middleMjd: round(middleMjd(mapRun), 5), middleUtc: utc(middleMjd(mapRun)), longitudeZero: 'faces the observer at the middle of the run; longitude grows the way the star turns', chiSquareNoField: round(chiSquareNoField), detection: { points, sigma: round(sigma, 1) }, ladder: ladder.map(step) };
    if (ladder.length) {
      const chosen = chooseFit(ladder), grid = await fieldGrid(chosen.coefficients), radialRange = [Math.min(...grid.radial), Math.max(...grid.radial)] as const;
      const poor = chosen.chiSquare > POOR_FIT ? `its reduced chi-square stays at ${chosen.chiSquare.toFixed(2)}` : ladder.length < FEWEST_STEPS ? `only ${ladder.length} step${ladder.length === 1 ? '' : 's'} of the ladder could be fitted` : '';
      map.verdict = poor ? { mapped: false, reason: `The map does not describe the spectra: ${poor}. The field changed during the run, or it is too strong for the weak-field treatment.` } : { mapped: true };
      if (poor) console.log(`NOT A MAP TO SHOW: ${poor}.`);
      console.log(`map: reduced chi-square ${chosen.chiSquareNoField.toFixed(2)} with no field, ${chosen.chiSquare.toFixed(2)} with the map (target ${chosen.target} of ${ladder.length} reached); mean field ${chosen.meanGauss.toFixed(1)} G, peak ${chosen.maxGauss.toFixed(0)} G; radial field ${radialRange[0].toFixed(1)} to ${radialRange[1].toFixed(1)} G; poloidal ${chosen.poloidalPercent.toFixed(0)}%, toroidal ${chosen.toroidalPercent.toFixed(0)}%, axisymmetric ${chosen.axisymmetricPercent.toFixed(0)}%`);
      Object.assign(map, { chosen: { ...step(chosen), chiSquareNoField: round(chosen.chiSquareNoField), lineStrength: chosen.lineStrength, knee: KNEE, radialGauss: [round(radialRange[0], 2), round(radialRange[1], 2)] }, coefficients: (await readFile(chosen.coefficients, 'utf8')).trimEnd().split('\n') });
      await writeFile(resolve(run, `${id}.dat`), mapTable(`Magnetic map of ${program.target.name}, ${utc(middleMjd(mapRun)).slice(0, 10)}, from ${used.length} ESPaDOnS spectra (program ${id})`, grid));
      const NP = grid.longitudes.length - 1, NT = grid.latitudes.length, px = 8, top = Math.max(Math.abs(radialRange[0]), Math.abs(radialRange[1])), rgb = Buffer.alloc(NP * px * NT * px * 3);
      // North at the top, longitude growing to the right; red is field pointing out of the star.
      for (let yy = 0; yy < NT * px; yy++) for (let xx = 0; xx < NP * px; xx++) { const v = Math.max(-1, Math.min(1, grid.radial[(NT - 1 - Math.floor(yy / px)) * (NP + 1) + Math.floor(xx / px)]! / top)), o = 3 * (yy * NP * px + xx); rgb[o] = Math.round(255 * (v < 0 ? 1 + v : 1)); rgb[o + 1] = Math.round(255 * (1 - Math.abs(v))); rgb[o + 2] = Math.round(255 * (v > 0 ? 1 - v : 1)); }
      await sharp(rgb, { raw: { width: NP * px, height: NT * px, channels: 3 } }).png().toFile(resolve(run, 'radial.png'));
    } else { const reason = sigma < DETECTION_SIGMA ? `The field is not detected: the ${points} points of the run's Stokes V profiles stand ${sigma.toFixed(1)} standard deviations above none (reduced chi-square ${chiSquareNoField.toFixed(2)}), under the ${DETECTION_SIGMA} a map asks for.` : `No target below the fit with no field (${chiSquareNoField.toFixed(2)}) was reached: ZDIpy's weak-field treatment cannot place this field.`;
      map.verdict = { mapped: false, reason }; console.log(`map: none. ${reason}`); }
    receipt.map = map;
  } else console.log('No star block in the program: the spectra are averaged, not mapped.');
  await writeFile(resolve(PROGRAMS, `${id}.map.json`), `${JSON.stringify(receipt, null, 1)}\n`);
  console.log(`receipt ${resolve(PROGRAMS, `${id}.map.json`)}; mean lines${program.star ? ', ZDIpy files, map table and picture' : ''} in ${run}`);
}
