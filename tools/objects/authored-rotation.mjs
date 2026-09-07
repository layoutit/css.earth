import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';

// A measured pole is distinct from an IAU prime-meridian solution. For bodies
// without a phase ephemeris, preserve an explicitly arbitrary display phase.
export async function readAuthoredRotation(directory, reference, epochJdTt) {
  const path = resolve(directory, reference.path);
  if (relative(directory, path).startsWith('..')) throw new TypeError('Rotation source escapes the object.');
  const bytes = await readFile(path);
  if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256) throw new TypeError('Rotation source pin differs.');
  const source = JSON.parse(bytes);
  if (source.schema === 'cssearth-measured-rotation@1') {
    const { rightAscensionDegrees, declinationDegrees, primeMeridianDegrees, spinDegreesPerDay, referenceEpochJdTt } = source;
    if (![rightAscensionDegrees, declinationDegrees, primeMeridianDegrees, spinDegreesPerDay, referenceEpochJdTt, epochJdTt].every(Number.isFinite) ||
        Math.abs(declinationDegrees) > 90 || spinDegreesPerDay === 0 || typeof source.source !== 'string' ||
        typeof source.coordinateSystem !== 'string' || !source.coordinateSystem.trim()) throw new TypeError('Invalid measured rotation source.');
    const rad = Math.PI / 180;
    return { poleRightAscensionRad: rightAscensionDegrees * rad, poleDeclinationRad: declinationDegrees * rad,
      primeMeridianRad: ((primeMeridianDegrees + (epochJdTt - referenceEpochJdTt) * spinDegreesPerDay) % 360) * rad,
      spinRateRadPerDay: spinDegreesPerDay * rad };
  }
  if (source.schema === 'cssearth-linear-rotation@1') {
    const { rightAscensionDegrees: ra, declinationDegrees: dec, referenceEpochJdTt: epoch,
      primeMeridianDegrees: meridian, spinRateDegreesPerDay: rate } = source;
    if (![ra, dec, epoch, meridian, rate, epochJdTt].every(Number.isFinite) || Math.abs(dec) > 90 ||
        !rate || typeof source.source !== 'string' || !source.source.trim()) throw new TypeError('Invalid source-bound rotation.');
    const rad = Math.PI / 180, w = meridian + rate * (epochJdTt - epoch);
    return { poleRightAscensionRad: ra * rad, poleDeclinationRad: dec * rad,
      primeMeridianRad: ((w % 360 + 360) % 360) * rad, spinRateRadPerDay: rate * rad };
  }
  const observed = source.schema === 'cssearth-observed-pole@1';
  if ((!observed && source.schema !== 'cssearth-display-orientation@1') || source.phase !== 'arbitrary-display-phase' ||
      ![source.rightAscensionDegrees, source.declinationDegrees, source.displayMeridianDegrees, epochJdTt].every(Number.isFinite) ||
      (observed && (!Number.isFinite(source.periodHours) || source.periodHours <= 0)) ||
      (!observed && (typeof source.qualification !== 'string' || !source.qualification.trim())) ||
      Math.abs(source.declinationDegrees) > 90) throw new TypeError('Invalid authored orientation source.');
  const rad = Math.PI / 180;
  return { poleRightAscensionRad: source.rightAscensionDegrees * rad,
    poleDeclinationRad: source.declinationDegrees * rad,
    primeMeridianRad: source.displayMeridianDegrees * rad,
    spinRateRadPerDay: observed ? 2 * Math.PI * 24 / source.periodHours : 0 };
}
