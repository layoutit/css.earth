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
  if (source.schema !== 'cssearth-observed-pole@1' || source.phase !== 'arbitrary-display-phase' ||
      ![source.rightAscensionDegrees, source.declinationDegrees, source.displayMeridianDegrees, source.periodHours, epochJdTt].every(Number.isFinite) ||
      source.periodHours <= 0 || Math.abs(source.declinationDegrees) > 90) throw new TypeError('Invalid observed pole source.');
  const rad = Math.PI / 180;
  return { poleRightAscensionRad: source.rightAscensionDegrees * rad,
    poleDeclinationRad: source.declinationDegrees * rad,
    primeMeridianRad: source.displayMeridianDegrees * rad,
    spinRateRadPerDay: 2 * Math.PI * 24 / source.periodHours };
}
