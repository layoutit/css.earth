/**
 * Which way a light-curve inversion record reads, decided by the pole a publication states for the same solution.
 *
 * The VLT/SPHERE survey's released records do not share a column order: most state pole latitude first, some longitude
 * first, and nothing in the file says which. Reading one the wrong way moves the pole by up to tens of degrees, and on a
 * nearly round body no outline measurement notices: Iris was read latitude-first, which puts its pole 9.3 degrees from
 * the right reading and 6.8 from its paper's, and the registration stage called that registered. The published pole decides instead. The reading must land within the
 * separation a published table's rounding and stated uncertainty allow, and clearly nearer than the other reading, or
 * the record is refused.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode, requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';
import { parseSpinState, type SpinState } from './observer-camera.mts';

export const READING = {
  /** The largest separation from the published pole a reading may have: the survey's Table A.1 states whole degrees with uncertainties up to five. */
  maximumSeparationDegrees: 5,
  /** How much nearer the chosen reading must be than the other, so rounding cannot decide it. */
  minimumMarginDegrees: 2,
} as const;

export type ColumnOrder = 'latitude-first' | 'longitude-first';
export interface PublishedPole { longitudeDegrees: number; latitudeDegrees: number }
export interface SpinRecordReading { order: ColumnOrder; spin: SpinState; separationDegrees: number; otherSeparationDegrees: number | null }

const DEGREE = Math.PI / 180;
/** Great-circle separation between two ecliptic directions, degrees. */
export function poleSeparationDegrees(a: PublishedPole, b: PublishedPole) {
  const c = Math.sin(a.latitudeDegrees * DEGREE) * Math.sin(b.latitudeDegrees * DEGREE)
    + Math.cos(a.latitudeDegrees * DEGREE) * Math.cos(b.latitudeDegrees * DEGREE) * Math.cos((a.longitudeDegrees - b.longitudeDegrees) * DEGREE);
  return Math.acos(Math.max(-1, Math.min(1, c))) / DEGREE;
}

/** The reading of a record the published pole supports, or an error naming both separations. */
export function spinRecordReading(text: string, published: PublishedPole): SpinRecordReading {
  const readings = (['latitude-first', 'longitude-first'] as const).flatMap(order => {
    try {
      const spin = parseSpinState(text, order);
      return [{ order, spin, separationDegrees: poleSeparationDegrees({ longitudeDegrees: spin.longitudeDegrees, latitudeDegrees: spin.latitudeDegrees }, published) }];
    } catch { return []; }
  }).sort((a, b) => a.separationDegrees - b.separationDegrees);
  const [best, other] = readings;
  const describe = readings.map(r => `${r.order} ${r.separationDegrees.toFixed(1)}°`).join(', ') || 'no valid reading';
  if (!best || best.separationDegrees > READING.maximumSeparationDegrees)
    throw new TypeError(`Neither reading of the spin record matches the published pole (${describe}); the record and the publication describe different solutions.`);
  if (other && other.separationDegrees - best.separationDegrees < READING.minimumMarginDegrees)
    throw new TypeError(`The published pole does not decide the spin record's column order (${describe}).`);
  return { ...best, otherSeparationDegrees: other?.separationDegrees ?? null };
}

/** The pole a lens's spin record is read against: the one its rotation states, when the body's own belongs to another
 * solution, otherwise the body's own. */
export async function readingPole(sourceDirectory: string, stated?: { eclipticJ2000Degrees: readonly number[] }): Promise<PublishedPole | null> {
  if (stated) return { longitudeDegrees: stated.eclipticJ2000Degrees[0], latitudeDegrees: stated.eclipticJ2000Degrees[1] };
  return publishedPole(sourceDirectory);
}

/** The pole a body's retained publication extract states, `reference/model-properties.json`, or null when it records none. */
export async function publishedPole(sourceDirectory: string): Promise<PublishedPole | null> {
  let text: string;
  try { text = await readFile(resolve(sourceDirectory, 'reference/model-properties.json'), 'utf8'); } catch (error) { if (hasErrorCode(error, 'ENOENT')) return null; throw error; }
  const pole = requireRecord(JSON.parse(text)).poleEclipticJ2000Degrees;
  if (pole === undefined) return null;
  const [longitudeDegrees, latitudeDegrees] = requireArray(pole, 'published pole').map((value, index) => requireFiniteNumber(value, `published pole ${index}`));
  return { longitudeDegrees, latitudeDegrees };
}
