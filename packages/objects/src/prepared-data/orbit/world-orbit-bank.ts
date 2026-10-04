import { PREPARED_WORLD_CONTEXT_SCHEMA, PREPARED_WORLD_ORBITS_SCHEMA } from '../world/world-schemas.js';
import { array, finite, numbers, positive, record, text } from '../world/world-guards.js';
import { validateOrbitGeometry, vector } from '../world/world-context.js';
import type { PreparedContextGeometryBody, PreparedContextOrbitGeometry, PreparedWorldContext, PreparedWorldContextGeometry } from '../world/world-context.js';

export const WORLD_ORBITS_MAGIC = 0x4f575343, WORLD_ORBITS_VERSION = 2;
/** One bank's paths from its pinned binary file: index and weight sections become typed-array views over the transferred
 * bytes, Int32 vertex steps are decoded to metres, and each orbit passes the same checks as the JSON file. The bank must
 * hold exactly the path of the body it is named for. */
export function decodeWorldOrbitBank(plan: PreparedWorldContext, centreId: string, bytes: ArrayBuffer): ReadonlyMap<string, PreparedContextOrbitGeometry> {
  const expected = plan.orbitBanks?.[centreId];
  if (expected === undefined || bytes.byteLength !== expected) throw new TypeError(`Orbit bank ${centreId} is ${bytes.byteLength} bytes; its summary says ${expected}.`);
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== WORLD_ORBITS_MAGIC || view.getUint32(4, true) !== WORLD_ORBITS_VERSION) throw new TypeError(`Unsupported orbit bank ${centreId}.`);
  const headerLength = view.getUint32(8, true), dataStart = 12 + headerLength + (8 - (12 + headerLength) % 8) % 8;
  const header = record(JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 12, headerLength))), 'orbit bank header', ['schema', 'bodies']);
  if (header.schema !== PREPARED_WORLD_ORBITS_SCHEMA) throw new TypeError(`Unsupported orbit bank ${centreId}.`);
  const section = <T extends Float64Array | Uint32Array | Int32Array>(value: unknown, type: { new(buffer: ArrayBuffer, offset: number, length: number): T; BYTES_PER_ELEMENT: number }, label: string): T => {
    const [offset, length] = numbers(value, label, 2);
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset % 8 !== 0 ||
        dataStart + offset + length * type.BYTES_PER_ELEMENT > bytes.byteLength) throw new TypeError(`${label} lies outside the orbit bank.`);
    return new type(bytes, dataStart + offset, length);
  };
  const paths = new Map(array(header.bodies, 'orbit bank bodies').map(value => {
    const body = record(value, 'orbit bank body', ['id', 'vertexOriginM', 'vertexStepM', 'vertices', 'trail', 'activeChords', 'extentChords', 'bodyVertexIndex', 'trailModel', 'levels']);
    return [text(body.id, 'orbit bank body id'), body] as const;
  }));
  const renderedIds = new Set(plan.bodies.map(body => body.id)), orbits = new Map<string, PreparedContextOrbitGeometry>();
  for (const body of plan.bodies) {
    if (!body.orbit || body.id !== centreId) continue;
    const path = paths.get(body.id);
    if (!path) throw new TypeError(`${body.id}: orbit bank ${centreId} lacks its path.`);
    paths.delete(body.id);
    const { orbit } = body;
    const originM = vector(path.vertexOriginM, `${body.id} vertex origin`), stepM = positive(path.vertexStepM, `${body.id} vertex step`);
    const steps = section(path.vertices, Int32Array, `${body.id} vertices`);
    const geometry = validateOrbitGeometry({ centerBodyId: orbit.centerBodyId, centerPositionM: orbit.centerPositionM,
      verticesM: Float64Array.from(steps, (count, index) => originM[index % 3]! + count * stepM), trail: section(path.trail, Float64Array, `${body.id} trail`),
      activeChords: section(path.activeChords, Uint32Array, `${body.id} active chords`), extentChords: section(path.extentChords, Uint32Array, `${body.id} extent chords`),
      ...(orbit.bounds ? { bounds: orbit.bounds } : {}),
      ...(orbit.closed === false ? { closed: false as const, displayExtentAu: orbit.displayExtentAu,
        bodyVertexIndex: finite(path.bodyVertexIndex, `${body.id} epoch vertex`), trailModel: path.trailModel } : {}),
      ...(orbit.lod ? { lod: { bounds: orbit.lod.bounds, levels: array(path.levels, `${body.id} detail levels`).map(value => {
        const level = record(value, 'orbit bank level', ['vertexIndices', 'trail', 'activeChords', 'deviationM']);
        return { vertexIndices: section(level.vertexIndices, Uint32Array, `${body.id} level vertices`), trail: section(level.trail, Float64Array, `${body.id} level trail`),
          activeChords: section(level.activeChords, Uint32Array, `${body.id} level chords`), deviationM: finite(level.deviationM, `${body.id} level deviation`) };
      }) } } : {}) }, body.positionM, plan.focus.id, renderedIds, body.id);
    if (geometry.vertexCount !== orbit.vertexCount || geometry.fullTrail !== orbit.fullTrail) throw new TypeError(`${body.id}: orbit bank ${centreId} differs from its summary.`);
    orbits.set(body.id, geometry);
  }
  if (paths.size) throw new TypeError(`Orbit bank ${centreId} carries paths for bodies it does not hold: ${[...paths.keys()].join(', ')}.`);
  return orbits;
}
/** The planner's full context from the summary plan and every centre's bank, for build tools and tests. */
export function decodeWorldOrbits(plan: PreparedWorldContext, banks: ReadonlyMap<string, ArrayBuffer>): PreparedWorldContextGeometry {
  const orbits = new Map([...banks].flatMap(([id, bytes]) => [...decodeWorldOrbitBank(plan, id, bytes)]));
  const bodies = plan.bodies.map(body => {
    if (!body.orbit) return body as PreparedContextGeometryBody;
    const orbit = orbits.get(body.id);
    if (!orbit) throw new TypeError(`${body.id}: no bank holds its orbit.`);
    return Object.freeze({ ...body, orbit });
  });
  // The full context holds every body: the summary's bank pins and its list of other systems' bodies stay behind.
  const { orbitBanks: _pins, worldBodyCount: _count, ...rest } = plan;
  return Object.freeze({ ...rest, schema: PREPARED_WORLD_CONTEXT_SCHEMA, bodies: Object.freeze(bodies) });
}
