/** Candidate orbits of a wide binary companion, for a star whose orbit is not measured.
 *
 * Gaia measures where the companion is and how it moves across the sky, but not its distance along the line of sight or its
 * relative radial velocity, so a family of orbits fits the same measurements. LOFTI (Pearce et al. 2020, Orbits for the
 * Impatient) samples that family; its results file lists one accepted orbit per line. This reader turns the first `displayed`
 * accepted orbits into orbital states in the scene's frame, so the context can draw them all around the primary.
 *
 * LOFTI's frame is the plane of the sky at the primary: X toward north, Y toward east, Z toward the observer, with the
 * inclination measured from that plane, the longitude of nodes east of north and the argument of periastron in the orbit. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireFiniteNumber, requireRecord, requireString } from '../source-values.mts';
import type { OrbitalState, Vector3 } from '../../src/preparation/spatial-context.js';

const AU_M = 149597870700, RAD = Math.PI / 180;
/** LOFTI writes these columns, in this order (lofti.py, output_file_header). */
const COLUMNS = ['sma', 'period', 'orbit phase', 't_0', 'ecc', 'incl', 'argp', 'lan', 'm_tot', 'dist', 'chi^2', 'ln(prob)', 'ln(randn)'] as const;

export interface OrbitFamilyRecord {
  readonly primary: string;
  readonly path: string;
  readonly displayed: number;
  readonly source: string;
}

export function parseOrbitFamilyRecord(value: unknown): OrbitFamilyRecord {
  const input = requireRecord(value, 'orbit family record');
  if (input.schema !== 'cssearth-orbit-family@1') throw new TypeError('An orbit family uses cssearth-orbit-family@1.');
  if (input.format !== 'lofti-results') throw new TypeError('Only LOFTI results files are read as an orbit family.');
  const displayed = requireFiniteNumber(input.displayed, 'orbit family displayed');
  if (!Number.isSafeInteger(displayed) || displayed < 2) throw new TypeError('An orbit family draws at least two orbits.');
  return { primary: requireString(input.primary, 'orbit family primary'), path: requireString(input.path, 'orbit family path'),
    displayed, source: requireString(input.source, 'orbit family source') };
}

export interface CandidateOrbitElements {
  readonly semiMajorAxisAu: number; readonly periodYears: number; readonly periastronYear: number;
  readonly eccentricity: number; readonly inclinationDegrees: number; readonly argumentOfPeriastronDegrees: number;
  readonly longitudeOfNodeDegrees: number; readonly totalMassSolar: number; readonly distanceParsecs: number;
}

/** The first `displayed` accepted orbits of a LOFTI results file, in file order: its samples are drawn independently, so the
 * first ones are a sample of the posterior, not a selection. */
export function readLoftiOrbits(text: string, displayed: number): CandidateOrbitElements[] {
  const lines = text.split(/\r?\n/u).filter(line => line.trim());
  const header = lines[0];
  if (!header?.startsWith('#') || COLUMNS.some(column => !header.includes(column))) throw new TypeError('The results file must carry LOFTI\'s own header.');
  const rows = lines.slice(1).filter(line => !line.startsWith('#'));
  if (rows.length < displayed) throw new TypeError(`The results file holds ${rows.length} orbits, fewer than the ${displayed} drawn.`);
  return rows.slice(0, displayed).map((row, index) => {
    const values = row.trim().split(/\s+/u).map(value => requireFiniteNumber(Number(value), `orbit ${index + 1} value`));
    if (values.length !== COLUMNS.length) throw new TypeError(`Orbit ${index + 1} does not have ${COLUMNS.length} columns.`);
    const [sma, period, , periastron, eccentricity, inclination, argument, node, mass, distance] = values as number[];
    if (!(sma! > 0 && period! > 0 && eccentricity! >= 0 && eccentricity! < 1 && distance! > 0 && mass! > 0)) throw new TypeError(`Orbit ${index + 1} is not a bound orbit.`);
    // LOFTI's semi-major axis is an angle at the fitted distance.
    return { semiMajorAxisAu: sma! * distance!, periodYears: period!, periastronYear: periastron!, eccentricity: eccentricity!,
      inclinationDegrees: inclination!, argumentOfPeriastronDegrees: argument!, longitudeOfNodeDegrees: node!,
      totalMassSolar: mass!, distanceParsecs: distance! };
  });
}

/** True anomaly of an elliptical orbit at a date, from its period and periastron passage (both in decimal years). */
export function trueAnomalyAt(elements: Pick<CandidateOrbitElements, 'periodYears' | 'periastronYear' | 'eccentricity'>, decimalYear: number) {
  const mean = 2 * Math.PI * (decimalYear - elements.periastronYear) / elements.periodYears;
  const e = elements.eccentricity;
  let eccentric = mean;
  for (let step = 0; step < 64; step++) {
    const delta = (eccentric - e * Math.sin(eccentric) - mean) / (1 - e * Math.cos(eccentric));
    eccentric -= delta;
    if (Math.abs(delta) < 1e-14) break;
  }
  return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(eccentric / 2), Math.sqrt(1 - e) * Math.cos(eccentric / 2));
}

/** Periastron direction and orbit normal in the sky frame (north, east, toward the observer), from the orbit's angles. */
export function candidateOrbitFrame(elements: Pick<CandidateOrbitElements, 'inclinationDegrees' | 'argumentOfPeriastronDegrees' | 'longitudeOfNodeDegrees'>) {
  const i = elements.inclinationDegrees * RAD, w = elements.argumentOfPeriastronDegrees * RAD, node = elements.longitudeOfNodeDegrees * RAD;
  const periastron: Vector3 = [Math.cos(node) * Math.cos(w) - Math.sin(node) * Math.sin(w) * Math.cos(i),
    Math.sin(node) * Math.cos(w) + Math.cos(node) * Math.sin(w) * Math.cos(i), Math.sin(w) * Math.sin(i)];
  const inPlane: Vector3 = [-Math.cos(node) * Math.sin(w) - Math.sin(node) * Math.cos(w) * Math.cos(i),
    -Math.sin(node) * Math.sin(w) + Math.cos(node) * Math.cos(w) * Math.cos(i), Math.cos(w) * Math.sin(i)];
  const normal: Vector3 = [periastron[1] * inPlane[2] - periastron[2] * inPlane[1],
    periastron[2] * inPlane[0] - periastron[0] * inPlane[2], periastron[0] * inPlane[1] - periastron[1] * inPlane[0]];
  return { periastron, inPlane, normal };
}

/** The companion's position relative to its primary at a date, in AU on the sky frame's axes. */
export function candidateRelativePositionAu(elements: CandidateOrbitElements, decimalYear: number): Vector3 {
  const anomaly = trueAnomalyAt(elements, decimalYear);
  const radius = elements.semiMajorAxisAu * (1 - elements.eccentricity ** 2) / (1 + elements.eccentricity * Math.cos(anomaly));
  const { periastron, inPlane } = candidateOrbitFrame(elements);
  return [0, 1, 2].map(axis => radius * (Math.cos(anomaly) * periastron[axis]! + Math.sin(anomaly) * inPlane[axis]!)) as unknown as Vector3;
}

export interface SkyFrameAxes { readonly north: Vector3; readonly east: Vector3; readonly towardObserver: Vector3 }

/** One candidate as an orbital state the world context can draw. Its position is where this candidate puts the companion,
 * including the line-of-sight offset the measurements do not fix, so the body's own drawn position lies on no candidate. */
export function candidateOrbitalState(elements: CandidateOrbitElements, axes: SkyFrameAxes, decimalYear: number,
  centerPositionM: Vector3, centerBodyId: string): OrbitalState {
  const toReference = (vector: Vector3): Vector3 => [0, 1, 2].map(axis =>
    vector[0] * axes.north[axis]! + vector[1] * axes.east[axis]! + vector[2] * axes.towardObserver[axis]!) as unknown as Vector3;
  const { periastron, normal } = candidateOrbitFrame(elements);
  const unit = (vector: Vector3): Vector3 => { const length = Math.hypot(...vector); return vector.map(value => value / length) as unknown as Vector3; };
  const relative = toReference(candidateRelativePositionAu(elements, decimalYear).map(value => value * AU_M) as unknown as Vector3);
  const positionM = centerPositionM.map((value, axis) => value + relative[axis]!) as unknown as Vector3;
  return { positionM, centerBodyId, centerPositionM, normal: unit(toReference(normal)), perihelionDirection: unit(toReference(periastron)),
    semiMajorAxisM: elements.semiMajorAxisAu * AU_M, eccentricity: elements.eccentricity, trueAnomalyRadians: trueAnomalyAt(elements, decimalYear) };
}

/** Every candidate orbit of one body, read from its pinned results file. */
export async function loadOrbitFamily(sourceDirectory: string, record: OrbitFamilyRecord, axes: SkyFrameAxes, decimalYear: number,
  centerPositionM: Vector3): Promise<readonly OrbitalState[]> {
  if (record.path.startsWith('/') || record.path.split('/').includes('..')) throw new TypeError('An orbit family file lives inside its package.');
  const orbits = readLoftiOrbits(await readFile(resolve(sourceDirectory, record.path), 'utf8'), record.displayed);
  return orbits.map(elements => candidateOrbitalState(elements, axes, decimalYear, centerPositionM, record.primary));
}

/** Separation on the sky, in arcseconds, of a candidate's predicted position: its north and east offsets at the fitted distance. */
export const separationArcseconds = (relativeAu: Vector3, distanceParsecs: number) =>
  Math.hypot(relativeAu[0], relativeAu[1]) / distanceParsecs;
