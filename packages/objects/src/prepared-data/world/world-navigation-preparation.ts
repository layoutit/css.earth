import type { PreparedWorldCameraFrame } from './world-frame.js';
import type { WorldRotation } from '@cssearth/core';

export const WORLD_NAVIGATION_PREPARATION_SCHEMA = 'cssearth-world-navigation-preparation@1';
interface WorldNavigationReceiptBase {
  readonly schema: typeof WORLD_NAVIGATION_PREPARATION_SCHEMA;
  readonly id: string;
  readonly frame: PreparedWorldCameraFrame;
}
export type WorldNavigationPreparationReceipt = WorldNavigationReceiptBase & (
  | { readonly model: 'ecliptic-presentation-frame'; readonly renderedRadiusUnits: number; readonly ephemerisSource: string }
  | { readonly model?: never; readonly bodyToPresentation: WorldRotation; readonly sourceRadiusUnits: number;
      readonly tilePixels: number; readonly sceneScale: number; readonly renderedRadiusUnits: number;
      readonly defaultCamera?: { readonly initialScenePitchDegrees: number; readonly defaultControlYawDegrees: number };
      readonly sourceGeometryConvention: string; readonly ephemerisSource: string }
);

/** A physical frame is the same frame when every number agrees to double precision.
 *
 * The descriptor, the receipt and the prepared scene each hold the frame as some run computed it, and two runs
 * that multiply the same rotation in a different order differ in the last few digits: `hd-189733b` carries a
 * `presentationToReference` whose worst relative difference is 8.8e-13. Bit equality would make every such pair
 * a contract failure while nothing about the frame had changed. The bound is far above that roundoff and far
 * below any real change of origin, scale or orientation. Everything that is not a number still matches exactly.
 */
const FRAME_TOLERANCE = 1e-9;
export function samePreparedWorldFrame(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
    return Math.abs(a - b) <= FRAME_TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b));
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => samePreparedWorldFrame(value, b[index]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => key in right && samePreparedWorldFrame(left[key], right[key]));
  }
  return Object.is(a, b);
}


/** Keep the authored receipt reader's acceptance and diagnostics; full physical auditing remains with bake. */
export function requireWorldNavigationReceiptIdentity(receipt: Record<string, unknown>, id: unknown, frame: Record<string, unknown>): void {
  if (receipt.schema !== WORLD_NAVIGATION_PREPARATION_SCHEMA || receipt.id !== id || !samePreparedWorldFrame(receipt.frame, frame))
    throw new TypeError('Authored physical frame receipt differs from its descriptor.');
  if (typeof frame.epochJdTt !== 'number' || !Number.isFinite(frame.epochJdTt) || ![frame.bodyRadiusM, frame.metersPerUnit].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0))
    throw new TypeError('Authored physical frame has invalid physical units.');
}
