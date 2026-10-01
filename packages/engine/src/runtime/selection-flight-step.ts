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
// The rounding of one sampled position, as a fraction of its focus distance plus its range: a sum and a product per axis.
const POSITION_RESOLUTION = 4 * Number.EPSILON;

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
  const [focusX, focusY, focusZ] = flight.focusPositionM, focusDistanceM = Math.hypot(focusX, focusY, focusZ);
  const allowed = (time: number): boolean => {
    sampleSelectionFlightInto(flight, time, out);
    const [nextX, nextY, nextZ] = out.positionM;
    const limit = MAX_CLEARANCE_FRACTION * Math.min(previousClearance, clearance(anchors, nextX, nextY, nextZ));
    // A sample is its focus plus a direction times a range, so it resolves no finer than a few ulps of those two
    // lengths: 64 m when the focus is a star 3.85e17 m away. A cap below that would be decided by rounding, so the
    // cap is never smaller. Near the focus both lengths are small and the cap rules.
    const resolution = POSITION_RESOLUTION * (focusDistanceM + Math.hypot(nextX - focusX, nextY - focusY, nextZ - focusZ));
    return Math.hypot(nextX - x, nextY - y, nextZ - z) <= Math.max(limit, resolution);
  };
  const requested = Math.min(flight.durationS, requestedElapsedS);
  if (allowed(requested)) return requested;
  // Bisect until the two times are neighbours. Leaving a 165 m body for a star 3.85e17 m away, the first permitted step
  // is about 1e-17 s: 48 halvings of a 1/60 s frame stopped above it, kept `low` at the time it started from, and the
  // flight never left its first frame (Itokawa to TRAPPIST-1, live, 2026-10-01).
  let low = fromElapsedS, high = requested;
  for (let iteration = 0; iteration < 1100; iteration++) {
    const middle = (low + high) / 2;
    if (middle <= low || middle >= high) break;
    if (allowed(middle)) low = middle; else high = middle;
    if (low > fromElapsedS && high - low <= (low - fromElapsedS) * 2 ** -16) break;
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
