#!/usr/bin/env node
/** Write a body's ALMA thermal maps from its record, src/objects/<id>/source/preparation/alma-thermal-maps.json.
 *
 *   node tools/objects/interferometry/author-thermal-maps.mts <object id> [--check] [--raw <dir>]...
 *
 * An ALMA continuum image of a resolved Solar System body is a picture of its heat: brightness temperature in every beam,
 * north up and east left. alma-disc-selfcal.mts makes that image from the raw visibilities and writes a receipt beside it.
 * This tool puts it on the body, the way jwst/cubes/author-body-maps.mts puts a band depth on it, and with the same parts:
 *
 * 1. cuts the disc out of each session's 2048² image into a small FITS kept in the package (the full image is 17 MB and
 *    stays in the --raw directory; once the cutout exists the full image is not needed again), carrying the session's
 *    mid-time, beam and noise from the receipt;
 * 2. asks JPL Horizons where the body and the Sun were as seen from ALMA at that mid-time, and keeps the two responses
 *    beside the record as pinned inputs; a later run reads them instead of asking;
 * 3. computes the camera (observer-camera.mts) with the disc centre fitted on the image itself (body-map.mts fitDiscCentre);
 * 4. projects each session onto the body and combines them, each counting most where the body faced the telescope, and
 *    writes the map as FITS where the record says, with the measurements that judge it in evidence/alma-thermal-maps.json.
 *
 * What the map is: the temperature the surface showed at the moment of each session, near local midday where a session looked
 * straight down and later or earlier in the day toward its edges. It is not corrected for the time of day or for the angle the
 * surface was seen at; two sessions that saw one place at different times of day differ for that reason, and the evidence file
 * reports by how much.
 *
 * --check writes nothing and fails if any file would change. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFitsHeader, readFitsImage } from '@cssearth/fits';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { ALMA, horizonsTables } from '../sphere-horizons.mts';
import { horizonsRows, loadOrientation, observerRowValues, rowJd } from '../terrestrial-layers/observer-cameras.mts';
import { placeResolvedDisc } from '../resolved-disc-map.mts';
import { combineUnderPolicy, formatBodyMapProduct, type BodyMapFrame, type BodyMapObservation, type CombinationPolicy, type MeasurementDefinition } from '../body-map-product.mts';
import { sha256 } from '@cssearth/core/node';
import { bodyMapFits, type BodyMap } from '../jwst/cubes/body-map.mts';
import { bindMapResolution, bodyMapProductRecord, formatProductRecord } from '../body-map-publication.mts';
import type { ProductInput, ProductSoftware } from '@cssearth/telescope';

const REPOSITORY = resolve(import.meta.dirname, '../../..');
const DEGREE = Math.PI / 180, MJD_EPOCH_JD = 2_400_000.5;

export interface ThermalCutout { readonly size: number; readonly arcsecPerPixel: number; readonly midJd: number; readonly rmsKelvin: number; readonly kelvin: Float64Array }

/** The square about the disc, `margin` disc radii wide each way, from a full ALMA image stored bottom row first with east on
 * the first column. `offsetMas` is where the uv-plane fit found the disc from the image's reference pixel, east and north. */
export function cutDisc(image: { values: Float64Array; width: number; height: number; referencePixel: readonly [number, number]; arcsecPerPixel: number }, offsetMas: readonly [number, number], radiusArcsec: number, margin: number) {
  const centreX = image.referencePixel[0] - 1 - offsetMas[0] / 1000 / image.arcsecPerPixel, centreY = image.referencePixel[1] - 1 + offsetMas[1] / 1000 / image.arcsecPerPixel;
  const half = Math.ceil(radiusArcsec * margin / image.arcsecPerPixel), size = 2 * half, x0 = Math.round(centreX) - half, y0 = Math.round(centreY) - half;
  if (x0 < 0 || y0 < 0 || x0 + size > image.width || y0 + size > image.height) throw new RangeError('The disc cutout leaves the image.');
  const values = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) values[y * size + x] = image.values[(y0 + y) * image.width + x0 + x]!;
  return { size, values };
}

const cardNumber = (header: Record<string, unknown>, key: string) => requireFiniteNumber(Number(header[key]), key);

export async function authorThermalMaps(id: string, options: { check?: boolean; sources?: readonly string[] } = {}) {
  const source = resolve(REPOSITORY, 'src/objects', id, 'source'), recipePath = resolve(source, 'preparation/alma-thermal-maps.json'), recipeBytes = await readFile(recipePath),
    record = requireRecord(JSON.parse(recipeBytes.toString('utf8')), 'thermal maps record');
  if (record.schema !== 'cssearth-alma-thermal-maps@1') throw new TypeError('Unsupported thermal maps record.');
  const body = requireRecord(JSON.parse(await readFile(resolve(REPOSITORY, 'packages/astronomy/data/bodies', `${id}.json`), 'utf8'))), physical = requireRecord(body.physical);
  const radiusKm = requireFiniteNumber(physical.meanRadiusKm, 'mean radius'), command = requireString(physical.horizonsCode, 'Horizons code');
  const rotation = requireRecord(record.rotation, 'rotation'), rotationPath = resolve(source, requireString(rotation.path)), rotationBytes = await readFile(rotationPath),
    orientation = await loadOrientation(source, { kind: 'iau-pck', path: requireString(rotation.path), body: requireFiniteNumber(rotation.body) } as never, REPOSITORY);
  const written = new Map<string, Buffer>(), evidence: Record<string, unknown>[] = [];
  const software: ProductSoftware[] = [{ name: 'cssEarth author-thermal-maps', version: '1' }, { name: 'node', version: process.versions.node }];
  const round = (value: number, digits = 4) => +value.toFixed(digits), quantile = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.floor(q * (values.length - 1))]!;
  for (const raw of requireArray(record.maps, 'maps')) {
    const entry = requireRecord(raw, 'map'), mapId = requireString(entry.id, 'map id'), grid = requireRecord(entry.grid, 'grid'), limit = requireFiniteNumber(entry.maximumEmissionDegrees, 'maximumEmissionDegrees');
    const margin = requireFiniteNumber(entry.cutoutRadii, 'cutoutRadii'), placed: BodyMap[] = [], sessions: Record<string, unknown>[] = [], observations: BodyMapObservation[] = [], frequencies: number[] = [];
    const inputs: ProductInput[] = [{ role: 'body-map recipe', identity: `src/objects/${id}/source/preparation/alma-thermal-maps.json`, bytes: recipeBytes.byteLength },
      { role: 'rotation model', identity: requireString(rotation.path), bytes: rotationBytes.byteLength }];
    for (const rawSession of requireArray(entry.sessions, 'sessions')) {
      const stated = requireRecord(rawSession, 'session'), sessionId = requireString(stated.id, 'session id'), ephemeris = requireRecord(stated.ephemeris, 'ephemeris'), cutoutPath = resolve(source, requireString(stated.image, 'session image'));
      let bytes: Buffer | null = await readFile(cutoutPath).catch(() => null);
      if (!bytes) {
        if (options.check) throw new Error(`${id} ${mapId}: the cutout of ${sessionId} is not written yet.`);
        const full = requireRecord(stated.selfcal, 'selfcal'), find = async (name: string) => { for (const root of options.sources ?? []) { const found = await readFile(resolve(root, name)).catch(() => null); if (found) return found; } throw new Error(`${name} is in none of the --raw directories.`); };
        const receipt = requireRecord(JSON.parse((await find(requireString(full.receipt, 'selfcal.receipt'))).toString('utf8')), 'selfcal receipt'), final = requireRecord(receipt.final, 'final'), fit = requireRecord(final.fit, 'final.fit'), geometry = requireRecord(receipt.geometry, 'geometry');
        const image = readFitsImage(await find(requireString(full.image, 'selfcal.image'))), header = image.header as Record<string, unknown>;
        if (header.BUNIT !== 'K' || String(header.OBJECT).toUpperCase() !== requireString(entry.target, 'target').toUpperCase() || !(cardNumber(header, 'CDELT1') < 0)) throw new Error(`${String(full.image)} is not a brightness-temperature image of ${String(entry.target)}, east left.`);
        const arcsecPerPixel = cardNumber(header, 'CDELT2') * 3600, radiusArcsec = requireFiniteNumber(geometry.diameterMas, 'diameterMas') / 2000;
        const cut = cutDisc({ values: image.values, width: image.width, height: image.height, referencePixel: [cardNumber(header, 'CRPIX1'), cardNumber(header, 'CRPIX2')], arcsecPerPixel }, [requireFiniteNumber(fit.offsetRaMas, 'offsetRaMas'), requireFiniteNumber(fit.offsetDecMas, 'offsetDecMas')], radiusArcsec, margin);
        const stats = requireRecord(final.image, 'final.image'), temperature = requireRecord(final.brightnessTemperature, 'brightnessTemperature'), beam = requireRecord(final.beam, 'beam');
        const rmsKelvin = requireFiniteNumber(stats.rmsJyPerBeam, 'rms') / requireFiniteNumber(stats.peakJyPerBeam, 'peak') * requireFiniteNumber(temperature.peakKelvin, 'peakKelvin');
        bytes = bodyMapFits({ width: cut.size, height: cut.size } as BodyMap, { TELESCOP: 'ALMA', OBJECT: String(header.OBJECT), SESSION: sessionId, 'DATE-OBS': String(header['DATE-OBS']), 'MJD-MID': String(requireFiniteNumber(geometry.mjd, 'geometry.mjd')),
          PIXSCALE: String(arcsecPerPixel), FREQHZ: String(requireFiniteNumber(final.frequencyHz, 'frequencyHz')), BMAJMAS: String(requireFiniteNumber(beam.majorMas, 'beam')), BMINMAS: String(requireFiniteNumber(beam.minorMas, 'beam')), BPADEG: String(requireFiniteNumber(beam.angleDegrees, 'beam')),
          RMSK: String(rmsKelvin), FLUXSCAL: String(requireFiniteNumber(requireRecord(receipt.fluxScale, 'fluxScale').factor, 'flux scale')), ORIGIN: 'cssEarth tools/objects/interferometry/alma-disc-selfcal.mts' }, [{ name: 'BRIGHTNESS TEMPERATURE', units: 'K', values: cut.values }]);
        written.set(cutoutPath, bytes);
      }
      if (!bytes) throw new Error(`${id} ${mapId}: no cutout for ${sessionId}.`);
      inputs.push({ role: 'brightness-temperature cutout', identity: requireString(stated.image, 'session image'), bytes: bytes.byteLength });
      const primary = readFitsHeader(bytes).header as Record<string, unknown>, plane = readFitsImage(bytes, { start: 2880 });
      const cutout: ThermalCutout = { size: plane.width, arcsecPerPixel: cardNumber(primary, 'PIXSCALE'), midJd: cardNumber(primary, 'MJD-MID') + MJD_EPOCH_JD, rmsKelvin: cardNumber(primary, 'RMSK'), kelvin: plane.values };
      const paths = { observer: requireString(ephemeris.observer), heliocentric: requireString(ephemeris.heliocentric) };
      let tables = await Promise.all([readFile(resolve(source, paths.observer), 'utf8'), readFile(resolve(source, paths.heliocentric), 'utf8')]).then(([observer, heliocentric]) => ({ observer, heliocentric }), () => null);
      if (!tables) {
        if (options.check) throw new Error(`${id} ${mapId}: the Horizons tables of ${sessionId} are not written yet.`);
        tables = await horizonsTables(command, [cutout.midJd], undefined, ALMA);
        written.set(resolve(source, paths.observer), Buffer.from(tables.observer)); written.set(resolve(source, paths.heliocentric), Buffer.from(tables.heliocentric));
      }
      for (const [role, path, text] of [['observer ephemeris', paths.observer, tables.observer], ['heliocentric ephemeris', paths.heliocentric, tables.heliocentric]] as const) {
        const value = Buffer.from(text); inputs.push({ role, identity: `src/objects/${id}/source/${path}`, bytes: value.byteLength });
      }
      const row = horizonsRows(tables.observer)[0]!;
      if (Math.abs(rowJd(row) - cutout.midJd) >= 2 / 86_400) throw new Error(`${paths.observer} has no row at the session's mid-time.`);
      const { rightAscension, declination, rangeAu } = observerRowValues(row);
      const [sunX, sunY, sunZ] = (horizonsRows(tables.heliocentric).find(line => line.trimStart().startsWith('X ='))?.match(/-?\d+\.\d+(?:E[+-]\d+)?/gu) ?? []).map(Number), sunRange = Math.hypot(sunX!, sunY!, sunZ!);
      if (![rightAscension, declination, rangeAu, sunRange].every(Number.isFinite)) throw new Error(`${id} ${mapId}: unreadable Horizons rows for ${sessionId}.`);
      const mode = requireString(entry.mode ?? entry.instrument ?? 'Band 6 continuum', 'mode'), programme = requireString(stated.programme, 'session programme');
      const size = cutout.size, result = placeResolvedDisc({ plane: { width: size, height: size, values: cutout.kelvin, uncertainty: new Float64Array(size * size).fill(cutout.rmsKelvin), arcsecPerPixel: cutout.arcsecPerPixel },
        identity: { id: sessionId, telescope: 'ALMA', instrument: requireString(entry.instrument ?? mode, 'instrument'), mode, programme, midTimeJd: cutout.midJd },
        geometry: { epochJd: cutout.midJd, targetRightAscensionDegrees: rightAscension!, targetDeclinationDegrees: declination!, rangeAu: rangeAu!,
          sunRightAscensionDegrees: (Math.atan2(-sunY!, -sunX!) / DEGREE + 360) % 360, sunDeclinationDegrees: Math.asin(-sunZ! / sunRange) / DEGREE },
        orientation, radiusKm, grid: { width: requireFiniteNumber(grid.width), height: requireFiniteNumber(grid.height) }, maximumEmissionDegrees: limit,
        angularResolution: { majorArcsec: cardNumber(primary, 'BMAJMAS') / 1000, minorArcsec: cardNumber(primary, 'BMINMAS') / 1000, positionAngleDegrees: cardNumber(primary, 'BPADEG'), basis: 'restoring beam of the self-calibrated image' } });
      const { map, centre, camera, radiusPixels } = result, seen = [...map.depth].filter(Number.isFinite);
      placed.push(map); frequencies.push(cardNumber(primary, 'FREQHZ')); observations.push(result.observation);
      sessions.push({ session: sessionId, midJd: round(cutout.midJd, 5), rmsKelvin: round(cutout.rmsKelvin, 2),
        disc: { diameterPixels: round(2 * radiusPixels, 2), centrePixels: centre.center.map(value => round(value, 2)), centreFromCutoutMiddlePixels: centre.center.map(value => round(value - (size - 1) / 2, 2)), blurPixels: centre.blurPixels, fitResidualOverPeak: round(centre.residualOverPeak) },
        camera: { observerLatitude: round(camera.observerLatitude), observerWestLongitude: round(camera.observerWestLongitude), sunLatitude: round(camera.sunLatitude), sunWestLongitude: round(camera.sunWestLongitude), northAzimuthDegrees: round(camera.northAzimuthDegrees), rangeKm: round(camera.rangeKm, 0) },
        map: { areaShare: round(map.areaShare), kelvin: { minimum: round(quantile(seen, 0), 1), median: round(quantile(seen, 0.5), 1), maximum: round(quantile(seen, 1), 1) } } });
    }
    const quantity = requireString(entry.quantity, 'quantity'), units = requireString(entry.units, 'units');
    // A temperature is the state of the ground at one moment, so sessions are never averaged: each cell keeps the session that
    // saw it most squarely, and where sessions overlap their difference is reported. Each session carries its own definition,
    // so sessions imaged at different frequencies are different measurements and the combination refuses them.
    const definitionAt = (frequencyHz: number): MeasurementDefinition => { const wavelength = 299_792_458 / frequencyHz * 1e6; return ({ quantity, units, timeDependence: 'instantaneous-state',
      wavelengthIntervalsMicrometres: [[wavelength, wavelength]], source: requireString(entry.source, 'source'),
      method: { kind: 'brightness-temperature', frequencyGHz: Math.round(frequencyHz / 1e8) / 10, convention: 'Planck', background: 'none added', from: 'self-calibrated continuum image in Jy per beam over the restoring beam solid angle' } }); };
    const frame: BodyMapFrame = { body: id, radiusKm, rotation: { model: requireString(rotation.path), bodyCode: requireFiniteNumber(rotation.body) } };
    const policy: CombinationPolicy = { time: { rule: 'mosaic-of-snapshots' }, resolution: { rule: 'as-observed' } };
    const { map, overlaps } = combineUnderPolicy(placed.map((placedMap, index) => ({ map: placedMap, definition: definitionAt(frequencies[index]!), frame, observation: observations[index]! })), policy, limit);
    const output = requireString(entry.output, 'output'), fits = bodyMapFits(map, { TELESCOP: 'ALMA', OBJECT: requireString(entry.target), QUANTITY: quantity, NSESSION: String(placed.length) },
      [{ name: quantity, units, values: map.depth }, { name: `${quantity} ERROR`, units, values: map.error }]);
    written.set(resolve(source, output), fits);
    const unqualifiedMap = { schema: 'cssearth-body-map@1',
      definition: definitionAt(frequencies[0]!), frame,
      grid: { width: map.width, height: map.height, longitude: 'east-positive-from-0', rows: 'north-to-south' }, planes: { file: output.split('/').pop()!, value: quantity, uncertainty: `${quantity} ERROR` },
      mask: { maximumEmissionDegrees: limit, missing: 'NaN' }, observations, ...(observations.length > 1 ? { combination: policy } : {}) } as const;
    const resolution = bindMapResolution(unqualifiedMap, 'calibrated', 'applied-restoring-beam', sessions), mapProduct = resolution.product;
    const metadata = Buffer.from(formatBodyMapProduct(mapProduct));
    written.set(resolve(source, `${output}.body-map.json`), metadata);
    written.set(resolve(dirname(resolve(source, output)), resolution.output.path), resolution.output.bytes);
    written.set(resolve(source, `${output}.product.json`), Buffer.from(formatProductRecord(bodyMapProductRecord(mapProduct, fits, metadata, inputs, software, undefined, [resolution.output]))));
    const seen = [...map.depth].filter(Number.isFinite);
    evidence.push({ id: mapId, sessions, overlaps: overlaps.filter(pair => pair.cells >= 500).map(pair => ({ first: sessions[pair.first]!.session, second: sessions[pair.second]!.session, cells: pair.cells, rmsDifferenceKelvin: round(pair.rmsDifference, 2), correlation: round(pair.correlation, 3) })),
      map: { cells: map.seenCells, areaShare: round(map.areaShare), kelvin: { minimum: round(quantile(seen, 0), 1), median: round(quantile(seen, 0.5), 1), maximum: round(quantile(seen, 1), 1) } } });
  }
  written.set(resolve(REPOSITORY, 'src/objects', id, 'evidence/alma-thermal-maps.json'), Buffer.from(`${JSON.stringify({ schema: 'cssearth-alma-thermal-maps-evidence@1', maps: evidence }, null, 2)}\n`));
  const changed: string[] = [];
  for (const [path, bytes] of written) if (!(await readFile(path).then(existing => existing.equals(bytes), () => false))) { changed.push(path); if (!options.check) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); } }
  if (options.check && changed.length) throw new Error(`Not reproduced: ${changed.join(', ')}`);
  return { evidence, changed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), id = args.find((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--raw');
  if (!id) throw new TypeError('Usage: author-thermal-maps <object id> [--check] [--raw <dir>]...');
  const result = await authorThermalMaps(id, { check: args.includes('--check'), sources: args.flatMap((arg, i) => arg === '--raw' ? [resolve(args[i + 1]!)] : []) });
  console.log(`THERMAL_MAPS ${JSON.stringify(result.evidence)}`);
  console.log(args.includes('--check') ? 'Reproduced.' : `Wrote ${result.changed.length} file(s).`);
}
