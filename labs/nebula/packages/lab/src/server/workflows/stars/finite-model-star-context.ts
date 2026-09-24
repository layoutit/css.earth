/** Offline, verified sampling context of one saved simulation-guided finite emission model for catalogue star depths. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { ObservationMapping } from '@cssearth/volume-core/contracts/observation-mapping';
import type { Bounds3, Vector3 } from '@cssearth/volume-core/contracts/volume-recipe';
import type { EmissionFieldModel } from '@cssearth/volume-core/contracts/emission';
import { createEmissionField } from '@cssearth/volume-core/fields/emission';
import { createIntegratedSignalSampler } from '@cssearth/volume-core/fields/cloud-density';
import { createEnvelopeSampler, validateEnvelopeSettings } from '@cssearth/nebula-reconstruction/methods/inference/simulation-envelope';
import { sha256 } from '@cssearth/core/node';
import { parseLabModelJson } from '../../../resources/model-paths.ts';
import { verifyFiniteMaterialArtifacts } from '../../../cli/commands/finite-density-material-artifacts.ts';
import { physicalToField, angularScale } from '../../../cli/commands/simulation-guided-coordinates.ts';
import { loadSimulationPrior } from '../../../cli/commands/simulation-prior.ts';

export const finiteModelDirectory = (resultId: string) => `.local/nebula-lab/reconstructions/${resultId}`;
const KPC_M = 3.085677581491367e19;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function vector(value: unknown, length: number, label: string): number[] {
  if (!Array.isArray(value) || value.length !== length || !value.every(finite)) throw new TypeError(`Invalid ${label}.`);
  return value;
}
function bounds2(value: unknown, label: string) {
  if (!record(value)) throw new TypeError(`Invalid ${label}.`);
  const min = vector(value.min, 2, label), max = vector(value.max, 2, label);
  if (!(min[0]! < max[0]!) || !(min[1]! < max[1]!)) throw new TypeError(`Invalid ${label}.`);
  return { min: [min[0]!, min[1]!] as [number, number], max: [max[0]!, max[1]!] as [number, number] };
}

/** Linear tangent-plane mapping of a fitted model grid: top-left UV, +y up, perspective (1+z/D) transverse scale. */
export function tangentGridMapping(bounds: { min: [number, number]; max: [number, number] }, distanceUnits: number): ObservationMapping {
  if (!(distanceUnits > 0) || !Number.isFinite(distanceUnits)) throw new TypeError('Tangent mapping needs a finite observer distance.');
  const [x0, y0] = bounds.min, [x1, y1] = bounds.max;
  const factor = (z: number) => {
    const value = 1 + z / distanceUnits;
    if (!Number.isFinite(value) || value <= 0) throw new TypeError('Observation depth is at or behind the observer.');
    return value;
  };
  return { distanceUnits, boundsUnits: { min: [x0, y0], max: [x1, y1] },
    tangentAtUv: (u, v) => [x0 + u * (x1 - x0), y1 - v * (y1 - y0)],
    uvAtTangent(x, y) {
      const u = (x - x0) / (x1 - x0), v = (y1 - y) / (y1 - y0);
      return [u, v].every(value => Number.isFinite(value) && value >= 0 && value <= 1) ? [u, v] : null;
    },
    pointAtDepth(x, y, z) { const scale = factor(z); return [x * scale, y * scale, z]; },
    tangentAtPoint(x, y, z) { const scale = factor(z); return [x / scale, y / scale]; },
    rayPathPerDepth: (x, y) => Math.hypot(1, x / distanceUnits, y / distanceUnits),
  };
}

export interface FiniteModelStarContext {
  modelResultId: string; frame: DensityVolumeFrame; mapping: ObservationMapping; supportBounds: Bounds3;
  /** Emission at a TANGENT ray coordinate and depth, exactly as the model bake samples physical space; zero outside the baked box. */
  sampleEmission(x0: number, y0: number, z: number, out: Vector3): void;
  /** Decoded pinned simulation density at a physical point. */
  densityAt(x: number, y: number, z: number): number;
  /** The fit's own image coverage (alpha and authored exclusions) at a tangent ray. */
  inFootprint(x0: number, y0: number): boolean;
  /** Normalized integrated signal used by the lab cutoff tool for this model. */
  sampleSignal(x: number, y: number, z: number): number;
  partIds: string[];
  provenance: Record<string, unknown>;
}

export async function loadFiniteModelStarContext(root: string, modelResultId: string): Promise<FiniteModelStarContext> {
  if (!/^[a-f0-9]{64}$/.test(modelResultId)) throw new TypeError('Finite model identity must be a result hash.');
  const directory = finiteModelDirectory(modelResultId), full = resolve(root, directory);
  // Every file read below is covered by the model's own artifact manifest; mismatches throw here.
  await verifyFiniteMaterialArtifacts(full, `reconstruction-${modelResultId}`);
  const manifest: unknown = parseLabModelJson(await readFile(resolve(full, 'manifest.json'), 'utf8'));
  const artifacts = record(manifest) && record(manifest.artifacts) ? manifest.artifacts : null;
  const read = async (path: string) => {
    const pin = artifacts?.[path];
    if (!record(pin) || typeof pin.sha256 !== 'string') throw new TypeError(`Finite model artifact is not pinned: ${path}`);
    const bytes = await readFile(resolve(full, path));
    if (sha256(bytes) !== pin.sha256) throw new TypeError(`Finite model artifact changed: ${path}`);
    return { bytes, pin: { path: `${directory}/${path}`, sha256: pin.sha256 } };
  };
  const provenanceFile = await read('source/provenance.json');
  const provenance: unknown = parseLabModelJson(provenanceFile.bytes.toString());
  if (!record(provenance) || provenance.method !== 'simulation-guided-finite-emission@1' || !record(provenance.request) ||
      !record(provenance.geometry) || !record(provenance.material) || !record(provenance.densityProjection))
    throw new TypeError('Expected a simulation-guided finite emission model.');
  const request = provenance.request, geometry = provenance.geometry;
  if (!record(request.frame) || !record(request.cloud)) throw new TypeError('Finite model request has no frame or simulation source.');
  const frame = request.frame as unknown as DensityVolumeFrame;
  vector(frame.originM, 3, 'frame origin'); vector(frame.localToReferenceXyzw, 4, 'frame orientation');
  if (!finite(frame.metersPerUnit) || Math.abs(frame.metersPerUnit / KPC_M - 1) > 1e-12)
    throw new TypeError('Finite model stars require kpc frame units.');
  const distance = geometry.observerDistanceKpc;
  if (!finite(distance) || Math.abs(Math.hypot(...frame.originM) / frame.metersPerUnit - distance) > 1e-9 * distance)
    throw new TypeError('Observer distance differs from the model frame.');
  const tangentBounds = bounds2(geometry.tangentBoundsKpc, 'tangent bounds');
  if (!record(geometry.physicalBoundsKpc)) throw new TypeError('Missing baked physical bounds.');
  const physical: Bounds3 = { min: vector(geometry.physicalBoundsKpc.min, 3, 'physical bounds') as Vector3,
    max: vector(geometry.physicalBoundsKpc.max, 3, 'physical bounds') as Vector3 };
  if (JSON.stringify(physical) !== JSON.stringify(frame.boundsUnits)) throw new TypeError('Baked bounds differ from the model frame.');

  const fieldFile = await read('source/emission-field.json');
  const field = createEmissionField(parseLabModelJson(fieldFile.bytes.toString()) as EmissionFieldModel);
  const envelopeRecord = provenance.envelope === null || provenance.envelope === undefined ? null : await read('source/envelope.json');
  const envelopeValue: unknown = envelopeRecord ? parseLabModelJson(envelopeRecord.bytes.toString()) : null;
  if (envelopeRecord && (!record(envelopeValue) || envelopeValue.schema !== 'cssearth-simulation-envelope@1' ||
      !Number.isInteger(envelopeValue.width) || !Number.isInteger(envelopeValue.height) || !Array.isArray(envelopeValue.gain) ||
      envelopeValue.gain.length !== Number(envelopeValue.width) * Number(envelopeValue.height) ||
      !envelopeValue.gain.every(v => finite(v) && v >= 0) || !record(envelopeValue.bounds))) throw new TypeError('Invalid simulation envelope record.');
  // The depth density is the one this model's envelope was fitted with, not the baseline request's cloud: a re-fit
  // may carry the envelope on a different volume (the VMC-constrained ellipsoid). Older records pin no cloud of their own.
  const envelopeCloud = record(envelopeValue) && envelopeValue.priorCloud !== undefined && envelopeValue.priorCloud !== null ? envelopeValue.priorCloud : null;
  const densityPin = envelopeCloud ?? request.cloud.provenance;
  const prior = await loadSimulationPrior(root, densityPin, distance, tangentBounds);
  let envelopeAt: ((x: number, y: number, z: number) => number) | null = null, envelopePin: { path: string; sha256: string } | null = null;
  if (envelopeRecord && record(envelopeValue)) {
    validateEnvelopeSettings(envelopeValue.settings);
    if (prior.identity !== envelopeValue.priorIdentity) throw new TypeError('Depth density differs from the prior this envelope was fitted with.');
    const zRange = vector(envelopeValue.zRange, 2, 'envelope depth range');
    envelopeAt = createEnvelopeSampler({ width: Number(envelopeValue.width), height: Number(envelopeValue.height), bounds: bounds2(envelopeValue.bounds, 'envelope bounds'),
      zRange: [zRange[0]!, zRange[1]!], gain: Float32Array.from(envelopeValue.gain as number[]) }, prior);
    envelopePin = envelopeRecord.pin;
  }
  const A = angularScale(distance);
  const inside = (p: readonly number[]) => p.every((v, a) => v >= physical.min[a]! && v <= physical.max[a]!);
  const mapping = tangentGridMapping(tangentBounds, distance);
  // Identical to the bake: physical -> field, components + envelope, times the arcsec-per-kpc path factor.
  const sampleEmission = (x0: number, y0: number, z: number, out: Vector3) => {
    const point = mapping.pointAtDepth(x0, y0, z);
    if (!inside(point)) { out.fill(0); return; }
    const p = physicalToField(point, distance);
    field.sampleEmission(p[0], p[1], p[2], out);
    const e = envelopeAt ? envelopeAt(p[0], p[1], p[2]) : 0;
    for (let c = 0; c < 3; c++) out[c] = (out[c]! + e) * A;
  };
  const densityAt = (x: number, y: number, z: number) => { const p = physicalToField([x, y, z], distance); return prior.sampleDensity(p[0], p[1], p[2]); };

  // The fit's coverage mask: same resize of the same pinned registered original, alpha >= 250 and not authored-excluded.
  const settings = provenance.material.settings;
  if (!record(settings) || !Number.isInteger(settings.width) || !Array.isArray(settings.exclusions)) throw new TypeError('Missing fit coverage settings.');
  const exclusions = settings.exclusions.map(e => {
    if (!record(e) || ![e.x, e.y, e.rx, e.ry].every(finite) || !(Number(e.rx) > 0) || !(Number(e.ry) > 0)) throw new TypeError('Invalid fit exclusion.');
    return { x: Number(e.x), y: Number(e.y), rx: Number(e.rx), ry: Number(e.ry) };
  });
  const width = Number(settings.width);
  const arc = { min: tangentBounds.min.map(v => v * A), max: tangentBounds.max.map(v => v * A) };
  const height = Math.round(width * (arc.max[1]! - arc.min[1]!) / (arc.max[0]! - arc.min[0]!));
  const originalFile = await read('source/original-image.png');
  const alpha = await sharp(originalFile.bytes).resize(width, height, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const inFootprint = (x0: number, y0: number) => {
    const uv = mapping.uvAtTangent(x0, y0);
    if (!uv) return false;
    const column = Math.min(width - 1, Math.floor(uv[0] * width)), row = Math.min(height - 1, Math.floor(uv[1] * height));
    const x = (column + .5) / width, y = (row + .5) / height;
    return alpha[(row * width + column) * 4 + 3]! >= 250 && !exclusions.some(e => ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 <= 1);
  };

  // Cutoff signal: identical luminance, normalization and geometry to density-material.ts for reconstruction results.
  const signalFile = await read('source/aligned-image.png');
  const target = await sharp(signalFile.bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const projection = provenance.densityProjection;
  if (target.info.width !== projection.width || target.info.height !== projection.height || target.info.channels !== 3 ||
      projection.observerDistanceKpc !== distance) throw new TypeError('Model cutoff signal dimensions differ.');
  const signal = new Float32Array(target.info.width * target.info.height);
  for (let i = 0; i < signal.length; i++) signal[i] = (target.data[3 * i]! * .2126 + target.data[3 * i + 1]! * .7152 + target.data[3 * i + 2]! * .0722) / 255;
  const sampleSignal = createIntegratedSignalSampler({ values: signal, width: target.info.width, height: target.info.height,
    bounds: bounds2(projection.tangentBoundsKpc, 'signal bounds'), observerDistance: distance });

  const partsFile = await read('source/cloud-parts.json'), parts: unknown = parseLabModelJson(partsFile.bytes.toString());
  if (!record(parts) || !Array.isArray(parts.parts) || !parts.parts.length) throw new TypeError('Invalid model cloud parts.');
  const partIds = parts.parts.map(part => { if (!record(part) || typeof part.id !== 'string' || !part.id) throw new TypeError('Invalid cloud part.'); return part.id; }).sort();
  if (!record(request.cloud.provenance)) throw new TypeError('Missing simulation pin.');
  return { modelResultId, frame, mapping, supportBounds: physical, sampleEmission, densityAt, inFootprint, sampleSignal, partIds,
    provenance: { modelResultId, directory, provenance: provenanceFile.pin, emissionField: fieldFile.pin, envelope: envelopePin,
      depthDensity: densityPin, depthDensityIdentity: prior.identity,
      depthDensitySource: envelopeCloud ? 'The cloud pinned by this model\'s own envelope record.' : 'The model request\'s pinned cloud; this envelope record pins none of its own.', footprint: { image: originalFile.pin, width, height, alphaThreshold: 250, exclusions },
      cutoffSignal: signalFile.pin, cloudParts: partsFile.pin, observerDistanceKpc: distance, tangentBoundsKpc: tangentBounds, physicalBoundsKpc: physical } };
}
