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
  if (source.schema === 'cssearth-orbit-aligned-pole@1') return orbitAlignedPole(directory, source, epochJdTt);
  if (source.schema === 'cssearth-measured-obliquity-pole@1') return measuredObliquityPole(directory, source, epochJdTt);
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

/** A planet on a circular hosted orbit that keeps one face toward its star: the pole is the orbit normal (prograde spin),
 * longitude 0 is the sub-host point at the epoch, and the uniform spin rate is the orbital rate. An eccentric orbit needs an
 * explicitly authored rotation law because a uniform spin cannot keep one face toward its star throughout the orbit. */
async function synchronousRotation(directory: string, source: Record<string, unknown>, epochJdTt: number): Promise<RotationElements> {
  const { id } = requireRecord(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')), 'Object descriptor');
  if (typeof id !== 'string' || typeof source.source !== 'string' || !source.source.trim() || typeof source.qualification !== 'string' || !source.qualification.trim() ||
      typeof source.coordinateSystem !== 'string' || !source.coordinateSystem.trim()) throw new TypeError('Invalid synchronous rotation source.');
  const { HOSTED_PLANET_IDS, hostedOrbit, hostedPlanetStateRelativeKm } = await import('@cssearth/astronomy');
  if (!(HOSTED_PLANET_IDS as readonly string[]).includes(id)) throw new TypeError(`Synchronous rotation needs a hosted orbit: ${id}.`);
  const planet = id as (typeof HOSTED_PLANET_IDS)[number], orbit = hostedOrbit(planet);
  if (orbit.eccentricity !== 0) {
    throw new TypeError(`Synchronous rotation needs a circular hosted orbit; ${id} has eccentricity ${orbit.eccentricity}. Supply an explicit authored rotation law.`);
  }
  const { positionKm: r, velocityKmPerDay: v, hostId } = hostedPlanetStateRelativeKm(planet, epochJdTt);
  if (source.host !== hostId) throw new TypeError(`Synchronous rotation host ${String(source.host)} is not the orbit's host ${hostId}.`);
  return synchronousRotationElements(r, v, orbit.periodDays, orbit.eccentricity);
}

/** IAU-style elements for a circular orbit whose +X faces the centre it orbits and whose +Z is its orbit normal. W is measured
 * from the ascending node of the body equator on the ICRF equator, as `bodyFixedToIcrf` expects. */
export function synchronousRotationElements(positionKm: readonly number[], velocityKmPerDay: readonly number[], periodDays: number, eccentricity = 0): RotationElements {
  if (eccentricity !== 0) throw new TypeError('Synchronous rotation needs a circular orbit; supply an explicit authored rotation law for an eccentric orbit.');
  const unit = (v: readonly number[]) => { const n = Math.hypot(...v); if (!(n > 0)) throw new RangeError('Direction has no magnitude.'); return v.map(c => c / n); };
  const cross = (a: readonly number[], b: readonly number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
  const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  const pole = unit(cross(positionKm, velocityKmPerDay)), toHost = unit(positionKm.map(c => -c));
  const node = unit([-pole[1]!, pole[0]!, 0]);
  const w = Math.atan2(dot(pole, cross(node, toHost)), dot(node, toHost));
  return { poleRightAscensionRad: Math.atan2(pole[1]!, pole[0]!), poleDeclinationRad: Math.asin(Math.max(-1, Math.min(1, pole[2]!))),
    primeMeridianRad: (w + 2 * Math.PI) % (2 * Math.PI), spinRateRadPerDay: 2 * Math.PI / periodDays };
}

/** A star whose spin axis is measured to lie along a transiting planet's orbit normal (a Rossiter-McLaughlin sky-projected obliquity
 * consistent with zero): the pole is that orbit's normal, with no spin, because no rotation period is measured; longitude 0 faces the
 * Sun at the epoch, a display phase. The orbit is the one owner of the direction; the source cites the measurement. */
async function orbitAlignedPole(directory: string, source: Record<string, unknown>, epochJdTt: number): Promise<RotationElements> {
  const { id } = requireRecord(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')), 'Object descriptor');
  const obliquity = requireRecord(source.projectedObliquity, 'projectedObliquity');
  const degrees = requireFiniteNumber(obliquity.degrees), uncertainty = requireFiniteNumber(obliquity.uncertaintyDegrees);
  if (typeof id !== 'string' || typeof source.planet !== 'string' || source.phase !== 'arbitrary-display-phase' ||
      typeof source.source !== 'string' || !source.source.trim() || typeof source.qualification !== 'string' || !source.qualification.trim() ||
      typeof source.coordinateSystem !== 'string' || !source.coordinateSystem.trim() || typeof obliquity.source !== 'string' || !obliquity.source.trim()) {
    throw new TypeError('Invalid orbit-aligned pole source.');
  }
  // Aligned means consistent with zero: the measurement must allow it within twice its uncertainty.
  if (!(uncertainty > 0) || Math.abs(degrees) > 2 * uncertainty) throw new TypeError(`A projected obliquity of ${degrees} ± ${uncertainty} degrees is not aligned.`);
  const { HOSTED_PLANET_IDS, hostedPlanetStateRelativeKm } = await import('@cssearth/astronomy');
  if (!(HOSTED_PLANET_IDS as readonly string[]).includes(source.planet)) throw new TypeError(`An orbit-aligned pole needs a hosted planet: ${source.planet}.`);
  const { positionKm: r, velocityKmPerDay: v, hostId } = hostedPlanetStateRelativeKm(source.planet as (typeof HOSTED_PLANET_IDS)[number], epochJdTt);
  if (hostId !== id) throw new TypeError(`${source.planet} orbits ${hostId}, not ${id}.`);
  // +Z on the orbit normal (prograde).
  return sunFacingElements(id, [r[1]! * v[2]! - r[2]! * v[1]!, r[2]! * v[0]! - r[0]! * v[2]!, r[0]! * v[1]! - r[1]! * v[0]!], epochJdTt, 0);
}

/** A star pole along `pole` (ICRF), +X toward the Sun at the epoch: W from the ascending node of the equator on the ICRF equator. */
async function sunFacingElements(id: string, poleDirection: readonly number[], epochJdTt: number, spinRateRadPerDay: number): Promise<RotationElements> {
  const { starStateKm } = await import('@cssearth/astronomy');
  const star = starStateKm(id as Parameters<typeof starStateKm>[0], epochJdTt).positionKm, toSun = star.map(c => -c);
  const unit = (x: readonly number[]) => { const n = Math.hypot(...x); return x.map(c => c / n); };
  const pole = unit(poleDirection), sun = unit(toSun);
  const node = unit([-pole[1]!, pole[0]!, 0]), cross = [node[1]! * sun[2]! - node[2]! * sun[1]!, node[2]! * sun[0]! - node[0]! * sun[2]!, node[0]! * sun[1]! - node[1]! * sun[0]!];
  const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  return { poleRightAscensionRad: Math.atan2(pole[1]!, pole[0]!), poleDeclinationRad: Math.asin(Math.max(-1, Math.min(1, pole[2]!))),
    primeMeridianRad: (Math.atan2(dot(pole, cross), dot(node, sun)) + 2 * Math.PI) % (2 * Math.PI), spinRateRadPerDay };
}

/** The spin axis of a star in the frame of its transiting planet's orbit, seen from the observer (+Z toward us, +Y the sky-projected
 * orbit normal): the orbit normal is (0, sin i, cos i) and the spin axis (sin i* sin lambda, sin i* cos lambda, cos i*), with lambda
 * the sky-projected angle between them and i* the spin axis's inclination to the line of sight. The true obliquity follows from
 * cos psi = cos i* cos i + sin i* sin i cos lambda. */
export function obliquitySpinAxis(orbitInclinationDegrees: number, stellarInclinationDegrees: number, projectedObliquityDegrees: number) {
  const rad = Math.PI / 180, i = orbitInclinationDegrees * rad, star = stellarInclinationDegrees * rad, lambda = projectedObliquityDegrees * rad;
  const spin = [Math.sin(star) * Math.sin(lambda), Math.sin(star) * Math.cos(lambda), Math.cos(star)] as const;
  const trueObliquityDegrees = Math.acos(Math.max(-1, Math.min(1, Math.cos(star) * Math.cos(i) + Math.sin(star) * Math.sin(i) * Math.cos(lambda)))) / rad;
  return { spin, trueObliquityDegrees };
}

/** A star whose spin axis is measured in three dimensions against a transiting planet's orbit (projected obliquity lambda, stellar
 * inclination i*) and whose equatorial rotation period is measured: the pole is built in the planet's sky frame and spins at the
 * equatorial rate; longitude 0 faces the Sun at the epoch, a display phase. The published true obliquity must follow from the
 * record's lambda, i* and the orbit's inclination within its stated uncertainty, so the conventions are checked, not assumed. */
async function measuredObliquityPole(directory: string, source: Record<string, unknown>, epochJdTt: number): Promise<RotationElements> {
  const { id } = requireRecord(JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8')), 'Object descriptor');
  const measured = (key: string) => { const entry = requireRecord(source[key], key);
    if (typeof entry.source !== 'string' || !entry.source.trim()) throw new TypeError(`${key} names its source.`); return entry; };
  const lambda = requireFiniteNumber(measured('projectedObliquity').degrees), inclination = requireFiniteNumber(measured('stellarInclination').degrees);
  const psi = measured('trueObliquity'), psiDegrees = requireFiniteNumber(psi.degrees), psiUncertainty = requireFiniteNumber(psi.uncertaintyDegrees);
  const periodDays = requireFiniteNumber(measured('equatorialRotationPeriod').days);
  if (typeof id !== 'string' || typeof source.planet !== 'string' || source.phase !== 'arbitrary-display-phase' || !(periodDays > 0) || !(psiUncertainty > 0) ||
      !(inclination >= 0 && inclination <= 180) || typeof source.source !== 'string' || !source.source.trim() || typeof source.qualification !== 'string' || !source.qualification.trim() ||
      typeof source.coordinateSystem !== 'string' || !source.coordinateSystem.trim()) throw new TypeError('Invalid measured obliquity pole source.');
  const { HOSTED_PLANET_IDS, hostedOrbit, hostSkyFrame, starAstrometry, BODIES } = await import('@cssearth/astronomy');
  if (!(HOSTED_PLANET_IDS as readonly string[]).includes(source.planet)) throw new TypeError(`A measured obliquity needs a hosted planet: ${source.planet}.`);
  const planet = source.planet as (typeof HOSTED_PLANET_IDS)[number], orbit = hostedOrbit(planet);
  if (BODIES[planet].parent !== id) throw new TypeError(`${planet} orbits ${BODIES[planet].parent}, not ${id}.`);
  const { spin, trueObliquityDegrees } = obliquitySpinAxis(orbit.inclinationDegrees, inclination, lambda);
  if (Math.abs(trueObliquityDegrees - psiDegrees) > psiUncertainty) {
    throw new TypeError(`lambda ${lambda}, i* ${inclination} and the orbit's i ${orbit.inclinationDegrees} give psi ${trueObliquityDegrees.toFixed(2)}, not ${psiDegrees} +/- ${psiUncertainty} degrees.`);
  }
  const frame = hostSkyFrame(starAstrometry(id as Parameters<typeof starAstrometry>[0]), orbit.ascendingNodePositionAngleDegrees);
  const pole = [0, 1, 2].map(axis => spin[0] * frame.x[axis]! + spin[1] * frame.y[axis]! + spin[2] * frame.z[axis]!);
  return sunFacingElements(id, pole, epochJdTt, 2 * Math.PI / periodDays);
}
