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
