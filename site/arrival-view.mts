import { isRecord } from '@cssearth/core';
import { validateWorldRotation } from '@cssearth/renderer/navigation/world-camera-math.ts';
import type { WorldRotation } from '@cssearth/renderer/navigation/world-camera-math.ts';

/** The package's prepared arrival image and viewing angle, in its presentation frame. */
export interface PreparedArrivalBillboard { url: string; size: number; focalPixels: number; distanceM: number; lens: string; rotation: WorldRotation; }
export interface PreparedArrivalView { defaultLens: string; lensIds: readonly string[]; rotation: WorldRotation; billboard?: Readonly<PreparedArrivalBillboard>; }

export function parseArrivalBillboard(value: unknown): Readonly<PreparedArrivalBillboard> {
  if (!isRecord(value) || Object.keys(value).some(key => !['url', 'size', 'focalPixels', 'distanceM', 'lens', 'rotation'].includes(key)) ||
      typeof value.lens !== 'string' || !value.lens || !Array.isArray(value.rotation) ||
      !value.rotation.every(component => typeof component === 'number') ||
      typeof value.url !== 'string' || !/^(?:\/scenes\/[a-z0-9-]+\/|https:\/\/)[^\s]+\.webp(?:\?[^\s]*)?$/u.test(value.url) ||
      typeof value.size !== 'number' || !Number.isInteger(value.size) || value.size < 64 || value.size > 2048 ||
      typeof value.focalPixels !== 'number' || !Number.isFinite(value.focalPixels) || value.focalPixels <= 0 ||
      typeof value.distanceM !== 'number' || !Number.isFinite(value.distanceM) || value.distanceM <= 0)
    throw new TypeError('Invalid prepared arrival billboard.');
  validateWorldRotation(value.rotation);
  return Object.freeze({ url: value.url, size: value.size, focalPixels: value.focalPixels, distanceM: value.distanceM,
    lens: value.lens, rotation: Object.freeze([...value.rotation]) });
}

export function parseArrivalView(value: unknown): Readonly<PreparedArrivalView> {
  if (!isRecord(value) || Object.keys(value).some(key => !['defaultLens', 'lensIds', 'rotation', 'billboard'].includes(key)) ||
      typeof value.defaultLens !== 'string' || !value.defaultLens || !Array.isArray(value.lensIds) ||
      !value.lensIds.length || !value.lensIds.every(id => typeof id === 'string' && id.length > 0) ||
      new Set(value.lensIds).size !== value.lensIds.length || !Array.isArray(value.rotation) ||
      !value.rotation.every(component => typeof component === 'number')) throw new TypeError('Invalid prepared arrival view.');
  validateWorldRotation(value.rotation);
  const billboard = value.billboard === undefined ? undefined : parseArrivalBillboard(value.billboard);
  const rotation = value.rotation;
  if (billboard && (billboard.lens !== value.defaultLens ||
      billboard.rotation.some((component, index) => Math.abs(component - Number(rotation[index])) > 1e-8)))
    throw new TypeError('Reprepare the arrival billboard for the current lens and camera.');
  return Object.freeze({ defaultLens: value.defaultLens, lensIds: Object.freeze([...value.lensIds]),
    rotation: Object.freeze([...value.rotation]),
    ...(billboard ? { billboard } : {}) });
}
