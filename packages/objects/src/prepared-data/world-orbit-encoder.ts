import { PREPARED_WORLD_ORBITS_SCHEMA } from './world-schemas.js';
import type { PreparedWorldContextData as PreparedWorldContext } from './world-context-data.js';
import type { WorldPosition as Vector3 } from './world-frame.js';
import { WORLD_ORBITS_MAGIC, WORLD_ORBITS_VERSION } from './world-orbit-bank.js';

/** The orbit bank's layout: `CSWO`, format version, header byte length (little-endian u32s), the UTF-8 JSON
 * header, then 8-byte-aligned sections. The header names each orbit's sections as [byteOffset, count] from the
 * start of the bank: vertices as Int32 x,y,z steps from the orbit's `vertexOriginM` in units of its `vertexStepM`,
 * trail weights as Float64, chord and vertex indices as Uint32. The planner worker reads them as typed-array views.
 * Version 2 stores vertices as Int32 steps from the vertex that pins the body, which decodes exactly: Float64 metres were
 * 98% of a bank's compressed bytes and do not compress. A step is the path's largest offset over 2^31 - 1; measured
 * across all 658 paths (2026-09-25, `orbitVertexError`), the worst error is 5.3e-10 of a path's span: 108 m on Earth's
 * orbit, 3,554 km on S85's 70,693 AU path around Sgr A*. */
const INT32_STEPS = 0x7fffffff;
/** A path's vertex origin and step, so every vertex is an Int32 count of steps. The origin is the vertex that pins the body
 * (the first, or an open trajectory's epoch vertex), so the body's own position decodes exactly. */
function orbitVertexQuantum(verticesM: readonly Vector3[], pinnedIndex = 0) {
  const originM = verticesM[pinnedIndex]!;
  const reach = Math.max(...verticesM.flatMap(vertex => vertex.map((value, axis) => Math.abs(value - originM[axis]!))));
  return { originM, stepM: reach > 0 ? reach / INT32_STEPS : 1 };
}
/** The largest distance between a path's vertices and their Int32 encoding, in metres. */
function orbitVertexError(verticesM: readonly Vector3[], pinnedIndex = 0): number {
  const { originM, stepM } = orbitVertexQuantum(verticesM, pinnedIndex);
  return Math.max(...verticesM.map(vertex => Math.hypot(...vertex.map((value, axis) => originM[axis]! + Math.round((value - originM[axis]!) / stepM) * stepM - value))));
}
function encodeWorldOrbits(prepared: PreparedWorldContext, include: (body: PreparedWorldContext['bodies'][number]) => boolean = () => true): Uint8Array {
  const sections: (Float64Array | Uint32Array | Int32Array)[] = [];
  let offset = 0;
  const section = (values: Float64Array | Uint32Array | Int32Array) => { const at = offset; sections.push(values); offset += values.byteLength; offset += (8 - offset % 8) % 8; return [at, values.length] as const; };
  const f64 = (values: readonly number[]) => section(Float64Array.from(values));
  const u32 = (values: readonly number[]) => {
    if (values.some(value => !Number.isSafeInteger(value) || value < 0 || value > 0xffffffff)) throw new TypeError('Orbit bank indices must be unsigned 32-bit integers.');
    return section(Uint32Array.from(values));
  };
  const bodies = prepared.bodies.flatMap(body => {
    const orbit = body.orbit;
    if (!orbit || !include(body)) return [];
    const { originM, stepM } = orbitVertexQuantum(orbit.verticesM, orbit.closed === false ? orbit.bodyVertexIndex : 0);
    const vertices = section(Int32Array.from(orbit.verticesM.flat(), (value, index) => Math.round((value - originM[index % 3]!) / stepM)));
    return [{ id: body.id, vertexOriginM: originM, vertexStepM: stepM, vertices, trail: f64(orbit.trail), activeChords: u32(orbit.activeChords),
      extentChords: u32(orbit.extentChords),
      ...(orbit.closed === false ? { bodyVertexIndex: orbit.bodyVertexIndex, trailModel: orbit.trailModel } : {}),
      levels: orbit.lod.levels.map(level => ({ vertexIndices: u32(level.vertexIndices), trail: f64(level.trail),
        activeChords: u32(level.activeChords), deviationM: level.deviationM })) }];
  });
  const header = new TextEncoder().encode(JSON.stringify({ schema: PREPARED_WORLD_ORBITS_SCHEMA, bodies }));
  const dataStart = 12 + header.byteLength + (8 - (12 + header.byteLength) % 8) % 8;
  const bytes = new Uint8Array(dataStart + offset);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, WORLD_ORBITS_MAGIC, true); view.setUint32(4, WORLD_ORBITS_VERSION, true); view.setUint32(8, header.byteLength, true);
  bytes.set(header, 12);
  // Section offsets in the header are relative to the data start, which follows the padded header.
  let at = dataStart;
  for (const values of sections) {
    bytes.set(new Uint8Array(values.buffer, values.byteOffset, values.byteLength), at);
    at += values.byteLength; at += (8 - (at - dataStart) % 8) % 8;
  }
  return bytes;
}
/** One orbit bank per path, named by its body: the planner worker reads a path when a frame would draw it, so a page
 * downloads only the paths its views draw. A bank per orbit centre carried every path around that centre: the Sun view
 * drew 36 of the Sun's 124 paths and Jupiter's 7 of its moons' 28 (the Sun view read 194 KB brotli, 91 KB per path).
 * The asset host serves `.bin` uncompressed, so those brotli sizes were never sent: preparation packs each bank
 * (site/build/prepare/prepare-spatial-context.ts, `@cssearth/objects` prepared-binary.ts), which took the 1,463 published
 * banks from 6,225,752 to 3,026,744 bytes (2026-09-30). */
export function worldOrbitBanks(prepared: PreparedWorldContext): { readonly id: string; readonly bytes: Uint8Array }[] {
  return prepared.bodies.filter(body => body.orbit).map(body => body.id).sort()
    .map(id => ({ id, bytes: encodeWorldOrbits(prepared, body => body.id === id) }));
}
