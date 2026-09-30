import { array, numbers, record } from '../validation/guards.js';
import { WORLD_ORBITS_MAGIC, WORLD_ORBITS_VERSION } from './world-context.js';

/** An orbit bank's typed sections, as the packed file shuffles them (@cssearth/objects prepared-binary.ts): vertices are
 * Int32, trails Float64, chord and vertex indices Uint32, each at the [byteOffset, count] its header names. */
export function worldOrbitBankRegions(bytes: Uint8Array, at = 'orbit bank'): { offset: number; bytes: number; elementBytes: number }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || view.getUint32(0, true) !== WORLD_ORBITS_MAGIC || view.getUint32(4, true) !== WORLD_ORBITS_VERSION) throw new TypeError(`${at}: not a version ${WORLD_ORBITS_VERSION} orbit bank.`);
  const headerLength = view.getUint32(8, true), dataStart = 12 + headerLength + (8 - (12 + headerLength) % 8) % 8;
  const header = record(JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + headerLength))), `${at} header`, ['schema', 'bodies']);
  const regions: { offset: number; bytes: number; elementBytes: number }[] = [];
  const add = (value: unknown, elementBytes: number, label: string) => {
    const [offset, count] = numbers(value, label, 2);
    regions.push({ offset: dataStart + offset!, bytes: count! * elementBytes, elementBytes });
  };
  for (const value of array(header.bodies, `${at} bodies`)) {
    const body = record(value, `${at} body`, ['id', 'vertexOriginM', 'vertexStepM', 'vertices', 'trail', 'activeChords', 'extentChords', 'bodyVertexIndex', 'trailModel', 'levels']);
    add(body.vertices, 4, `${at} vertices`); add(body.trail, 8, `${at} trail`); add(body.activeChords, 4, `${at} active chords`); add(body.extentChords, 4, `${at} extent chords`);
    for (const level of body.levels === undefined ? [] : array(body.levels, `${at} levels`)) {
      const entry = record(level, `${at} level`, ['vertexIndices', 'trail', 'activeChords', 'deviationM']);
      add(entry.vertexIndices, 4, `${at} level vertices`); add(entry.trail, 8, `${at} level trail`); add(entry.activeChords, 4, `${at} level chords`);
    }
  }
  return regions;
}
