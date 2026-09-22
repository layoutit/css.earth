#!/usr/bin/env node
/** Turn one checked NACO jitter product into a registered body map through the shared resolved-disc boundary.
 *
 *   node tools/objects/naco/author-body-map.mts <target> <program> <naco_img_jitter.fits> --raw <raw-dir> [--out <map.fits>] [--check]
 *
 * NACO's recipe drops WCS because shift-and-add changes the mosaic origin. It does not rotate the detector. This adapter
 * therefore proves the axes from every pinned raw frame (north up, east left, one common scale and zero position angle),
 * while the shared resolved-disc stage fits the new origin and owns all body geometry and projection.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFitsImage } from '../../fits/fits.mts';
import { requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { bodyMapFits, topRowFirst } from '../jwst/cubes/body-map.mts';
import { formatBodyMapProduct, type BodyMapFrame, type MeasurementDefinition } from '../body-map-product.mts';
import { bindMapResolution, bodyMapProductRecord, formatProductRecord } from '../body-map-publication.mts';
import { fileSize, productRecordPath, readProductRecord, sameRun, type ProductInput, type ProductSoftware } from '../product-record.mts';
import { placeResolvedDisc } from '../resolved-disc-map.mts';
import { horizonsTables } from '../sphere-horizons.mts';
import { horizonsRows, LEAP_SECONDS_KERNEL, loadOrientation, observerRowValues, rowJd } from '../terrestrial-layers/observer-cameras.mts';
import { esoHeader, type EsoHeader } from '../interferometry/eso-pipeline.mts';
import { readProgram } from './archive.mts';

const REPOSITORY = resolve(import.meta.dirname, '../../..');
const PCK = 'src/spice/cassini/pck/pck00011.tpc';
const DEGREE = Math.PI / 180, ARCSEC_PER_RADIAN = 206_264.806_247, AU_KM = 1.495978707e8;

const jdOf = (value: string) => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new TypeError(`${value} is not a UTC time.`);
  return milliseconds / 86_400_000 + 2_440_587.5;
};
const number = (header: EsoHeader, key: string) => requireFiniteNumber(Number(header[key]), key);
const median = (values: readonly number[]) => {
  if (!values.length) throw new RangeError('A median needs samples.');
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};
const pckBodyCode = (command: string) => {
  const small = /^(\d+);$/u.exec(command), major = /^(\d+)$/u.exec(command);
  if (!small && !major) throw new TypeError(`${command} is not a numbered Horizons target with an IAU PCK frame.`);
  return small ? 2_000_000 + Number(small[1]) : Number(major![1]);
};

/** A small crop is both the actual measurement and a bound on limb fitting; the full jitter canvas is mostly sky. */
export function cropAroundBrightest(values: Float64Array, width: number, height: number, radiusPixels: number, radii = 3) {
  let brightest = -1, peak = -Infinity;
  values.forEach((value, index) => { if (Number.isFinite(value) && value > peak) { peak = value; brightest = index; } });
  if (brightest < 0) throw new Error('The jitter product has no finite sample.');
  const centerX = brightest % width, centerY = Math.floor(brightest / width), half = Math.ceil(radiusPixels * radii);
  const x0 = Math.max(0, Math.min(width - (2 * half + 1), centerX - half)), y0 = Math.max(0, Math.min(height - (2 * half + 1), centerY - half));
  const cropWidth = Math.min(width, 2 * half + 1), cropHeight = Math.min(height, 2 * half + 1), cropped = new Float64Array(cropWidth * cropHeight);
  for (let y = 0; y < cropHeight; y++) cropped.set(values.subarray((y0 + y) * width + x0, (y0 + y) * width + x0 + cropWidth), y * cropWidth);
  return { values: cropped, width: cropWidth, height: cropHeight, brightest: [centerX - x0, centerY - y0] as const, origin: [x0, y0] as const };
}

/** Sky subtraction and disc-median normalisation used by the NACO adapter; no absolute photometric claim is made. */
export function relativeIntensity(crop: ReturnType<typeof cropAroundBrightest>, radiusPixels: number) {
  const [cx, cy] = crop.brightest, sky: number[] = [], disc: number[] = [];
  crop.values.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    const distance = Math.hypot(index % crop.width - cx, Math.floor(index / crop.width) - cy);
    if (distance <= radiusPixels) disc.push(value);
    else if (distance >= radiusPixels * 1.5) sky.push(value);
  });
  const background = median(sky), absolute = sky.map(value => Math.abs(value - background)), sigma = 1.4826 * median(absolute);
  const scale = median(disc.map(value => value - background).filter(value => value > 0));
  if (!(sigma > 0) || !(scale > 0)) throw new Error('The jitter image has no measurable sky noise or positive disc level.');
  const values = Float64Array.from(crop.values, value => (value - background) / scale), uncertainty = new Float64Array(values.length).fill(sigma / scale);
  return { values, uncertainty, background, scale, sigma };
}

/** Raw frames are the spatial provenance the combined product intentionally omits. */
export function nacoSkyRegistration(headers: readonly EsoHeader[]) {
  if (!headers.length) throw new Error('NACO registration needs the raw object frames.');
  const first = headers[0]!, scale = Math.abs(number(first, 'CD1_1')) * 3600;
  for (const header of headers) {
    const cd11 = number(header, 'CD1_1'), cd12 = number(header, 'CD1_2'), cd21 = number(header, 'CD2_1'), cd22 = number(header, 'CD2_2');
    if (header.CTYPE1 !== 'RA---TAN' || header.CTYPE2 !== 'DEC--TAN' || !(cd11 < 0) || !(cd22 > 0) || cd12 !== 0 || cd21 !== 0 ||
        Math.abs(Math.abs(cd11) - cd22) > 1e-12 || Math.abs(Math.abs(cd11) * 3600 - scale) > 1e-9 || number(header, 'ESO ADA POSANG') !== 0)
      throw new Error('The raw NACO frames do not share one north-up, east-left, zero-position-angle grid.');
  }
  return { arcsecPerPixel: scale, convention: 'raw TAN WCS is north up and east left; naco_img_jitter shift-and-add changes the mosaic origin but not its pixel axes' };
}

export async function authorNacoBodyMap(target: string, programId: string, productPath: string,
  options: { rawDirectory: string; output?: string; check?: boolean } ) {
  const program = await readProgram(programId);
  if (program.mode !== 'imaging' || program.object.toLowerCase() !== target.toLowerCase()) throw new Error(`${programId} is not a NACO imaging program of ${target}.`);
  const product = resolve(productPath), output = resolve(options.output ?? product.replace(/\.fits$/u, '.body-map.fits')),
    productBytes = await readFile(product), reductionRecordPath = productRecordPath(product), reductionRecordBytes = await readFile(reductionRecordPath), reductionRecord = await readProductRecord(reductionRecordPath);
  if (!reductionRecord || !await sameRun(reductionRecord, reductionRecord, name => resolve(dirname(product), name))) throw new Error(`${reductionRecordPath} does not describe the current reduced product.`);
  const reduced = readFitsImage(productBytes), productHeader = await esoHeader(product), template = requireString(productHeader['ESO TPL START'], 'ESO TPL START');
  if (!program.objectTemplates.includes(template) || productHeader.CTYPE1 !== undefined || productHeader.CTYPE2 !== undefined || productHeader['ESO PRO CATG'] !== 'COADDED_IMG')
    throw new Error('The input is not this program\'s WCS-free COADDED_IMG jitter product.');

  const frames = program.science.filter(frame => frame.type === 'OBJECT' && frame.template === template), rawPaths = frames.map(frame => resolve(options.rawDirectory, `${frame.dpId}.fits`));
  if (!frames.length) throw new Error(`${programId} has no object template ${template}.`);
  const rawHeaders: EsoHeader[] = [];
  for (let index = 0; index < frames.length; index++) {
    const pin = await fileSize(rawPaths[index]!), consumed = reductionRecord.inputs.find(input => input.identity === frames[index]!.dpId);
    // The archive table reports the compressed transfer size. The reduction record owns the expanded FITS byte count it
    // actually read, and the file now must be that size.
    if (!consumed || pin.bytes !== consumed.bytes)
      throw new Error(`${rawPaths[index]} is not the pinned ${frames[index]!.dpId} consumed by this reduction.`);
    rawHeaders.push(await esoHeader(rawPaths[index]!));
  }
  const registration = nacoSkyRegistration(rawHeaders);
  if (Math.abs(number(productHeader, 'ESO INS PIXSCALE') - registration.arcsecPerPixel) > 1e-6) throw new Error('The product plate scale differs from its raw frames.');

  const firstJd = jdOf(frames[0]!.start), lastJd = jdOf(frames.at(-1)!.start) + frames.at(-1)!.exposure / 86_400,
    midTimeJd = (firstJd + lastJd) / 2, exposureSeconds = frames.reduce((sum, frame) => sum + frame.exposure, 0);
  const body = requireRecord(JSON.parse(await readFile(resolve(REPOSITORY, 'packages/astronomy/data/bodies', `${target}.json`), 'utf8')), 'body'), physical = requireRecord(body.physical, 'physical'),
    radiusKm = requireFiniteNumber(physical.meanRadiusKm, 'mean radius'), command = requireString(physical.horizonsCode, 'Horizons code'), bodyCode = pckBodyCode(command);
  const observerPath = output.replace(/\.fits$/u, '.horizons-observer.txt'), heliocentricPath = output.replace(/\.fits$/u, '.horizons-heliocentric.txt');
  let tables = await Promise.all([readFile(observerPath, 'utf8'), readFile(heliocentricPath, 'utf8')]).then(([observer, heliocentric]) => ({ observer, heliocentric }), () => null);
  if (!tables) {
    if (options.check) throw new Error('The pinned Horizons tables are missing.');
    tables = await horizonsTables(command, [midTimeJd]);
  }
  const observerRow = horizonsRows(tables.observer)[0]!;
  if (Math.abs(rowJd(observerRow) - midTimeJd) >= 2 / 86_400) throw new Error('The Horizons observer row is not at the image midpoint.');
  const { rightAscension, declination, rangeAu } = observerRowValues(observerRow), [sunX, sunY, sunZ] =
    (horizonsRows(tables.heliocentric).find(line => line.trimStart().startsWith('X ='))?.match(/-?\d+\.\d+(?:E[+-]\d+)?/gu) ?? []).map(Number), sunRange = Math.hypot(sunX!, sunY!, sunZ!);
  if (![rightAscension, declination, rangeAu, sunRange].every(Number.isFinite)) throw new Error('The pinned Horizons geometry is unreadable.');
  if (Math.hypot(number(rawHeaders[0]!, 'RA') - rightAscension!, number(rawHeaders[0]!, 'DEC') - declination!) > 0.1) throw new Error('The raw pointing does not agree with the target ephemeris.');

  const radiusPixels = radiusKm / (rangeAu! * AU_KM) * ARCSEC_PER_RADIAN / registration.arcsecPerPixel,
    crop = cropAroundBrightest(reduced.values, reduced.width, reduced.height, radiusPixels), normalised = relativeIntensity(crop, radiusPixels);
  const pckBytes = await readFile(resolve(REPOSITORY, PCK)), leapBytes = await readFile(resolve(REPOSITORY, LEAP_SECONDS_KERNEL)),
    orientation = await loadOrientation(REPOSITORY, { kind: 'iau-pck', path: PCK, body: bodyCode } as never, REPOSITORY);
  const placed = placeResolvedDisc({ plane: { width: crop.width, height: crop.height, values: normalised.values, uncertainty: normalised.uncertainty, arcsecPerPixel: registration.arcsecPerPixel },
    identity: { id: `${programId}:${template}`, telescope: 'VLT/NACO', instrument: `NAOS+CONICA ${String(productHeader['ESO INS OPTI6 NAME'])}`,
      mode: 'imaging', programme: programId, midTimeJd, startTimeJd: firstJd, endTimeJd: lastJd, exposureSeconds },
    geometry: { epochJd: midTimeJd, targetRightAscensionDegrees: rightAscension!, targetDeclinationDegrees: declination!, rangeAu: rangeAu!,
      sunRightAscensionDegrees: (Math.atan2(-sunY!, -sunX!) / DEGREE + 360) % 360, sunDeclinationDegrees: Math.asin(-sunZ! / sunRange) / DEGREE },
    orientation, radiusKm, grid: { width: 180, height: 90 }, maximumEmissionDegrees: 70, minimumDiscPixels: 20 });

  const quantity = 'RELATIVE KS INTENSITY', units = 'disc median';
  const definition: MeasurementDefinition = { quantity, units, timeDependence: 'instantaneous-state', source: 'ESO NACO raw headers and naco/4.4.13 reduced jitter image', method: {
    kind: 'relative-surface-brightness', filter: String(productHeader['ESO INS OPTI6 NAME']), orientation: registration.convention,
    background: 'median beyond 1.5 apparent disc radii from the brightest sample', normalisation: 'median background-subtracted signal within one apparent disc radius of the brightest sample',
    uncertainty: '1.4826 times the median absolute deviation of the same sky samples, divided by the disc normalisation', photometricCorrection: 'none' } };
  const frame: BodyMapFrame = { body: target, radiusKm, rotation: { model: PCK, bodyCode } };
  const fits = bodyMapFits(placed.map, { TELESCOP: 'VLT/NACO', OBJECT: program.object, QUANTITY: quantity, FILTER: String(productHeader['ESO INS OPTI6 NAME']) },
    [{ name: quantity, units, values: placed.map.depth }, { name: `${quantity} ERROR`, units, values: placed.map.error }]);
  const unqualifiedMap = { schema: 'cssearth-body-map@1', definition, frame,
    grid: { width: placed.map.width, height: placed.map.height, longitude: 'east-positive-from-0', rows: 'north-to-south' },
    planes: { file: basename(output), value: quantity, uncertainty: `${quantity} ERROR` },
    mask: { maximumEmissionDegrees: 70, missing: 'NaN' }, observations: [placed.observation] } as const;
  const resolution = bindMapResolution(unqualifiedMap, 'measured', 'disc-edge-gaussian-fit', placed.centre), mapProduct = resolution.product;
  const metadata = Buffer.from(formatBodyMapProduct(mapProduct)), metadataPath = `${output}.body-map.json`, mapRecordPath = productRecordPath(output);
  const inputs: ProductInput[] = [
    { role: 'reduced jitter image', identity: product, bytes: productBytes.byteLength },
    { role: 'reduction product record', identity: reductionRecordPath, bytes: reductionRecordBytes.byteLength },
    ...await Promise.all(rawPaths.map(async (path, index) => ({ role: 'raw spatial header', identity: frames[index]!.dpId, ...(await fileSize(path)) }))),
    { role: 'observer ephemeris', identity: observerPath, bytes: Buffer.byteLength(tables.observer) },
    { role: 'heliocentric ephemeris', identity: heliocentricPath, bytes: Buffer.byteLength(tables.heliocentric) },
    { role: 'rotation model', identity: PCK, bytes: pckBytes.byteLength },
    { role: 'leap seconds', identity: LEAP_SECONDS_KERNEL, bytes: leapBytes.byteLength },
  ];
  const software: ProductSoftware[] = [{ name: 'cssEarth resolved-disc-map', version: '1' }, { name: 'node', version: process.versions.node }];
  const mapRecord = Buffer.from(formatProductRecord(bodyMapProductRecord(mapProduct, fits, metadata, inputs, software, undefined, [resolution.output])));
  const files = new Map<string, Buffer>([[resolve(dirname(output), resolution.output.path), resolution.output.bytes], [output, fits], [metadataPath, metadata], [mapRecordPath, mapRecord], [observerPath, Buffer.from(tables.observer)], [heliocentricPath, Buffer.from(tables.heliocentric)]]);
  const changed: string[] = [];
  for (const [path, bytes] of files) if (!(await readFile(path).then(existing => existing.equals(bytes), () => false))) {
    changed.push(path); if (!options.check) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); }
  }
  if (options.check && changed.length) throw new Error(`Not reproduced: ${changed.join(', ')}`);
  return { changed, map: mapProduct, registration: { ...registration, fittedCentre: placed.centre.center, fittedBlurPixels: placed.centre.blurPixels,
    fitResidualOverPeak: placed.centre.residualOverPeak, cropOrigin: crop.origin, background: normalised.background, normalisation: normalised.scale, skySigma: normalised.sigma } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [target, program, product] = args, value = (name: string) => { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1]; };
  const rawDirectory = value('--raw');
  if (!target || !program || !product || !rawDirectory) throw new TypeError('Usage: author-body-map <target> <program> <naco_img_jitter.fits> --raw <raw-dir> [--out <map.fits>] [--check]');
  const result = await authorNacoBodyMap(target, program, product, { rawDirectory: resolve(rawDirectory), output: value('--out'), check: args.includes('--check') });
  console.log(`NACO_BODY_MAP ${JSON.stringify(result.registration)}`);
  console.log(args.includes('--check') ? 'Reproduced.' : `Wrote ${result.changed.length} file(s).`);
}
