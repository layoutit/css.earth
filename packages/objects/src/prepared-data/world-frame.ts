import { validateWorldReflection, type WorldRotation } from '../registry/world-rotation.js';
import { finite, numbers, positive, record, text } from './world-guards.js';

export type WorldPosition = readonly [number, number, number];
/** Prepared/resolved frame facts. No ephemeris or body geometry is derived here. */
export interface PreparedWorldCameraFrame {
  readonly referenceFrame: string;
  readonly epochJdTt: number;
  readonly originM: WorldPosition;
  /** CSS presentation directions to reference directions: a reflection, since CSS 3D space is left-handed. */
  readonly presentationToReference: WorldRotation;
  readonly metersPerUnit: number;
  readonly bodyRadiusM: number;
  readonly orbitUpReference?: WorldPosition;
}


export function parsePreparedWorldCameraFrame(input: unknown): PreparedWorldCameraFrame | null {
  if (input === undefined || input === null) return null;
  const value = record(input, 'world frame', ['referenceFrame', 'epochJdTt', 'originM',
    'presentationToReference', 'metersPerUnit', 'bodyRadiusM', 'orbitUpReference']);
  const origin = numbers(value.originM, 'world origin', 3);
  const rotation = numbers(value.presentationToReference, 'world rotation', 9);
  const result: PreparedWorldCameraFrame = {
    referenceFrame: text(value.referenceFrame, 'reference frame'),
    epochJdTt: finite(value.epochJdTt, 'prepared epoch'),
    originM: Object.freeze([origin[0], origin[1], origin[2]]),
    presentationToReference: Object.freeze([rotation[0], rotation[1], rotation[2], rotation[3], rotation[4], rotation[5], rotation[6], rotation[7], rotation[8]]),
    metersPerUnit: positive(value.metersPerUnit, 'metres per unit'),
    bodyRadiusM: positive(value.bodyRadiusM, 'body radius'),
  };
  validateWorldReflection(result.presentationToReference);
  if (value.orbitUpReference !== undefined) {
    const up = numbers(value.orbitUpReference, 'orbit up', 3);
    if (Math.abs(Math.hypot(...up) - 1) > 1e-9) throw new TypeError('Orbit up must be a unit vector.');
    return Object.freeze({ ...result, orbitUpReference: Object.freeze([up[0], up[1], up[2]] as const) });
  }
  return Object.freeze(result);
}
