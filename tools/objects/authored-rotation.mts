import { sha256 } from '../../src/platform/sha256.mts';
import type { RotationElements } from "@cssearth/astronomy";
import { requireRecord, requireFiniteNumber } from "../source-values.mts";
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

async function manifestPin(directory: string, path: string) {
  const { createSourceManifest } = await import('../../src/platform/source-manifest.mts');
  const { boundReference } = await import('./authored-sources.ts');
  const { id } = requireRecord(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')), 'Object descriptor');
  if (typeof id !== 'string') throw new TypeError('Object descriptor needs an id.');
  const manifest = await createSourceManifest({ planetId: id, planetName: id, sourceRoot: resolve(directory, 'source') });
  return boundReference(manifest, { id: 'rotation', path });
}

// A measured pole is distinct from an IAU prime-meridian solution. For bodies
// without a phase ephemeris, preserve an explicitly arbitrary display phase.
export async function readAuthoredRotation(directory: string, reference: { path: string; sha256?: string }, epochJdTt: number): Promise<RotationElements> {
  const path = resolve(directory, reference.path);
  if (relative(directory, path).startsWith('..')) throw new TypeError('Rotation source escapes the object.');
  const bytes = await readFile(path);
  // A recipe reference carries no pin of its own; the source manifest owns it.
  const pin = reference.sha256 ?? (await manifestPin(directory, reference.path)).sha256;
  if (sha256(bytes) !== pin) throw new TypeError('Rotation source pin differs.');
  const source = requireRecord(JSON.parse(bytes.toString("utf8")), "Rotation source");
  if (source.schema === 'cssearth-measured-rotation@1') {
    const rightAscensionDegrees = requireFiniteNumber(source.rightAscensionDegrees), declinationDegrees = requireFiniteNumber(source.declinationDegrees), primeMeridianDegrees = requireFiniteNumber(source.primeMeridianDegrees), spinDegreesPerDay = requireFiniteNumber(source.spinDegreesPerDay), referenceEpochJdTt = requireFiniteNumber(source.referenceEpochJdTt);
    if (![rightAscensionDegrees, declinationDegrees, primeMeridianDegrees, spinDegreesPerDay, referenceEpochJdTt, epochJdTt].every(Number.isFinite) ||
        Math.abs(declinationDegrees) > 90 || spinDegreesPerDay === 0 || typeof source.source !== 'string' ||
        typeof source.coordinateSystem !== 'string' || !source.coordinateSystem.trim()) throw new TypeError('Invalid measured rotation source.');
    const quadratic = requireFiniteNumber(source.primeMeridianQuadraticDegreesPerDaySquared ?? 0);
    if (!Number.isFinite(quadratic)) throw new TypeError('Invalid measured rotation acceleration.');
    const rad = Math.PI / 180, days = epochJdTt - referenceEpochJdTt;
    return { poleRightAscensionRad: rightAscensionDegrees * rad, poleDeclinationRad: declinationDegrees * rad,
      primeMeridianRad: ((primeMeridianDegrees + days * spinDegreesPerDay + days * days * quadratic) % 360) * rad,
      spinRateRadPerDay: (spinDegreesPerDay + 2 * days * quadratic) * rad };
  }
  if (source.schema === 'cssearth-linear-rotation@1') {
    const ra = requireFiniteNumber(source.rightAscensionDegrees), dec = requireFiniteNumber(source.declinationDegrees), epoch = requireFiniteNumber(source.referenceEpochJdTt), meridian = requireFiniteNumber(source.primeMeridianDegrees), rate = requireFiniteNumber(source.spinRateDegreesPerDay);
    if (![ra, dec, epoch, meridian, rate, epochJdTt].every(Number.isFinite) || Math.abs(dec) > 90 ||
        !rate || typeof source.source !== 'string' || !source.source.trim()) throw new TypeError('Invalid source-bound rotation.');
    const rad = Math.PI / 180, w = meridian + rate * (epochJdTt - epoch);
    return { poleRightAscensionRad: ra * rad, poleDeclinationRad: dec * rad,
      primeMeridianRad: ((w % 360 + 360) % 360) * rad, spinRateRadPerDay: rate * rad };
  }
  if (source.schema === 'cssearth-synchronous-rotation@1') return synchronousRotation(directory, source, epochJdTt);
  const observed = source.schema === 'cssearth-observed-pole@1';
  const rightAscension = requireFiniteNumber(source.rightAscensionDegrees), declination = requireFiniteNumber(source.declinationDegrees), meridian = requireFiniteNumber(source.displayMeridianDegrees);
  const periodHours = observed ? requireFiniteNumber(source.periodHours) : 0;
  if ((!observed && source.schema !== 'cssearth-display-orientation@1') || source.phase !== 'arbitrary-display-phase' ||
      ![rightAscension, declination, meridian, epochJdTt].every(Number.isFinite) ||
      (observed && (!Number.isFinite(periodHours) || periodHours <= 0)) ||
      (!observed && (typeof source.qualification !== 'string' || !source.qualification.trim())) ||
      Math.abs(declination) > 90) throw new TypeError('Invalid authored orientation source.');
  const rad = Math.PI / 180;
  return { poleRightAscensionRad: rightAscension * rad,
    poleDeclinationRad: declination * rad,
    primeMeridianRad: meridian * rad,
    spinRateRadPerDay: observed ? 2 * Math.PI * 24 / periodHours : 0 };
}

/** A planet on a hosted orbit that keeps one face toward its star: the pole is the orbit normal (prograde spin), longitude 0 is
 * the sub-host point at the epoch, and the spin rate is the orbital rate. Everything follows from the planet's hosted orbit
 * record; the source only states the assumption and its qualification. */
async function synchronousRotation(directory: string, source: Record<string, unknown>, epochJdTt: number): Promise<RotationElements> {
  const { id } = requireRecord(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')), 'Object descriptor');
  if (typeof id !== 'string' || typeof source.source !== 'string' || !source.source.trim() || typeof source.qualification !== 'string' || !source.qualification.trim() ||
      typeof source.coordinateSystem !== 'string' || !source.coordinateSystem.trim()) throw new TypeError('Invalid synchronous rotation source.');
  const { HOSTED_PLANET_IDS, hostedOrbit, hostedPlanetStateRelativeKm } = await import('@cssearth/astronomy');
  if (!(HOSTED_PLANET_IDS as readonly string[]).includes(id)) throw new TypeError(`Synchronous rotation needs a hosted orbit: ${id}.`);
  const planet = id as (typeof HOSTED_PLANET_IDS)[number], { positionKm: r, velocityKmPerDay: v, hostId } = hostedPlanetStateRelativeKm(planet, epochJdTt);
  if (source.host !== hostId) throw new TypeError(`Synchronous rotation host ${String(source.host)} is not the orbit's host ${hostId}.`);
  return synchronousRotationElements(r, v, hostedOrbit(planet).periodDays);
}

/** IAU-style elements for a body whose +X faces the centre it orbits and whose +Z is its orbit normal. W is measured from the
 * ascending node of the body equator on the ICRF equator, as `bodyFixedToIcrf` expects. */
export function synchronousRotationElements(positionKm: readonly number[], velocityKmPerDay: readonly number[], periodDays: number): RotationElements {
  const unit = (v: readonly number[]) => { const n = Math.hypot(...v); if (!(n > 0)) throw new RangeError('Direction has no magnitude.'); return v.map(c => c / n); };
  const cross = (a: readonly number[], b: readonly number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
  const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  const pole = unit(cross(positionKm, velocityKmPerDay)), toHost = unit(positionKm.map(c => -c));
  const node = unit([-pole[1]!, pole[0]!, 0]);
  const w = Math.atan2(dot(pole, cross(node, toHost)), dot(node, toHost));
  return { poleRightAscensionRad: Math.atan2(pole[1]!, pole[0]!), poleDeclinationRad: Math.asin(Math.max(-1, Math.min(1, pole[2]!))),
    primeMeridianRad: (w + 2 * Math.PI) % (2 * Math.PI), spinRateRadPerDay: 2 * Math.PI / periodDays };
}
