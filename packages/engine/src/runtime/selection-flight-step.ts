import { sampleSelectionFlightInto } from './selection-flight.js';
import type { PositionM, SelectionFlight, SelectionFlightSample } from './selection-flight.js';

export interface FlightBodyAnchor {
  readonly positionM: PositionM;
  readonly radiusM: number;
}

// Galaxio caps altitude changes at .1 logarithmic decade per painted frame.
// Apply the same scale to movement near BOTH bodies: destination-only range
// control allows a nearby departing body to disappear in the first frame.
const MAX_CLEARANCE_FRACTION = 10 ** .1 - 1;

/** Retimes the original curve without changing any position or orientation on it.
 * Call once per painted frame and retain the returned curve time across owners.
 * A body's radius bounds its clearance below, including paths through its centre,
 * so a finite path cannot stall at a zero-clearance surface.
 */
export function advanceSelectionFlightInto(flight: SelectionFlight, anchors: readonly FlightBodyAnchor[],
  fromElapsedS: number, requestedElapsedS: number, out: SelectionFlightSample): number {
  if (!Number.isFinite(fromElapsedS) || !Number.isFinite(requestedElapsedS) ||
      fromElapsedS < 0 || requestedElapsedS < fromElapsedS || fromElapsedS > flight.durationS) {
    throw new TypeError('Flight advancement needs finite, ordered curve times.');
  }
  if (anchors.length === 0 || anchors.some(anchor => anchor.positionM.length !== 3 ||
      !anchor.positionM.every(Number.isFinite) || !Number.isFinite(anchor.radiusM) || anchor.radiusM <= 0)) {
    throw new TypeError('Flight advancement needs finite body positions and positive radii.');
  }
  sampleSelectionFlightInto(flight, fromElapsedS, out);
  const x = out.positionM[0], y = out.positionM[1], z = out.positionM[2];
  const previousClearance = clearance(anchors, x, y, z);
  const allowed = (time: number): boolean => {
    sampleSelectionFlightInto(flight, time, out);
    const [nextX, nextY, nextZ] = out.positionM;
    const limit = MAX_CLEARANCE_FRACTION * Math.min(previousClearance, clearance(anchors, nextX, nextY, nextZ));
    return Math.hypot(nextX - x, nextY - y, nextZ - z) <= limit;
  };
  const requested = Math.min(flight.durationS, requestedElapsedS);
  if (allowed(requested)) return requested;
  let low = fromElapsedS, high = requested;
  for (let iteration = 0; iteration < 48; iteration++) {
    const middle = (low + high) / 2;
    if (allowed(middle)) low = middle; else high = middle;
  }
  sampleSelectionFlightInto(flight, low, out);
  return low;
}

function clearance(anchors: readonly FlightBodyAnchor[], x: number, y: number, z: number): number {
  let nearest = Infinity;
  for (const anchor of anchors) {
    const distance = Math.hypot(x - anchor.positionM[0], y - anchor.positionM[1], z - anchor.positionM[2]);
    nearest = Math.min(nearest, Math.max(anchor.radiusM, distance - anchor.radiusM));
  }
  return nearest;
}
