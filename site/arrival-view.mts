import { isRecord } from '@cssearth/core';
import { validateWorldRotation } from '@cssearth/renderer/navigation/world-camera-math.ts';
import type { WorldRotation } from '@cssearth/renderer/navigation/world-camera-math.ts';

/** The package's prepared photographic viewing angle, in its presentation frame. */
export interface PreparedArrivalView { defaultLens: string; lensIds: readonly string[]; rotation: WorldRotation; }

export function parseArrivalView(value: unknown): Readonly<PreparedArrivalView> {
  if (!isRecord(value) || Object.keys(value).some(key => !['defaultLens', 'lensIds', 'rotation'].includes(key)) ||
      typeof value.defaultLens !== 'string' || !value.defaultLens || !Array.isArray(value.lensIds) ||
      !value.lensIds.length || !value.lensIds.every(id => typeof id === 'string' && id.length > 0) ||
      new Set(value.lensIds).size !== value.lensIds.length || !Array.isArray(value.rotation) ||
      !value.rotation.every(component => typeof component === 'number')) throw new TypeError('Invalid prepared arrival view.');
  validateWorldRotation(value.rotation);
  return Object.freeze({ defaultLens: value.defaultLens, lensIds: Object.freeze([...value.lensIds]),
    rotation: Object.freeze([...value.rotation]) });
}
