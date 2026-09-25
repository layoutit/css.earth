#!/usr/bin/env node
/** Measure how well a program's JunoCam images register to their target, and write the receipt beside the program.
 *
 *   node tools/objects/juno/measure.mts <program id> <work directory> [--raw <directory holding the pinned files>] [--horizons]
 *
 * For each image the two epochs of `strip-refinement.mts` are fitted to the lit limb of the target's IAU ellipsoid, the
 * one the program's text PCK states, and the receipt records the offsets and the limb residual on held-out points before
 * and after. `--horizons` also compares the spacecraft's position from the kernel bank with JPL Horizons at each image's
 * start, which checks the trajectory reader against a source that shares none of its code. Nothing external runs here:
 * the reader, the cameras and the fit are this repository's TypeScript.
 *
 * Beside the receipt the run writes that receipt's own record (`<receipt>.product.json`, packages/telescope/src/product-record.ts):
 * the images and kernels it read at their pinned sizes and digests, the policy the fit was held to, and the digest of the
 * modules that did it. The measurement is then added to that record as `geometric-registration` evidence, which is what this
 * stage establishes and no more. Agreement with an archive product is another kind of evidence, and nothing here gives it. */
import { sha256 } from '@cssearth/core/node';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { addProductEvidence, writeProductRecord } from '@cssearth/telescope/node';
import { productRecordPath, type ProductInput, type ProductRun, type ProductSoftware } from '@cssearth/telescope';
import { loadKernelSet, type KernelSet } from '../../spice/kernel-set.mts';
import { kernelBankPaths } from '../../spice/kernel-bank.mts';
import { numbers } from '../../spice/text-kernel.mts';
import { utcToEt } from '../../spice/lsk.mts';
import { parsePdsRadiusTable } from '../terrestrial-layers/obj-shape.mts';
import { decodeJunocam, refinableStrips, type JunocamGeometry } from '../terrestrial-layers/junocam.mts';
import { refineStripEpochs, type StripRefinementPolicy } from '../terrestrial-layers/strip-refinement.mts';
import { PROGRAMS, readProgram, writeProgram, type JunocamProgram } from './archive.mts';
import { astroqueryRows } from '../astronomy-packages/client.mts';
import { flagValue, positionalArguments } from '@cssearth/core';

export const RECEIPT_SCHEMA = 'cssearth-junocam-registration@1';
/** The budget every measured program is held to; a lens may state a tighter one. */
export const POLICY: StripRefinementPolicy = { method: 'mesh-limb-epochs', maximumPointingSeconds: 0.05, maximumEphemerisSeconds: 2, maximumResidualPixels: 1.5, minimumControls: 64, maximumControls: 1500, searchPixels: 64 };
const BANDS = ['RED', 'GREEN', 'BLUE'] as const, STEP_DEGREES = 2, JUNO = -61;

/** The target's IAU ellipsoid as a radius table, sampled every two degrees: the surface the limb is fitted to. */
export function ellipsoidMesh(radiiKm: readonly number[]) {
  const [a, b, c] = radiiKm, rows: string[] = [];
  if (radiiKm.length !== 3 || !radiiKm.every(r => r > 0)) throw new Error('The text PCK states no triaxial radii for the target.');
  for (let lat = -90; lat <= 90; lat += STEP_DEGREES) for (let lon = 0; lon <= 360; lon += STEP_DEGREES) {
    const p = lat * Math.PI / 180, l = lon * Math.PI / 180;
    rows.push(`${lon} ${lat} ${(1 / Math.hypot(Math.cos(p) * Math.cos(l) / a!, Math.cos(p) * Math.sin(l) / b!, Math.sin(p) / c!)).toFixed(6)}`);
  }
  const nx = 360 / STEP_DEGREES, ny = 180 / STEP_DEGREES;
  return parsePdsRadiusTable(rows.join('\n'), { metersPerUnit: 1000, expectedVertices: nx * (ny - 1) + 2, expectedFaces: nx * (ny - 2) * 2 + 2 * nx, stepDegrees: STEP_DEGREES, longitudeDirection: 'east-positive' });
}

/** A pinned file from the work directory, a directory that already holds it, or its URL; the program keeps its digest from the first time the bytes are held. */
async function pinned(url: string, bytes: number, digest: string | undefined, directories: readonly string[], work: string) {
  const name = url.slice(url.lastIndexOf('/') + 1);
  let data: Buffer | undefined;
  for (const directory of directories) { const path = resolve(directory, name); if (await access(path).then(() => true, () => false)) { data = await readFile(path); break; } }
  if (!data) { const response = await fetch(url); if (!response.ok) throw new Error(`${url} answered ${response.status}.`); data = Buffer.from(await response.arrayBuffer()); await writeFile(resolve(work, name), data); }
  const actual = sha256(data);
  if (data.length !== bytes || (digest !== undefined && actual !== digest)) throw new Error(`${name} does not match its pin: ${data.length} bytes, ${actual}.`);
  return { data, sha256: actual };
}

/** Juno's position relative to the target from the bank against JPL Horizons' vectors at each epoch, in metres. */
export async function horizonsCheck(set: KernelSet, program: JunocamProgram) {
  const epochs = program.images.map(image => utcToEt(set.leapSeconds, image.startTime)), julian = epochs.map(et => (2451545 + et / 86400).toFixed(9));
  const rows = await astroqueryRows({ operation: 'horizons-vectors', id: String(JUNO), location: `@${program.target.naifId}`,
    epochs: julian.map(Number), refplane: 'frame', aberrations: 'geometric' });
  if (rows.length !== epochs.length) throw new Error('Horizons returned a different number of epochs.');
  return { source: 'JPL Horizons through Astroquery', query: { target: JUNO, center: `@${program.target.naifId}`, epochs: julian, refplane: 'frame', aberrations: 'geometric' },
    differencesMeters: rows.map((row, i) => { const ours = set.ephemeris.state(JUNO, program.target.naifId, epochs[i]!).position;
      return 1000 * Math.hypot(ours[0] - Number(row.x), ours[1] - Number(row.y), ours[2] - Number(row.z)); }) };
}

/** The version of the software that measured a registration: the digest of the modules that decode an image, place it and fit
 * its limb. Nothing external runs, so there is no installed toolchain to pin. */
export async function registrationSoftware(): Promise<ProductSoftware[]> {
  const sources = await Promise.all(['measure.mts', '../terrestrial-layers/junocam.mts', '../terrestrial-layers/strip-refinement.mts']
    .map(name => readFile(resolve(import.meta.dirname, name))));
  return [{ name: 'cssearth tools/objects/juno/measure.mts', version: sha256(Buffer.concat(sources)) }];
}

/** What identifies one registration: every image and label it measured and every kernel it read, each at its pinned size and
 * digest, with the policy the fit was held to. */
export function registrationRun(program: JunocamProgram, kernels: readonly { path: string; bytes: number; sha256: string }[],
  software: readonly ProductSoftware[]): ProductRun {
  const pin = (role: string, identity: string, bytes: number): ProductInput => ({ role, identity, bytes });
  return {
    telescope: 'Juno', stage: 'junocam-registration',
    inputs: [
      ...program.images.flatMap(image => [pin(`image ${image.productId}`, image.url, image.bytes),
        pin(`label ${image.productId}`, image.labelUrl, image.labelBytes)]),
      ...kernels.map(kernel => pin('kernel', `${program.kernelSet}/${kernel.path}`, kernel.bytes)),
    ],
    parameters: { volume: program.volume, target: program.target, observer: JUNO, bands: BANDS, aberration: 'LT+S',
      ellipsoidStepDegrees: STEP_DEGREES, policy: POLICY },
    software,
  };
}

/** What fitting the lit limb establishes, added to the record of the run that measured it. It is registration against the
 * geometry the kernels state, and nothing else: it is not agreement with an archive product, and an error the kernels and the
 * fit share would not show in it. A receipt with no record beside it is refused rather than reported as checked. */
export async function addRegistrationEvidence(receiptPath: string, repository = resolve(import.meta.dirname, '../../..')) {
  const product = basename(receiptPath);
  return addProductEvidence(productRecordPath(receiptPath), [{
    kind: 'geometric-registration', receipt: receiptPath, product,
    establishes: 'Each image\'s lit limb was fitted to the target\'s IAU ellipsoid at the geometry the kernel bank states, and the receipt gives the pointing and ' +
      'ephemeris offsets found and the limb residual on control points held out of the fit. It establishes that this repository\'s camera, trajectory and pointing ' +
      'put the image on the body to within that residual; it is not agreement with any archive product, and an error the kernels and the fit share would not show in it.',
  }], output => resolve(dirname(receiptPath), output));
}

export async function measureProgram(id: string, work: string, { raw, horizons = false }: { raw?: string; horizons?: boolean } = {}) {
  const program = await readProgram(id); await mkdir(work, { recursive: true });
  const set = await loadKernelSet(await kernelBankPaths(program.kernelSet, program.kernels)), radiiKm = numbers(set.pool, `BODY${program.target.naifId}_RADII`);
  const mesh = ellipsoidMesh(radiiKm), verticesKm = mesh.positions.map(p => [p[0]! / 1000, p[1]! / 1000, p[2]! / 1000]);
  const geometry: JunocamGeometry = { observer: JUNO, target: program.target.naifId, bodyFrame: program.target.bodyFrame, aberration: 'LT+S' };
  const images = [];
  for (const entry of program.images) {
    const directories = [work, ...(raw ? [raw] : [])], file = await pinned(entry.url, entry.bytes, entry.sha256, directories, work), label = await pinned(entry.labelUrl, entry.labelBytes, entry.labelSha256, directories, work);
    entry.sha256 = file.sha256; entry.labelSha256 = label.sha256;
    const image = decodeJunocam(file.data, label.data.toString('latin1'));
    if (image.label.productId !== entry.productId || image.label.startTime !== entry.startTime || image.label.target !== program.target.name) throw new Error(`${entry.productId} is not the product its program pins.`);
    const started = performance.now(), { report } = refineStripEpochs(refinableStrips(set, geometry, image, BANDS, verticesKm), mesh, POLICY);
    images.push({ productId: entry.productId, startTime: entry.startTime, altitudeKmInLabel: entry.altitudeKm, frames: image.label.frames, strips: report.strips, offsets: report.offsets, edgePoints: report.edgePoints,
      holdoutResidualPixels: { before: report.residuals.before.holdout.rmsPixels, after: report.residuals.after.holdout.rmsPixels, points: report.residuals.after.holdout.count }, seconds: Math.round((performance.now() - started) / 100) / 10 });
  }
  await writeProgram(program);
  const receipt = { schema: RECEIPT_SCHEMA, program: program.id, measured: new Date().toISOString().slice(0, 10), target: { ...program.target, radiiKm }, policy: POLICY,
    kernels: set.kernels.map(kernel => ({ path: program.kernels.find(path => kernel.path.endsWith(path)) ?? kernel.path, bytes: kernel.bytes, sha256: kernel.sha256 })), images,
    ...(horizons ? { horizons: await horizonsCheck(set, program) } : {}) };
  const path = resolve(PROGRAMS, `${program.id}.registration.json`);
  await writeFile(path, JSON.stringify(receipt, null, 2) + '\n');
  // The record of what this measurement read, then the measurement itself as the one kind of evidence it is.
  await writeProductRecord(productRecordPath(path), registrationRun(program, receipt.kernels, await registrationSoftware()),
    [{ path: basename(path), file: path, units: 'pixels for the residuals, seconds for the offsets',
      conventions: { frame: `${program.target.bodyFrame}, the triaxial IAU ellipsoid the text PCK states`,
        residual: 'root mean square over control points held out of the fit', offsets: 'added to the label\'s pointing and ephemeris epochs' } }]);
  await addRegistrationEvidence(path);
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), horizons = args.includes('--horizons'), raw = flagValue(args, '--raw');
  const [id, work] = positionalArguments(args, ['--raw']);
  if (!id || !work) throw new TypeError('Usage: measure.mts <program id> <work directory> [--raw <directory>] [--horizons]');
  const receipt = await measureProgram(id, resolve(work), { raw: raw ? resolve(raw) : undefined, horizons });
  for (const image of receipt.images) console.log(`${image.productId}: pointing ${(image.offsets.pointingSeconds * 1000).toFixed(1)} ms, ephemeris ${image.offsets.ephemerisSeconds.toFixed(3)} s, holdout ${image.holdoutResidualPixels.before.toFixed(2)} -> ${image.holdoutResidualPixels.after.toFixed(2)} px over ${image.holdoutResidualPixels.points} points`);
  if (receipt.horizons) console.log(`Horizons (${receipt.horizons.source}): ${receipt.horizons.differencesMeters.map(d => d.toFixed(1)).join(', ')} m`);
}
