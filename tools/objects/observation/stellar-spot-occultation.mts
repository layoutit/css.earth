/** A dated transit-chord reconstruction on a camera-facing stellar limb plate.
 * A spot occultation constrains one dark active region, not a global surface map.
 * The orbit's sky position angle and the direction of transit are display conventions. */
import { requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';

export interface SpotOccultation {
  readonly planet: string;
  readonly transitIndex: number;
  readonly conjunctionBjdMinus2450000: number;
  readonly midEventOffsetSeconds: number;
  readonly minimumAngularRadiusDegrees: number;
  readonly contrast: number;
  readonly source: string;
}
export interface SpotOrbit { readonly periodDays: number; readonly semiMajorAxisStellarRadii: number; readonly inclinationDegrees: number }

export function parseSpotOccultation(value: unknown): SpotOccultation {
  const record = requireRecord(value, 'spot occultation');
  if (record.schema !== 'cssearth-spot-occultation@1') throw new TypeError('Expected cssearth-spot-occultation@1.');
  const event = requireRecord(record.event, 'spot event');
  const result = {
    planet: requireString(event.planet, 'spot planet'),
    transitIndex: requireFiniteNumber(event.transitIndex, 'transit index'),
    conjunctionBjdMinus2450000: requireFiniteNumber(event.conjunctionBjdMinus2450000, 'transit conjunction'),
    midEventOffsetSeconds: requireFiniteNumber(event.midEventOffsetSeconds, 'spot offset'),
    minimumAngularRadiusDegrees: requireFiniteNumber(event.minimumAngularRadiusDegrees, 'spot minimum radius'),
    contrast: requireFiniteNumber(event.contrast, 'spot contrast'),
    source: requireString(record.source, 'spot source')
  };
  if (!Number.isInteger(result.transitIndex) || result.minimumAngularRadiusDegrees <= 0 || result.minimumAngularRadiusDegrees >= 90 ||
      result.contrast <= 0 || result.contrast >= 1) throw new TypeError('Spot event has invalid index, radius or contrast.');
  return result;
}

/** Project the planet centre at the reported event time onto the visible stellar disc. */
export function spotDiscCentre(event: SpotOccultation, orbit: SpotOrbit) {
  if (!(orbit.periodDays > 0 && orbit.semiMajorAxisStellarRadii > 1 && orbit.inclinationDegrees > 0 && orbit.inclinationDegrees <= 90))
    throw new TypeError('A transit-chord spot requires a valid circular hosted orbit.');
  const phase = 2 * Math.PI * event.midEventOffsetSeconds / (orbit.periodDays * 86400);
  const inclination = orbit.inclinationDegrees * Math.PI / 180;
  const x = orbit.semiMajorAxisStellarRadii * Math.sin(phase);
  const y = orbit.semiMajorAxisStellarRadii * Math.cos(inclination) * Math.cos(phase);
  const radialSquared = x * x + y * y;
  if (radialSquared >= 1) throw new TypeError('The reported spot event falls outside the stellar disc on this orbit.');
  return { x, y, z: Math.sqrt(1 - radialSquared) };
}

/** Overlay a spherical cap at the paper's *minimum* angular radius. Coverage is supersampled only at its boundary.
 * Alpha adds an achromatic TESS-band contrast to the Gaia-colour photosphere: a visible display approximation.
 * The plate remains stationary; no stellar spin is inferred from one occultation. */
export function addSpotOccultationToLimbPlate(plate: { data: Uint8Array; size: number; lossless: boolean },
  event: SpotOccultation, orbit: SpotOrbit) {
  const centre = spotDiscCentre(event, orbit), { data, size } = plate;
  if (data.length !== size * size * 4) throw new TypeError('The limb plate must be square RGBA.');
  const cosRadius = Math.cos(event.minimumAngularRadiusDegrees * Math.PI / 180);
  const output = new Uint8Array(data);
  const radius = size / 2;
  const projectedReach = Math.sin(event.minimumAngularRadiusDegrees * Math.PI / 180);
  const minX = Math.max(0, Math.floor(radius * (1 + centre.x - projectedReach) - 2));
  const maxX = Math.min(size - 1, Math.ceil(radius * (1 + centre.x + projectedReach) + 2));
  const minY = Math.max(0, Math.floor(radius * (1 - centre.y - projectedReach) - 2));
  const maxY = Math.min(size - 1, Math.ceil(radius * (1 - centre.y + projectedReach) + 2));
  for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
    let covered = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const x = (px + (sx + 0.5) / 4 - radius) / radius;
      const y = (radius - py - (sy + 0.5) / 4) / radius;
      const rr = x * x + y * y;
      if (rr > 1) continue;
      const z = Math.sqrt(1 - rr);
      if (x * centre.x + y * centre.y + z * centre.z >= cosRadius) covered++;
    }
    if (!covered) continue;
    const alphaIndex = (py * size + px) * 4 + 3;
    const base = data[alphaIndex]!;
    output[alphaIndex] = Math.round(base + (255 - base) * event.contrast * covered / 16);
  }
  return { data: output, size, lossless: plate.lossless };
}
