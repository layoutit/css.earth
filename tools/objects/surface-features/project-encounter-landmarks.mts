import { sha256 } from '@cssearth/core/node';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeEncounterFits } from '../terrestrial-layers/encounter-fits.mts';
import { encounterCamera } from '../terrestrial-layers/encounter-camera.mts';
import { validateEncounterControls } from '../terrestrial-layers/encounter-controls.mts';
import { loadPdsPlateShape } from '../terrestrial-layers/obj-shape.mts';
import { fitImageControls } from './image-controls.mts';
import type { ImageControlsFit } from './image-controls.mts';

type Pixel = readonly [number, number];
type Vec = readonly [number, number, number];
type RecordValue = Record<string, unknown>;

const root = process.cwd();
const record = (value: unknown, at: string): RecordValue => { if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${at} must be an object.`); return value as RecordValue; };
const text = (value: unknown, at: string): string => { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${at} must be text.`); return value; };
const finite = (value: unknown, at: string): number => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${at} must be finite.`); return value; };
const positive = (value: unknown, at: string): number => { const result = finite(value, at); if (!(result > 0)) throw new TypeError(`${at} must be positive.`); return result; };
const pixel = (value: unknown, at: string): Pixel => { if (!Array.isArray(value) || value.length !== 2) throw new TypeError(`${at} must have two components.`); return [finite(value[0], `${at}[0]`), finite(value[1], `${at}[1]`)]; };

const safePath = (base: string, path: unknown, at: string) => {
  const candidate = text(path, at);
  if (candidate.startsWith('/') || candidate.includes('\\') || candidate.split('/').some(part => !part || part === '..')) throw new TypeError(`${at} must stay inside the object source tree.`);
  const absolute = resolve(base, candidate), rel = relative(base, absolute);
  if (rel === '' || rel.startsWith(`..${sep}`) || rel === '..') throw new TypeError(`${at} must stay inside the object source tree.`);
  return absolute;
};
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

interface Input { readonly id: string; readonly path: string; readonly bytes: number; readonly sha256: string; readonly absolute: string; }
interface Entry { readonly id: string; readonly name: string; readonly kind: 'point' | 'region'; readonly type: string; readonly pixel: Pixel; readonly minimumZoomShare: number; readonly description: string; readonly qualification: string; readonly reference: RecordValue; readonly maximumDisplayDistanceMeters: number; readonly maximumSensitivityMeters: number; }
interface Configuration { readonly source: string; readonly frame: string; readonly inputs: readonly Input[]; readonly nativeImageId: string; readonly cameraControlId: string; readonly shapeId: string; readonly shapeProfile: RecordValue; readonly stages: readonly unknown[]; readonly entries: readonly Entry[]; }
export interface EncounterLandmarkCamera { readonly positionMeters: readonly number[]; ray(x: number, y: number): readonly number[]; }
export interface EncounterLandmarkShape { readonly faceProvenance?: ArrayLike<number>; intersect(origin: readonly number[], ray: readonly number[]): { readonly radius: number; readonly faceId: number } | null; closestPoint(point: readonly number[], maximumDistanceMeters: number): { readonly normal: readonly number[] } | null; }

export function transformImageControlStages(stages: readonly ImageControlsFit[], point: Pixel): Pixel {
  return stages.reduce((current, stage) => stage.transform(current), point);
}

function parseConfiguration(value: unknown, sourceDirectory: string): Configuration {
  const config = record(value, 'encounter landmark configuration');
  if (config.schema !== 'cssearth-encounter-landmarks@1') throw new TypeError('Unsupported encounter-landmarks schema.');
  if (!Array.isArray(config.inputs) || !config.inputs.length) throw new TypeError('Encounter landmarks need pinned inputs.');
  const ids = new Set<string>();
  const inputs = config.inputs.map((value, index): Input => {
    const input = record(value, `encounter landmark input ${index}`), id = text(input.id, 'encounter landmark input id');
    if (ids.has(id)) throw new TypeError('Encounter landmark input ids must be distinct.');
    ids.add(id);
    const bytes = finite(input.bytes, `encounter landmark input ${id} bytes`);
    if (!Number.isSafeInteger(bytes) || bytes < 1) throw new TypeError('Encounter landmark input bytes must be a positive integer.');
    const digest = text(input.sha256, `encounter landmark input ${id} SHA-256`);
    if (!/^[a-f0-9]{64}$/u.test(digest)) throw new TypeError('Encounter landmark input SHA-256 must be lowercase hexadecimal.');
    return { id, path: text(input.path, `encounter landmark input ${id} path`), bytes, sha256: digest, absolute: safePath(sourceDirectory, input.path, `encounter landmark input ${id} path`) };
  });
  const inputId = (value: unknown, at: string) => { const id = text(value, at); if (!ids.has(id)) throw new TypeError(`${at} must identify a pinned input.`); return id; };
  if (!Array.isArray(config.stages) || !config.stages.length) throw new TypeError('Encounter landmarks need one or more image-control stages.');
  const entriesInput = config.entries;
  if (!Array.isArray(entriesInput) || !entriesInput.length) throw new TypeError('Encounter landmarks need entries.');
  const entryIds = new Set<string>();
  const entries = entriesInput.map((value, index): Entry => {
    const entry = record(value, `encounter landmark entry ${index}`), id = text(entry.id, 'encounter landmark id');
    if (entryIds.has(id) || !/^8\d{7}$/u.test(id)) throw new TypeError('Encounter landmark ids must be distinct 80000000–89999999 values.');
    entryIds.add(id);
    const kind = entry.kind;
    if (kind !== 'point' && kind !== 'region') throw new TypeError('Encounter landmark kind must be point or region.');
    const zoom = finite(entry.minimumZoomShare, `encounter landmark ${id} zoom`);
    if (zoom < 0 || zoom > 1) throw new TypeError('Encounter landmark zoom must be between zero and one.');
    const description = text(entry.description, `encounter landmark ${id} description`), qualification = text(entry.qualification, `encounter landmark ${id} qualification`);
    if (`${description} ${qualification}`.length > 400) throw new TypeError('Encounter landmark caption exceeds the shared 400-character limit.');
    assertReference(record(entry.reference, `encounter landmark ${id} reference`));
    return { id, name: text(entry.name, `encounter landmark ${id} name`), kind, type: text(entry.type, `encounter landmark ${id} type`), pixel: pixel(entry.pixel, `encounter landmark ${id} pixel`), minimumZoomShare: zoom,
      description, qualification, reference: record(entry.reference, `encounter landmark ${id} reference`),
      maximumDisplayDistanceMeters: positive(entry.maximumDisplayDistanceMeters, `encounter landmark ${id} display distance`), maximumSensitivityMeters: positive(entry.maximumSensitivityMeters, `encounter landmark ${id} sensitivity`) };
  });
  return { source: text(config.source, 'encounter landmark source'), frame: text(config.frame, 'encounter landmark frame'), inputs,
    nativeImageId: inputId(config.nativeImageId, 'native image id'), cameraControlId: inputId(config.cameraControlId, 'camera control id'), shapeId: inputId(config.shapeId, 'shape id'),
    shapeProfile: record(config.shapeProfile, 'encounter landmark shape profile'), stages: config.stages, entries };
}

async function checkedInputs(configuration: Configuration) {
  const values = new Map<string, Buffer>();
  for (const input of configuration.inputs) {
    const bytes = await readFile(input.absolute);
    if (bytes.length !== input.bytes || sha256(bytes) !== input.sha256) throw new TypeError(`Pinned encounter landmark input changed: ${input.id}.`);
    values.set(input.id, bytes);
  }
  return values;
}

function assertReference(value: RecordValue) {
  const title = text(value.title, 'landmark reference title'), url = text(value.url, 'landmark reference URL'), credit = text(value.credit, 'landmark reference credit');
  if (!/^https:\/\//u.test(url)) throw new TypeError('Landmark reference URL must use HTTPS.');
  return { title, url, credit };
}

function emissionDegrees(ray: readonly number[], normal: readonly number[]) {
  const cosine = Math.max(-1, Math.min(1, -ray.reduce((sum, value, index) => sum + value * normal[index]!, 0)));
  return Math.acos(cosine) * 180 / Math.PI;
}

/** First-hit source-mesh anchoring. The surrounding samples diagnose how the
 * registered image pixel maps across local relief; they are not an uncertainty
 * distribution. */
export function evaluateEncounterAnchor(camera: EncounterLandmarkCamera, shape: EncounterLandmarkShape, nativePixel: Pixel, maximumSensitivityMeters: number) {
  const hitAt = (point: Pixel) => {
    const ray = camera.ray(point[0], point[1]), hit = shape.intersect(camera.positionMeters, ray);
    if (!hit) throw new TypeError('Encounter-landmark pixel has no source-mesh ray hit.');
    if (!ray.every(Number.isFinite) || ray.length !== 3) throw new TypeError('Encounter-landmark camera returned an invalid ray.');
    const pointMeters: Vec = [0, 1, 2].map(index => ray[index]! * hit.radius + camera.positionMeters[index]!) as unknown as Vec;
    const closest = shape.closestPoint(pointMeters, .001);
    if (!closest) throw new TypeError('Encounter-landmark ray hit has no source surface normal.');
    const flag = shape.faceProvenance?.[hit.faceId];
    if (flag !== 0) throw new TypeError(`Encounter-landmark ray hit is not observed terrain (face ${hit.faceId}, flag ${String(flag)}).`);
    const emission = emissionDegrees(ray, closest.normal);
    if (emission > 75) throw new TypeError(`Encounter-landmark ray hit exceeds 75 degree emission (${emission}).`);
    return { pointMeters, sourceFace: hit.faceId, emissionDegrees: emission };
  };
  const hit = hitAt(nativePixel);
  const displacements = Array.from({ length: 16 }, (_, index) => {
    const angle = index / 16 * Math.PI * 2, perturbed: Pixel = [nativePixel[0] + 15 * Math.cos(angle), nativePixel[1] + 15 * Math.sin(angle)];
    const candidate = hitAt(perturbed);
    return Math.hypot(...candidate.pointMeters.map((value, axis) => value - hit.pointMeters[axis]!));
  });
  const sensitivity = Math.max(...displacements);
  if (sensitivity > maximumSensitivityMeters) throw new TypeError(`Encounter-landmark sensitivity ${sensitivity} exceeds ${maximumSensitivityMeters} metres.`);
  return { ...hit, sensitivity };
}

export async function commitEncounterLandmarkOutputs(outputs: readonly { readonly path: string; readonly content: string }[], write: boolean) {
  for (const output of outputs) {
    if (write) { await mkdir(resolve(output.path, '..'), { recursive: true }); await writeFile(output.path, output.content); }
    else {
      let existing: string;
      try { existing = await readFile(output.path, 'utf8'); }
      catch (cause) { throw new TypeError(`Regenerated encounter landmarks are missing: ${relative(root, output.path)}. Run with --write after reviewing the evidence.`, { cause }); }
      if (existing !== output.content) throw new TypeError(`Regenerated encounter landmarks differ: ${relative(root, output.path)}. Run with --write after reviewing the evidence.`);
    }
  }
}

export async function projectEncounterLandmarks(objectId: string, write = false) {
  if (!/^[a-z0-9-]+$/u.test(objectId)) throw new TypeError('Object id must be lowercase letters, digits and hyphens.');
  const sourceDirectory = resolve(root, 'src/objects', objectId, 'source');
  const configuration = parseConfiguration(JSON.parse(await readFile(resolve(sourceDirectory, 'features/image-registration.json'), 'utf8')), sourceDirectory);
  const inputs = await checkedInputs(configuration), get = (id: string) => { const value = inputs.get(id); if (!value) throw new TypeError(`Missing checked input ${id}.`); return value; };
  const cameraControl = record(JSON.parse(get(configuration.cameraControlId).toString('utf8')), 'encounter camera control');
  const decoded = decodeEncounterFits(get(configuration.nativeImageId), cameraControl.observation);
  const camera = encounterCamera(decoded.header, cameraControl.camera);
  const shapeBytes = get(configuration.shapeId), registration = validateEncounterControls(camera, cameraControl.registration);
  const shapeInput = configuration.inputs.find(input => input.id === configuration.shapeId)!;
  const shape = await loadPdsPlateShape(shapeInput.absolute, configuration.shapeProfile);
  const stageFits = configuration.stages.map((stage, index) => {
    try { return fitImageControls(stage); } catch (cause) { throw new TypeError(`Image-control stage ${index} is invalid.`, { cause }); }
  });
  const anchors = configuration.entries.map(entry => {
    const nativePixel = transformImageControlStages(stageFits, entry.pixel);
    return { entry, nativePixel, ...evaluateEncounterAnchor(camera, shape, nativePixel, entry.maximumSensitivityMeters) };
  });
  const landmarks = { schema: 'cssearth-surface-landmarks@1', source: configuration.source, frame: configuration.frame,
    entries: anchors.map(({ entry, pointMeters }) => ({ id: entry.id, name: entry.name, kind: entry.kind, type: entry.type, position: { pointMeters, maximumDistanceMeters: entry.maximumDisplayDistanceMeters }, minimumZoomShare: entry.minimumZoomShare,
      description: entry.description, qualification: entry.qualification, reference: assertReference(entry.reference) })) };
  const evidence = { schema: 'cssearth-encounter-landmark-evidence@1', objectId, source: configuration.source, frame: configuration.frame,
    inputs: configuration.inputs.map(({ id, path, bytes, sha256 }) => ({ id, path, bytes, sha256 })), registration,
    stages: stageFits.map((stage, index) => ({ index, model: stage.model, coefficients: stage.coefficients, stats: stage.stats, residuals: stage.residuals,
      acceptance: { thresholdPartitions: ['fit', 'holdout'], metrics: 'Both fit and holdout RMS and maximum residuals must satisfy the configured thresholds.' } })),
    anchors: anchors.map(({ entry, nativePixel, pointMeters, sourceFace, emissionDegrees, sensitivity }) => ({ id: entry.id, name: entry.name, sourcePixel: entry.pixel, nativePixel, pointMeters, sourceFace, emissionDegrees, sensitivityMeters: sensitivity,
      sensitivitySample: { directions: 16, nativePixelRadius: 15, interpretation: 'Sampled ray-placement sensitivity diagnostic; not a statistical uncertainty.' } })) };
  const outputs = [{ path: resolve(sourceDirectory, 'features/landmarks.json'), content: json(landmarks) }, { path: resolve(sourceDirectory, 'features/evidence/image-landmarks.json'), content: json(evidence) }];
  await commitEncounterLandmarkOutputs(outputs, write);
  return { landmarks, evidence };
}

const [objectId, ...arguments_] = process.argv.slice(2);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!objectId || arguments_.some(argument => argument !== '--write')) throw new Error('Usage: project-encounter-landmarks.mts <objectId> [--write]');
  await projectEncounterLandmarks(objectId, arguments_.includes('--write'));
}
