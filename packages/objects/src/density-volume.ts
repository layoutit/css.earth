import type { JsonRecord, ObjectDescriptor } from './descriptor.js';
import { parseObjectDescriptor } from './parse.js';

export type VolumeVector = readonly [number, number, number];
export type VolumeQuaternion = readonly [number, number, number, number];

/** A prepared right-handed local volume embedded in a common physical reference frame. */
export interface DensityVolumeFrame {
  readonly referenceFrame: string;
  readonly epochJdTt: number;
  /** Physical position of local volume coordinate [0, 0, 0], in metres. */
  readonly originM: VolumeVector;
  /** Right-handed local-volume orientation into the shared physical reference frame. */
  readonly localToReferenceXyzw: VolumeQuaternion;
  readonly metersPerUnit: number;
  readonly boundsUnits: { readonly min: VolumeVector; readonly max: VolumeVector };
}

export interface DensityVolumePreparationReference {
  readonly source: string;
}

export interface DensityVolumeObjectDescriptor extends ObjectDescriptor {
  readonly type: 'density-volume';
  readonly volume: DensityVolumeFrame;
  readonly preparation: DensityVolumePreparationReference;
}

/** Parses a reusable density-volume descriptor without assigning a renderer or source implementation. */
export function parseDensityVolumeObjectDescriptor(value: unknown): DensityVolumeObjectDescriptor {
  const descriptor = parseObjectDescriptor(value);
  if (descriptor.type !== 'density-volume') throw new TypeError('Object descriptor is not a density-volume.');
  const properties = record(descriptor.properties, 'object.properties');
  keys(properties, ['volume', 'preparation'], 'object.properties');
  return Object.freeze({ ...descriptor, type: 'density-volume' as const,
    volume: parseDensityVolumeFrame(properties.volume), preparation: parsePreparation(properties.preparation) });
}

/** Parses only the reusable physical frame for prepared-payload adapters. */
export function parseDensityVolumeFrame(value: unknown): DensityVolumeFrame {
  const input = record(value, 'object.properties.volume');
  keys(input, ['referenceFrame', 'epochJdTt', 'originM', 'localToReferenceXyzw', 'metersPerUnit', 'boundsUnits'], 'object.properties.volume');
  if (typeof input.referenceFrame !== 'string' || !input.referenceFrame) throw new TypeError('Volume reference frame must be a name.');
  const originM = vector(input.originM, 'Volume origin');
  const localToReferenceXyzw = quaternion(input.localToReferenceXyzw, 'Volume local rotation');
  if (typeof input.epochJdTt !== 'number' || !Number.isFinite(input.epochJdTt)) throw new TypeError('Volume epoch must be finite.');
  if (typeof input.metersPerUnit !== 'number' || !Number.isFinite(input.metersPerUnit) || input.metersPerUnit <= 0) {
    throw new TypeError('Volume metres per unit must be positive.');
  }
  const bounds = record(input.boundsUnits, 'Volume bounds');
  keys(bounds, ['min', 'max'], 'Volume bounds');
  const min = vector(bounds.min, 'Volume minimum bound'), max = vector(bounds.max, 'Volume maximum bound');
  for (let axis = 0; axis < 3; axis++) if (!(min[axis]! < max[axis]!)) throw new TypeError('Volume bounds must have positive extent.');
  return Object.freeze({ referenceFrame: input.referenceFrame, epochJdTt: input.epochJdTt,
    originM, localToReferenceXyzw, metersPerUnit: input.metersPerUnit,
    boundsUnits: Object.freeze({ min, max }) });
}

function parsePreparation(value: unknown): DensityVolumePreparationReference {
  const input = record(value, 'object.properties.preparation');
  keys(input, ['source'], 'object.properties.preparation');
  if (typeof input.source !== 'string' || !input.source || input.source.startsWith('/') || input.source.split('/').includes('..') || /[\\\u0000-\u0020]/.test(input.source)) {
    throw new TypeError('Volume preparation source must be a relative path.');
  }
  return Object.freeze({ source: input.source });
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object.`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], name: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`${name}.${key} is not supported.`);
}
function vector(value: unknown, name: string): VolumeVector {
  if (!Array.isArray(value) || value.length !== 3 || value.some(component => typeof component !== 'number' || !Number.isFinite(component))) {
    throw new TypeError(`${name} must contain three finite numbers.`);
  }
  return Object.freeze([value[0]!, value[1]!, value[2]!] as const);
}
function quaternion(value: unknown, name: string): VolumeQuaternion {
  if (!Array.isArray(value) || value.length !== 4 || value.some(component => typeof component !== 'number' || !Number.isFinite(component)) ||
      Math.abs(Math.hypot(value[0]!, value[1]!, value[2]!, value[3]!) - 1) > 1e-9) throw new TypeError(`${name} must be a unit quaternion.`);
  return Object.freeze([value[0]!, value[1]!, value[2]!, value[3]!] as const);
}
