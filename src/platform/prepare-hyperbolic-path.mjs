// Prepare-only hyperbola geometry. Negative-a convention, with periapsis on
// +x and motion toward +y. Weber, Orbital Mechanics & Astrodynamics, eq.233:
// https://orbital-mechanics.space/time-since-periapsis-and-keplers-equation/hyperbolic-trajectories.html
// This is a finite visualization window, never a physical apoapsis or period.
import { add, magnitude, round, scale } from "./heliocentric-view.mjs";

export function prepareHyperbolicPath({
  semiMajorAxisUnits: a, eccentricity: e, trueAnomalyRad,
  unitsPerAu, heliocentricDistanceAu, focus, perihelionDirection, perihelionMotion,
  segments = 360, localRefinementHalvings = 8,
}) {
  if (!(Number.isFinite(a) && a < 0 && Number.isFinite(e) && e > 1 &&
      Number.isFinite(trueAnomalyRad) && Number.isFinite(unitsPerAu) && unitsPerAu > 0 &&
      Number.isFinite(heliocentricDistanceAu) && heliocentricDistanceAu > 0 &&
      Number.isSafeInteger(segments) && segments >= 8)) {
    throw new TypeError("Hyperbolic path requires finite negative a, e > 1 and a finite display scale.");
  }
  const halfTangent = Math.sqrt((e - 1) / (e + 1)) * Math.tan(trueAnomalyRad / 2);
  if (!(Math.abs(halfTangent) < 1)) throw new RangeError("True anomaly is outside the hyperbolic asymptotes.");
  const bodyHyperbolicAnomalyRad = 2 * Math.atanh(halfTangent);
  const semiMinorAxisUnits = -a * Math.sqrt((e - 1) * (e + 1));
  const center = add(focus, scale(perihelionDirection, -a * e));
  const majorAxis = scale(perihelionDirection, a);
  const minorAxis = scale(perihelionMotion, semiMinorAxisUnits);
  const pointAt = h => add(center, add(scale(majorAxis, Math.cosh(h)), scale(minorAxis, Math.sinh(h))));
  if (magnitude(pointAt(bodyHyperbolicAnomalyRad)) > 1e-6 * -a) {
    throw new RangeError("The body is off its hyperbolic path; the orbital facts disagree with the Sun direction.");
  }
  // Enclose both sides of periapsis and the epoch position with spare room.
  // 600 au is a drawing choice. It does not bound the body's motion over time.
  const displayExtentAu = Math.max(600, 1.25 * heliocentricDistanceAu, 1.25 * -a * (e - 1) / unitsPerAu);
  const limit = Math.acosh((displayExtentAu * unitsPerAu / -a + 1) / e);
  const anomalies = new Set([0, bodyHyperbolicAnomalyRad]);
  const step = 2 * limit / segments;
  for (let i = 0; i <= segments; i++) anomalies.add(-limit + i * step);
  for (let halving = 1; halving <= localRefinementHalvings; halving++) {
    for (const sign of [-1, 1]) {
      const h = bodyHyperbolicAnomalyRad + sign * step / 2 ** halving;
      if (h > -limit && h < limit) anomalies.add(h);
    }
  }
  const sorted = [...anomalies].sort((left, right) => left - right);
  const bodyVertexIndex = sorted.indexOf(bodyHyperbolicAnomalyRad);
  const vertices = Object.freeze(sorted.map((h, index) => Object.freeze(
    index === bodyVertexIndex ? [0, 0, 0] : pointAt(h).map(round))));
  return Object.freeze({
    closed: false, bodyVertexIndex, bodyHyperbolicAnomalyRad, displayExtentAu,
    displayExtentModel: "finite-heliocentric-radius-window-including-epoch",
    semiMinorAxisUnits, center, majorAxis, minorAxis, vertices,
    // N-1 chords: there is no closing edge and no share-of-a-turn trail.
    trail: Object.freeze(Array(vertices.length - 1).fill(1)),
    chordBehindTurns: Object.freeze([]), trailSpans: null,
    trailModel: "finite-open-trajectory-constant-weight",
  });
}
