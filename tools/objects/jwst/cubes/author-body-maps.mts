#!/usr/bin/env node
/** Write a body's JWST band maps from its record, src/objects/<id>/source/preparation/jwst-band-maps.json.
 *
 *   node tools/objects/jwst/cubes/author-body-maps.mts <object id> [--check] [--raw <dir>]...
 *
 * The record names the body's rotation model (a text PCK and a NAIF body code) and, for each map, the pinned cubes (each an
 * imaging program and its cube band, with its own Horizons tables; several cubes seen from different sides make one map), the band and continuum windows with the publication they come from, the grid and the emission
 * limit. For each map this tool:
 *
 * 1. takes MAST's level-3 cube from .local/<id>/observations (downloaded once, checked against the program's pin);
 * 2. measures the band's depth in every pixel (spectral-cube.mts);
 * 3. asks JPL Horizons where the body and the Sun were as seen from JWST (500@-170) at the cube's exposure start, and keeps the
 *    two responses beside the record as pinned inputs; a later run reads them instead of asking;
 * 4. computes the camera at the exposure midpoint (observer-camera.mts) with the disc centre fitted on the continuum image;
 * 5. projects each cube onto the body and combines them, each counting most where the body faced the telescope (body-map.mts),
 *    and writes the map as FITS where the record says, with the measurements that
 *    judge it in evidence/jwst-band-maps.json.
 *
 * --check writes nothing and fails if any file would change. */
import { selectedProductInput } from '../../telescopes/selected-product.mts';
import type { ObservationSelection } from '../../telescopes/query.mts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hasErrorCode, requireArray, requireFiniteNumber, requireRecord, requireString } from '../../../sources/source-values.mts';
import { horizonsTables } from '../../sphere-horizons.mts';
import { horizonsRows, loadOrientation, observerRowValues, rowJd } from '../../terrestrial-layers/observer-cameras.mts';
import { placeResolvedDisc } from '../../resolved-disc-map.mts';
import { mastFile } from '../mast.mts';
import { readImagingProgram } from '../imaging/image3.mts';
import { bandDepth, openSpectralCube, type Window } from './spectral-cube.mts';
import { combineUnderPolicy, formatBodyMapProduct, type BodyMapFrame, type BodyMapObservation, type CombinationPolicy, type MeasurementDefinition } from '../../body-map-product.mts';
import { sha256, sha256File } from '../../../../src/platform/sha256.mts';
import { bodyMapFits, type BodyMap } from './body-map.mts';
import { bindMapResolution, bodyMapProductRecord, formatProductRecord } from '../../body-map-publication.mts';
import type { ProductInput, ProductSoftware } from '../../product-record.mts';

const REPOSITORY = resolve(import.meta.dirname, '../../../..');
export const JWST_HORIZONS_CENTER = '500@-170';
const DEGREE = Math.PI / 180;

const window = (value: unknown, label: string): Window => {
  const [from, to] = requireArray(value, label).map(entry => requireFiniteNumber(entry, label));
  if (!(from! < to!)) throw new TypeError(`${label} is a wavelength window in micrometres, short end first.`);
  return [from!, to!];
};
const jdOf = (stated: unknown, label: string) => {
  const time = Date.parse(`${requireString(stated, label)}Z`);
  if (!Number.isFinite(time)) throw new TypeError(`${label} is not a UTC time.`);
  return time / 86_400_000 + 2_440_587.5;
};

export async function authorBodyMaps(id: string, options: { check?: boolean; sources?: readonly string[]; selections?: readonly ObservationSelection[]; recipePath?: string; mapId?: string } = {}) {
  const source = resolve(REPOSITORY, 'src/objects', id, 'source'), recipePath = options.recipePath ?? resolve(source, 'preparation/jwst-band-maps.json'), recipeBytes = await readFile(recipePath),
    record = requireRecord(JSON.parse(recipeBytes.toString('utf8')), 'band maps record');
  if (record.schema !== 'cssearth-jwst-band-maps@1') throw new TypeError('Unsupported band maps record.');
  const body = requireRecord(JSON.parse(await readFile(resolve(REPOSITORY, 'packages/astronomy/data/bodies', `${id}.json`), 'utf8'))), physical = requireRecord(body.physical);
  const radiusKm = requireFiniteNumber(physical.meanRadiusKm, 'mean radius'), command = requireString(physical.horizonsCode, 'Horizons code');
  const rotation = requireRecord(record.rotation, 'rotation'), rotationPath = resolve(source, requireString(rotation.path)), rotationBytes = await readFile(rotationPath),
    orientation = await loadOrientation(source, { kind: 'iau-pck', path: requireString(rotation.path), body: requireFiniteNumber(rotation.body) } as never, REPOSITORY);
  const written = new Map<string, Buffer>(), evidence: Record<string, unknown>[] = [];
  const software: ProductSoftware[] = [{ name: 'cssEarth author-body-maps', version: '1' }, { name: 'node', version: process.versions.node }];
  const round = (value: number, digits = 4) => +value.toFixed(digits), quantile = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.floor(q * (values.length - 1))]!;
  for (const raw of requireArray(record.maps, 'maps')) {
    const entry = requireRecord(raw, 'map'), mapId = requireString(entry.id, 'map id'), measure = requireRecord(entry.measure, 'measure'), grid = requireRecord(entry.grid, 'grid');
    if(options.mapId && options.mapId !== mapId) continue;
    const recipe = { band: window(measure.band, 'band'), continuum: [window(requireArray(measure.continuum)[0], 'continuum'), window(requireArray(measure.continuum)[1], 'continuum')] as const };
    const limit = requireFiniteNumber(entry.maximumEmissionDegrees, 'maximumEmissionDegrees'), minimum = requireFiniteNumber(entry.minimumDiscPixels, 'minimumDiscPixels');
    const placed: BodyMap[] = [], cubes: Record<string, unknown>[] = [], observations: BodyMapObservation[] = [];
    const inputs: ProductInput[] = [{ role: 'body-map recipe', identity: relative(REPOSITORY, recipePath), bytes: recipeBytes.byteLength },
      { role: 'rotation model', identity: requireString(rotation.path), bytes: rotationBytes.byteLength }];
    for (const rawCube of requireArray(entry.cubes, 'cubes')) {
      const stated = requireRecord(rawCube, 'cube'), ephemeris = requireRecord(stated.ephemeris, 'ephemeris');
      const { program } = await readImagingProgram(requireString(stated.program)), band = program.bands.find(other => other.band === stated.band);
      if (!band || band.stage !== 'spec3') throw new Error(`${String(stated.program)} has no cube band ${String(stated.band)}.`);
      const selection = options.selections?.find(s => s.request.target === id && s.programme === stated.program && s.product?.observation === band.observation);
      if(options.selections && !selection) throw new Error(`No selected qualified cube for ${String(stated.program)} ${band.observation}.`);
      if (selection?.request.continuumMicrometres && (JSON.stringify(selection.request.continuumMicrometres) !== JSON.stringify(recipe.continuum) || JSON.stringify(selection.request.wavelengthMicrometres) !== JSON.stringify(recipe.band))) throw new Error('The selected request and map recipe have different band-depth windows.');
      const selected = selection ? await selectedProductInput(REPOSITORY, selection) : undefined;
      const cubePath = selected?.file ?? await mastFile(band.level3, resolve(REPOSITORY, '.local', id, 'observations'), options.sources ?? []), cubePin = await sha256File(cubePath);
      inputs.push(selected?.input ?? { role: 'archive spectral cube', identity: band.level3.uri, ...cubePin });
      const cube = await openSpectralCube(cubePath);
      if (String(cube.primary.TARGPROP ?? cube.primary.TARGNAME).toUpperCase() !== requireString(entry.target, 'target').toUpperCase()) throw new Error(`${band.level3.name} is a cube of ${String(cube.primary.TARGPROP)}, not ${String(entry.target)}.`);
      const depth = await bandDepth(cube, recipe);
      const startJd = jdOf(cube.primary['DATE-BEG'], 'DATE-BEG'), endJd = jdOf(cube.primary['DATE-END'], 'DATE-END'), paths = { observer: requireString(ephemeris.observer), heliocentric: requireString(ephemeris.heliocentric) };
      let tables = await Promise.all([readFile(resolve(source, paths.observer), 'utf8'), readFile(resolve(source, paths.heliocentric), 'utf8')]).then(([observer, heliocentric]) => ({ observer, heliocentric }), () => null);
      if (!tables) {
        if (options.check) throw new Error(`${id} ${mapId}: the Horizons tables of ${band.observation} are not written yet.`);
        tables = await horizonsTables(command, [startJd], undefined, JWST_HORIZONS_CENTER);
        written.set(resolve(source, paths.observer), Buffer.from(tables.observer)); written.set(resolve(source, paths.heliocentric), Buffer.from(tables.heliocentric));
      }
      for (const [role, path, text] of [['observer ephemeris', paths.observer, tables.observer], ['heliocentric ephemeris', paths.heliocentric, tables.heliocentric]] as const) {
        const bytes = Buffer.from(text); inputs.push({ role, identity: `src/objects/${id}/source/${path}`, bytes: bytes.byteLength });
      }
      if (!/\(-170\)/u.test(tables.observer)) throw new Error(`${paths.observer} was not asked for JWST as the observer.`);
      const row = horizonsRows(tables.observer)[0]!;
      if (Math.abs(rowJd(row) - startJd) >= 2 / 86_400) throw new Error(`${paths.observer} has no row at the cube's exposure start.`);
      const { rightAscension, declination, rangeAu } = observerRowValues(row);
      const [sunX, sunY, sunZ] = (horizonsRows(tables.heliocentric).find(line => line.trimStart().startsWith('X ='))?.match(/-?\d+\.\d+(?:E[+-]\d+)?/gu) ?? []).map(Number), sunRange = Math.hypot(sunX!, sunY!, sunZ!);
      if (![rightAscension, declination, rangeAu, sunRange].every(Number.isFinite)) throw new Error(`${id} ${mapId}: unreadable Horizons rows for ${band.observation}.`);
      const mode = String(cube.primary.INSTRUME).toUpperCase() === 'NIRSPEC' ? 'NIRSPEC/IFU' : String(cube.primary.INSTRUME).toUpperCase() === 'MIRI' ? 'MIRI/IFU' : '';
      if (!mode) throw new Error(`${band.level3.name} is not a body-map cube mode.`);
      const result = placeResolvedDisc({ plane: { width: depth.width, height: depth.height, values: depth.depth, registrationValues: depth.continuum, uncertainty: depth.error, arcsecPerPixel: cube.arcsecPerPixel },
        identity: { id: band.observation, telescope: 'JWST', instrument: band.band, mode, programme: requireString(stated.program), midTimeJd: (startJd + endJd) / 2, startTimeJd: startJd, endTimeJd: endJd, startIso: new Date(`${String(cube.primary['DATE-BEG']).replace(/Z$/u,'')}Z`).toISOString(), endIso: new Date(`${String(cube.primary['DATE-END']).replace(/Z$/u,'')}Z`).toISOString(), exposureSeconds: (endJd - startJd) * 86_400 },
        geometry: { epochJd: (startJd + endJd) / 2, targetRightAscensionDegrees: rightAscension!, targetDeclinationDegrees: declination!, rangeAu: rangeAu!,
          sunRightAscensionDegrees: (Math.atan2(-sunY!, -sunX!) / DEGREE + 360) % 360, sunDeclinationDegrees: Math.asin(-sunZ! / sunRange) / DEGREE },
        orientation, radiusKm, grid: { width: requireFiniteNumber(grid.width), height: requireFiniteNumber(grid.height) }, maximumEmissionDegrees: limit, minimumDiscPixels: minimum,
        fittedResolutionBasis: 'full width at half maximum of the Gaussian blur fitted to the disc edge in the continuum image' });
      const { map, centre, camera, radiusPixels } = result, seen = [...map.depth].filter(Number.isFinite);
      placed.push(map); observations.push(result.observation);
      cubes.push({ observation: band.observation, program: stated.program, cube: band.level3.name, exposure: { start: cube.primary['DATE-BEG'], end: cube.primary['DATE-END'] },
        disc: { diameterPixels: round(2 * radiusPixels, 2), centrePixels: centre.center.map(value => round(value, 2)), blurPixels: centre.blurPixels, fitResidualOverPeak: round(centre.residualOverPeak) },
        camera: { observerLatitude: round(camera.observerLatitude), observerWestLongitude: round(camera.observerWestLongitude), sunLatitude: round(camera.sunLatitude), sunWestLongitude: round(camera.sunWestLongitude), northAzimuthDegrees: round(camera.northAzimuthDegrees), rangeKm: round(camera.rangeKm, 0) },
        map: { areaShare: round(map.areaShare), depth: { minimum: round(quantile(seen, 0)), median: round(quantile(seen, 0.5)), maximum: round(quantile(seen, 1)) } } });
    }
    const output = requireString(entry.output, 'output'), quantity = requireString(entry.quantity, 'quantity'), units = requireString(entry.units, 'units');
    // A band depth is the ground's own, so cubes from different dates are one measurement and a cell is their weighted mean.
    const definition: MeasurementDefinition = { quantity, units, timeDependence: 'surface-property', wavelengthIntervalsMicrometres: [recipe.band], source: requireString(measure.source, 'measure.source'),
      method: { kind: 'band-depth', bandMicrometres: recipe.band, continuumMicrometres: recipe.continuum, continuum: 'straight line through the two window means, each at the mean wavelength of its retained samples', depth: '1 - band mean / continuum at the band' } };
    const frame: BodyMapFrame = { body: id, radiusKm, rotation: { model: requireString(rotation.path), bodyCode: requireFiniteNumber(rotation.body) } };
    const policy: CombinationPolicy = { time: { rule: 'time-invariant' }, resolution: { rule: 'as-observed' } };
    const { map, overlaps } = combineUnderPolicy(placed.map((placedMap, index) => ({ map: placedMap, definition, frame, observation: observations[index]! })), policy, limit);
    const fits = bodyMapFits(map, { TELESCOP: 'JWST', OBJECT: requireString(entry.target), QUANTITY: quantity, NCUBES: String(placed.length) },
      [{ name: quantity, units, values: map.depth }, { name: `${quantity} ERROR`, units, values: map.error }]);
    // What the map means, beside it: the band and continuum that define the number, the frame, and every cube that went in.
    const unqualifiedMap = { schema: 'cssearth-body-map@1',
      definition, frame,
      grid: { width: map.width, height: map.height, longitude: 'east-positive-from-0', rows: 'north-to-south' }, planes: { file: output.split('/').pop()!, value: quantity, uncertainty: `${quantity} ERROR` },
      mask: { maximumEmissionDegrees: limit, missing: 'NaN' }, observations, ...(observations.length > 1 ? { combination: policy } : {}) } as const;
    const resolution = bindMapResolution(unqualifiedMap, 'measured', 'disc-edge-gaussian-fit', cubes), mapProduct = resolution.product;
    const metadata = Buffer.from(formatBodyMapProduct(mapProduct));
    written.set(resolve(source, `${output}.body-map.json`), metadata);
    written.set(resolve(dirname(resolve(source, output)), resolution.output.path), resolution.output.bytes);
    written.set(resolve(source, output), fits);
    written.set(resolve(source, `${output}.product.json`), Buffer.from(formatProductRecord(bodyMapProductRecord(mapProduct, fits, metadata, inputs, software, undefined, [resolution.output]))));
    let peak = { value: -Infinity, cell: 0 }; const seen: number[] = [], errors: number[] = [];
    map.depth.forEach((value, cell) => { if (Number.isFinite(value)) { seen.push(value); errors.push(map.error[cell]!); if (value > peak.value) peak = { value, cell }; } });
    evidence.push({ id: mapId, cubes, overlaps: overlaps.filter(pair => pair.cells >= 500).map(pair => ({ first: cubes[pair.first]!.observation, second: cubes[pair.second]!.observation, cells: pair.cells, rmsDifference: round(pair.rmsDifference), correlation: round(pair.correlation, 3) })),
      map: { cells: map.seenCells, areaShare: round(map.areaShare), depth: { minimum: round(quantile(seen, 0)), median: round(quantile(seen, 0.5)), maximum: round(peak.value) }, medianError: round(quantile(errors, 0.5)),
        peak: { latitude: round(90 - (Math.floor(peak.cell / map.width) + 0.5) * 180 / map.height, 1), westLongitude: round((360 - (peak.cell % map.width + 0.5) * 360 / map.width) % 360, 1) } } });
  }
  if (!evidence.length) throw new Error('The recipe contains no requested map.');
  const evidencePath=resolve(REPOSITORY, 'src/objects', id, 'evidence/jwst-band-maps.json');
  const retained=options.mapId ? await readFile(evidencePath,'utf8').then(text=>{
    const old=requireRecord(JSON.parse(text));
    if(old.schema!=='cssearth-jwst-band-maps-evidence@1')throw new Error('Unsupported previous band-map evidence.');
    return requireArray(old.maps).filter(map=>requireRecord(map).id!==options.mapId);
  }).catch(error=>{if(hasErrorCode(error,'ENOENT'))return [];throw error;}) : [];
  written.set(evidencePath, Buffer.from(`${JSON.stringify({ schema: 'cssearth-jwst-band-maps-evidence@1', maps: [...retained,...evidence] }, null, 2)}\n`));
  const changed: string[] = [];
  for (const [path, bytes] of written) if (!(await readFile(path).then(existing => existing.equals(bytes), () => false))) { changed.push(path); if (!options.check) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); } }
  if (options.check && changed.length) throw new Error(`Not reproduced: ${changed.join(', ')}`);
  return { evidence, changed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), id = args.find((arg, i) => !arg.startsWith('--') && !['--raw', '--selection', '--recipe', '--map-id'].includes(args[i - 1] ?? ''));
  if (!id) throw new TypeError('Usage: author-body-maps <object id> [--check] [--raw <dir>] [--recipe <file>] [--map-id <id>] [--selection <file>]...');
  const selections = await Promise.all(args.flatMap((arg,i)=>arg==='--selection'?[readFile(resolve(args[i+1]!), 'utf8').then(text=>JSON.parse(text) as ObservationSelection)]:[]));
  const result = await authorBodyMaps(id, { ...(selections.length ? { selections } : {}), ...(args.includes('--recipe') ? { recipePath: resolve(args[args.indexOf('--recipe')+1]!) } : {}), ...(args.includes('--map-id') ? { mapId: args[args.indexOf('--map-id')+1]! } : {}), check: args.includes('--check'), sources: args.flatMap((arg, i) => arg === '--raw' ? [resolve(args[i + 1]!)] : []) });
  console.log(`BODY_MAPS ${JSON.stringify(result.evidence)}`);
  console.log(args.includes('--check') ? 'Reproduced.' : `Wrote ${result.changed.length} file(s).`);
}
