#!/usr/bin/env node
/** One command from a star's calibrated interferometry over several nights to a verdict on its surface map.
 *
 *   node packages/telescope-cli/src/archives/interferometry/surface-star.mts <season directory> <work directory>
 *
 * image-star.mts makes a sky-plane image of one epoch with SQUEEZE. A star that turns between its nights has no single sky
 * image: this command fits one surface to all the nights with ROTIR, the way the star's authors did. The season
 * (seasons/<id>/season.json, schema cssearth-star-surface-season@1) pins everything a person chose: the calibrated files and
 * where they are published, the star's size, limb, axis and period, each with the paper cell it is read from, and the
 * reconstruction settings with their source. The run:
 *
 * 1. Fetch the calibrated files a checkout lacks, each checked against its recorded size.
 * 2. Twins. A spotless limb-darkened disc on every night's own sampling and errors (spotless-disc.mts) at the season's twin
 *    sizes, the two interleaved halves of every night, and the same halves of the spotless disc.
 * 3. Reconstruct. ROTIR with the season's settings on the nights, on each twin and on each half: ten runs, one at a time.
 * 4. Check, with image-star's three checks and limits, on the star as ROTIR projects it on the sky at every night, the nights
 *    taken together: the fit, the spots against the spottiest spotless twin, and the two halves once each half's twin is
 *    subtracted. One thing differs from a sky-plane image, and is this repository's reading, not a paper's: SQUEEZE is free
 *    to draw a disc of any size, while ROTIR's sphere has the size it is given, so a spotless twin of another size may not fit
 *    on it at all. A twin whose own reconstruction fails the fit limit is kept in the verdict and does not decide the spots:
 *    were the star that disc, the first check would have refused the star.
 * 5. Write the map as a table on the star's own longitudes and latitudes, longitude 0 on the meridian that faced the Earth on
 *    the season's reference night, with how squarely each node ever faced the observer; a node that never did holds the mean.
 *
 * The result is verdict.json and, whatever the verdict, <season>.dat in the work directory. */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { readChannelRows } from '@cssearth/bake/objects/layers/observation';
import { readFitsImage } from '@cssearth/fits';
import { TWIN_SCALES } from './image-star.mts';
import { selectOifits } from './oifits-select.mts';
import { compareSpotMaps, RECONSTRUCTION_CHI2_LIMIT, reconstructionVerdict, reproducibility, simulateSpotlessDisc, spotMap, type ReconstructionPlane } from './spotless-disc.mts';
import { readSurfaceGrid, sampleSurfaceGrid } from './surface-dataset.mts';
import { reconstructSurface, type SurfaceOptions } from './surface-reconstruction.mts';
import { toolchainDescriptor } from './toolchain.mts';

export const SURFACE_SEASON_SCHEMA = 'cssearth-star-surface-season@1';
export const SURFACE_MAP_SCHEMA = 'cssearth-star-surface-map@1';

export interface Cited { readonly value: number; readonly source: string }
/** A paper the season rests on, and where the calibrated files are published: what the source catalogue records of each. */
export interface SeasonPaper { readonly record: string; readonly citation: string; readonly title: string; readonly arxiv: string; readonly doi: string; readonly creators: readonly string[]; readonly year: string; readonly locator: string }
export interface SeasonData { readonly record: string; readonly title: string; readonly url: string; readonly publisher: string; readonly license: string; readonly locator: string; readonly credit: string }
export interface SurfaceNight { readonly night: string; readonly file: string; readonly origin: string; readonly bytes: number }
export interface SurfaceSeason {
  readonly id: string; readonly object: string; readonly title: string; readonly target: string; readonly instrument: string; readonly band: string; readonly nights: readonly SurfaceNight[];
  readonly papers: readonly SeasonPaper[]; readonly data: SeasonData;
  readonly star: { readonly diameterMas: Cited; readonly limbPowerLaw: Cited; readonly inclinationDegrees: Cited; readonly positionAngleDegrees: Cited; readonly rotationPeriodDays: Cited };
  readonly recipe: { readonly level: number; readonly regularizer: 'sobel2' | 'tv'; readonly weight: number; readonly iterations: number; readonly source: string };
  /** The night whose Earth-facing meridian is the map's longitude 0. */
  readonly referenceNight: string; readonly twinScales: readonly number[];
}

const NIGHT = /^\d{4}-\d\d-\d\d$/u;

export function parseSurfaceSeason(value: unknown): SurfaceSeason {
  const record = requireRecord(value, 'surface season');
  if (record.schema !== SURFACE_SEASON_SCHEMA) throw new TypeError('Unexpected surface season schema.');
  const cited = (entry: unknown, name: string): Cited => { const one = requireRecord(entry, name); return { value: requireFiniteNumber(one.value, `${name} value`), source: requireString(one.source, `${name} source`) }; };
  const nights = requireArray(record.nights, 'nights').map((entry, i): SurfaceNight => { const night = requireRecord(entry, `nights[${i}]`);
    const one = { night: requireString(night.night, 'night'), file: requireString(night.file, 'file'), origin: requireString(night.origin, 'origin'), bytes: requireFiniteNumber(night.bytes, 'bytes') };
    if (!NIGHT.test(one.night) || one.file.includes('/') || one.file.includes(',') || !/^https:\/\//u.test(one.origin) || !(one.bytes > 0)) throw new TypeError(`Night ${one.night}: a date, a plain file name, an https origin and its size.`);
    return one; });
  if (nights.length < 2 || new Set(nights.map(night => night.night)).size !== nights.length || nights.some((night, i) => i > 0 && night.night <= nights[i - 1]!.night)) throw new TypeError('A surface season is two or more nights in order, each once.');
  const star = requireRecord(record.star, 'star'), recipe = requireRecord(record.reconstruction, 'reconstruction'), check = requireRecord(record.check ?? {}, 'check');
  if (recipe.code !== 'rotir') throw new TypeError('A surface season reconstructs with ROTIR.');
  const regularizer = requireString(recipe.regularizer, 'regularizer');
  if (regularizer !== 'sobel2' && regularizer !== 'tv') throw new TypeError(`No regularizer ${regularizer}.`);
  const referenceNight = requireString(record.referenceNight, 'referenceNight');
  if (!nights.some(night => night.night === referenceNight)) throw new TypeError(`The reference night ${referenceNight} is not one of the season's.`);
  const text = (entry: Record<string, unknown>, keys: readonly string[], what: string) => Object.fromEntries(keys.map(key => [key, requireString(entry[key], `${what} ${key}`)]));
  const papers = requireArray(record.papers, 'papers').map((entry, i) => { const paper = requireRecord(entry, `papers[${i}]`);
    return { ...text(paper, ['record', 'citation', 'title', 'arxiv', 'doi', 'year', 'locator'], `papers[${i}]`), creators: requireArray(paper.creators, 'creators').map(name => requireString(name, 'creator')) } as unknown as SeasonPaper; });
  if (!papers.length) throw new TypeError('A surface season names the papers whose data and method it follows.');
  const data = text(requireRecord(record.data, 'data'), ['record', 'title', 'url', 'publisher', 'license', 'locator', 'credit'], 'data') as unknown as SeasonData;
  const parsed: SurfaceSeason = { id: requireString(record.id, 'id'), object: requireString(record.object, 'object'), title: requireString(record.title, 'title'), target: requireString(record.target, 'target'), instrument: requireString(record.instrument, 'instrument'), band: requireString(record.band, 'band'), nights, papers, data,
    star: { diameterMas: cited(star.diameterMas, 'diameterMas'), limbPowerLaw: cited(star.limbPowerLaw, 'limbPowerLaw'), inclinationDegrees: cited(star.inclinationDegrees, 'inclinationDegrees'), positionAngleDegrees: cited(star.positionAngleDegrees, 'positionAngleDegrees'), rotationPeriodDays: cited(star.rotationPeriodDays, 'rotationPeriodDays') },
    recipe: { level: requireFiniteNumber(recipe.level, 'level'), regularizer, weight: requireFiniteNumber(recipe.weight, 'weight'), iterations: requireFiniteNumber(recipe.iterations, 'iterations'), source: requireString(recipe.source, 'reconstruction source') },
    referenceNight, twinScales: check.twinScales === undefined ? TWIN_SCALES : requireArray(check.twinScales, 'twinScales').map(scale => requireFiniteNumber(scale, 'twin scale')) };
  if (!(parsed.star.diameterMas.value > 0) || !(parsed.star.limbPowerLaw.value >= 0) || !(parsed.star.rotationPeriodDays.value > 0) || !(parsed.star.inclinationDegrees.value > 0 && parsed.star.inclinationDegrees.value <= 90)) throw new RangeError('The star needs a positive diameter and period, a limb exponent that is not negative and an inclination up to 90 degrees.');
  return parsed;
}

/** The step of the table's nodes, in degrees: finer than a level-3 HEALPix tile (7.3 degrees), as the magnetic maps' tables are. */
export const TABLE_STEP_DEGREES = 5;
export const BRIGHTNESS_VARIABLE = 'Brightness [%]', FACING_VARIABLE = 'Facing';

/** The map as a Tecplot table the raster recipe reads (tecplot-lonlat-map.ts). `grid` and `facing` are surface.jl's, on ROTIR's
 * longitudes; `observerLongitude` is ROTIR's longitude of the meridian facing the observer on the reference night, which becomes
 * longitude 0. Brightness is in percent of the mean over the nodes that ever faced the observer, each weighted by its area;
 * a node that never did holds 100. */
export function surfaceTable(grid: { readonly columns: number; readonly rows: number; readonly values: ArrayLike<number> }, facing: { readonly columns: number; readonly rows: number; readonly values: ArrayLike<number> }, observerLongitude: number, title: string) {
  const step = TABLE_STEP_DEGREES, columns = 360 / step + 1, rows = 180 / step + 1, nodes: { longitude: number; latitude: number; value: number; facing: number }[] = [];
  // A node on a pole or on the closing meridian reads the cell just inside the grid.
  const inside = (latitude: number) => Math.min(180 - 1e-6, Math.max(1e-6, 90 - latitude));
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) { const longitude = i * step, latitude = -90 + j * step, rotir = longitude % 360 + observerLongitude;
    nodes.push({ longitude, latitude, value: sampleSurfaceGrid(grid, inside(latitude), rotir), facing: sampleSurfaceGrid(facing, inside(latitude), rotir) }); }
  let sum = 0, weight = 0;
  for (const node of nodes) if (node.facing > 0 && node.longitude < 360) { const area = Math.cos(node.latitude * Math.PI / 180); sum += node.value * area; weight += area; }
  if (!(weight > 0) || !(sum > 0)) throw new Error('No node of the map ever faced the observer.');
  const mean = sum / weight, lines = [`TITLE     = "${title.replaceAll('"', "'")}"`, `VARIABLES = "Longitude [Deg]" "Latitude [Deg]" "${BRIGHTNESS_VARIABLE}" "${FACING_VARIABLE}"`, `ZONE I=${columns}, J=${rows}, K=1, ZONETYPE=Ordered`, 'DATAPACKING=POINT', 'DT=(SINGLE SINGLE SINGLE SINGLE)'];
  let minimum = Infinity, maximum = -Infinity, seen = 0;
  for (const node of nodes) { const percent = node.facing > 0 ? node.value / mean * 100 : 100; if (node.facing > 0) { minimum = Math.min(minimum, percent); maximum = Math.max(maximum, percent); seen++; }
    lines.push(`${node.longitude.toFixed(1)} ${node.latitude.toFixed(1)} ${percent.toFixed(3)} ${node.facing.toFixed(4)}`); }
  return { text: `${lines.join('\n')}\n`, minimumPercent: Number(minimum.toFixed(3)), maximumPercent: Number(maximum.toFixed(3)), nodes: nodes.length, seenNodes: seen };
}

/** The spotless twin the spot check is taken against: the spottiest of those whose own reconstruction fits on the sphere. The
 * twin of the sphere's own size must be one of them, or the run checks nothing. */
export function decidingTwin<T extends { readonly scale: number; readonly ratio: number; readonly fits: boolean }>(twins: readonly T[]): T {
  const fitting = twins.filter(twin => twin.fits);
  if (!fitting.some(twin => twin.scale === 1)) throw new Error('The spotless twin of the season\'s own size does not fit on its sphere: the run is not a check.');
  return fitting.reduce((worst, twin) => twin.ratio < worst.ratio ? twin : worst);
}

const exists = (path: string) => stat(path).then(() => true, () => false);
/** The star as surface.jl rasterised it on the sky: a plain image with its pixel size in CDELT2, in milliarcseconds. */
export function readSurfaceSky(bytes: Buffer): ReconstructionPlane {
  const image = readFitsImage(bytes), pixelMas = Math.abs(requireFiniteNumber(image.header.CDELT2, 'CDELT2'));
  if (image.header.CUNIT2 !== 'mas' || !(pixelMas > 0)) throw new TypeError('Not a sky image written by surface.jl.');
  return { width: image.width, height: image.height, values: image.values, pixelMas };
}

export async function surfaceStar(seasonDirectory: string, work: string, { threads = 4 }: { threads?: number } = {}) {
  const season = parseSurfaceSeason(JSON.parse(await readFile(resolve(seasonDirectory, 'season.json'), 'utf8')) as unknown);
  await mkdir(resolve(work, 'data'), { recursive: true });

  // 1. Fetch.
  for (const night of season.nights) { const path = resolve(work, 'data', night.file);
    if ((await stat(path).catch(() => null))?.size !== night.bytes) { const response = await fetch(night.origin);
      if (!response.ok) throw new Error(`${night.origin} answered ${response.status}.`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== night.bytes) throw new Error(`${night.file} is ${bytes.length} bytes at its origin, not the recorded ${night.bytes}.`);
      await writeFile(path, bytes); } }
  const real = await Promise.all(season.nights.map(night => readFile(resolve(work, 'data', night.file))));
  const rows = real.map(bytes => readChannelRows(bytes));
  let longest = 0, wavelengthSum = 0, wavelengthCount = 0;
  for (const night of rows) { for (const row of night.vis2) longest = Math.max(longest, Math.hypot(row.u, row.v)); for (const wavelength of night.wavelengthsMetres) { wavelengthSum += wavelength; wavelengthCount++; } }
  const beamMas = wavelengthSum / wavelengthCount / (2 * longest) * 206264806.247, diameterMas = season.star.diameterMas.value, alpha = season.star.limbPowerLaw.value;

  // 2. Twins and halves. Each night's twin has its own noise draw; a half's twin is that half of the night's twin.
  const twin = (scale: number) => real.map((bytes, i) => simulateSpotlessDisc(bytes, { diameterMas: diameterMas * scale, powerLaw: alpha, seed: i + 1 }).bytes);
  const twinName = (scale: number) => scale === 1 ? 'spotless' : `spotless-${scale}`, scales = [...new Set([1, ...season.twinScales])];
  const sets: Record<string, Buffer[]> = { season: real };
  for (const scale of scales) sets[twinName(scale)] = twin(scale);
  for (const half of ['even', 'odd'] as const) { sets[half] = real.map(bytes => selectOifits(bytes, { half }).bytes); sets[`${half}-spotless`] = sets.spotless!.map(bytes => selectOifits(bytes, { half }).bytes); }

  // 3. Reconstruct, one run at a time. A run whose inputs and settings are the ones it was made from is kept.
  const options: SurfaceOptions = { diameterMas, limbDarkening: alpha, limbLaw: 'power', inclinationDegrees: season.star.inclinationDegrees.value, positionAngleDegrees: season.star.positionAngleDegrees.value, rotationPeriodDays: season.star.rotationPeriodDays.value,
    regularizer: season.recipe.regularizer, weight: season.recipe.weight, level: season.recipe.level, iterations: season.recipe.iterations, coverage: true, threads, skyPixelMas: diameterMas / 64, skyPixels: 128, gridColumns: 720, gridRows: 360 };
  const summaries: Record<string, Record<string, number>> = {};
  for (const [name, files] of Object.entries(sets)) { const directory = resolve(work, name), paths: string[] = [], stamp = JSON.stringify(options);
    await mkdir(directory, { recursive: true });
    let same = await readFile(resolve(directory, 'settings.json'), 'utf8').catch(() => '') === stamp && await exists(resolve(directory, 'surface-summary.txt'));
    for (const [i, bytes] of files.entries()) { const path = resolve(directory, season.nights[i]!.file); if (!(await readFile(path).catch(() => null))?.equals(bytes)) { same = false; await writeFile(path, bytes); } paths.push(path); }
    if (!same) { await reconstructSurface(paths, directory, options); await writeFile(resolve(directory, 'settings.json'), stamp); }
    summaries[name] = Object.fromEntries((await readFile(resolve(directory, 'surface-summary.txt'), 'utf8')).split('\n').filter(Boolean).map(line => { const [key, number] = line.split('='); return [key!, Number(number)]; })); }

  // 4. Check: the spot maps of every night's sky, end to end.
  const skies = async (name: string) => { const maps: Float64Array[] = [];
    for (let k = 1; k <= season.nights.length; k++) maps.push(spotMap(readSurfaceSky(await readFile(resolve(work, name, k === 1 ? 'surface-sky.fits' : `surface-sky-${k}.fits`))), diameterMas, beamMas));
    const joined = new Float64Array(maps.reduce((sum, map) => sum + map.length, 0)); let offset = 0; for (const map of maps) { joined.set(map, offset); offset += map.length; } return joined; };
  const seasonSpots = await skies('season'), twins = [];
  for (const scale of scales) { const own = summaries[twinName(scale)]!, chi2 = { vis2: own.chi2r_vis2!, closurePhase: own.chi2r_t3phi! };
    twins.push({ scale, diameterMas: diameterMas * scale, chi2, fits: chi2.vis2 <= RECONSTRUCTION_CHI2_LIMIT && chi2.closurePhase <= RECONSTRUCTION_CHI2_LIMIT, ...compareSpotMaps(seasonSpots, await skies(twinName(scale))) }); }
  const spots = { ...decidingTwin(twins), twins: twins.map(({ scale, spotlessRms, ratio, chi2, fits }) => ({ scale, spotlessRms, ratio, chi2, fits })) };
  const halves = reproducibility(await skies('even'), await skies('even-spotless'), await skies('odd'), await skies('odd-spotless'));
  const fit = summaries.season!, verdict = reconstructionVerdict({ vis2: fit.chi2r_vis2!, closurePhase: fit.chi2r_t3phi! }, spots, halves);

  // 5. The table, on the meridian that faced the Earth on the reference night.
  const reference = season.nights.findIndex(night => night.night === season.referenceNight) + 1, observerLongitude = fit[`observer_longitude_${reference}`]!;
  const table = surfaceTable(readSurfaceGrid(await readFile(resolve(work, 'season/surface-grid.fits'))), readSurfaceGrid(await readFile(resolve(work, 'season/surface-coverage.fits'))), observerLongitude,
    `Surface brightness of ${season.title}, ROTIR on ${season.nights.length} nights (season ${season.id})`);
  await writeFile(resolve(work, `${season.id}.dat`), table.text);
  const { entry } = await toolchainDescriptor('rotir'), packages = requireRecord(entry.packages, 'rotir packages');
  const commit = (name: string) => requireString(requireRecord(packages[name], name).commit, `${name} commit`);
  // Longitude 0 of the table minus each night's Earth-facing meridian: where on the map the observer stood that night.
  const nights = season.nights.map((night, i) => ({ night: night.night, file: night.file, origin: night.origin, bytes: night.bytes, vis2: rows[i]!.vis2.length, closurePhases: rows[i]!.t3.length, daysAfterFirst: fit[`epoch_days_${i + 1}`]!,
    subObserverLongitude: Number((((fit[`observer_longitude_${i + 1}`]! - observerLongitude) % 360 + 540) % 360 - 180).toFixed(3)), subObserverLatitude: Number((90 - fit[`observer_colatitude_${i + 1}`]!).toFixed(3)),
    chi2: { vis2: fit[`epoch_chi2r_vis2_${i + 1}`]!, closurePhase: fit[`epoch_chi2r_t3phi_${i + 1}`]! } }));
  const result = { schema: SURFACE_MAP_SCHEMA, season: season.id, object: season.object, title: season.title, target: season.target, instrument: season.instrument, band: season.band, papers: season.papers, data: season.data, star: season.star, recipe: season.recipe, referenceNight: season.referenceNight,
    codes: { rotir: commit('ROTIR'), oitools: commit('OITOOLS') }, beamMas: Number(beamMas.toFixed(4)), longestBaselineMetres: Number(longest.toFixed(2)), nights,
    points: { vis2: fit.vis2!, closurePhases: fit.t3phi! }, tiles: fit.tiles!, tilesSeen: fit.visible_tiles!,
    fit: { vis2: fit.chi2r_vis2!, closurePhase: fit.chi2r_t3phi!, spotlessVis2: fit.start_chi2r_vis2!, spotlessClosurePhase: fit.start_chi2r_t3phi!, contrast: fit.contrast! },
    spots, halves, verdict, table: { file: `${season.id}.dat`, stepDegrees: TABLE_STEP_DEGREES, ...table, text: undefined } };
  await writeFile(resolve(work, 'verdict.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [seasonDirectory, work] = process.argv.slice(2);
  if (!seasonDirectory || !work) throw new TypeError('Usage: surface-star <season directory> <work directory>');
  const result = await surfaceStar(resolve(seasonDirectory), resolve(work));
  console.log(result.verdict.cast ? `${result.season}: cast.` : `${result.season}: not cast, because ${result.verdict.reasons.join('; ')}.`);
  console.log(JSON.stringify({ fit: result.fit, spotRatio: result.spots.ratio, twins: result.spots.twins, halves: result.halves, table: result.table }, null, 2));
}
