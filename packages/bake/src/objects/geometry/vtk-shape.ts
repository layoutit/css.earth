/** Released ASCII VTK POLYDATA triangles, optionally followed by one integer cell field.
 * The same coordinates and topology serve geometry and categorical-map preparation. */
import { readFile } from 'node:fs/promises';
import { parseMeshProfile } from './shape-records.ts';
import { createIndexedShape } from './obj-shape.ts';

export function decodeVtkMesh(text: string, value: unknown) {
  const grid = parseMeshProfile(value);
  if (!(grid.metersPerUnit > 0) || ![grid.expectedVertices, grid.expectedFaces].every(n => Number.isSafeInteger(n) && n > 0))
    throw new TypeError('Invalid VTK mesh dimensions.');
  const normalized = text.replace(/\r\n/g, '\n');
  const header = /^# vtk DataFile Version 2\.0\n[^\n]*\nASCII\nDATASET POLYDATA\n/.exec(normalized);
  if (!header) throw new Error('Unsupported VTK mesh header.');
  const tokens = normalized.slice(header[0].length).trim().split(/\s+/); let at = 0;
  const take = (expected: string) => { if (tokens[at++] !== expected) throw new Error('Unexpected VTK field: ' + expected); };
  const integer = () => {
    const token = tokens[at++];
    if (!/^-?\d+$/.test(token ?? '') || !Number.isSafeInteger(Number(token))) throw new Error('Non-integer VTK value.');
    return Number(token);
  };
  take('POINTS'); const vertexCount = integer(); take('float');
  if (vertexCount !== grid.expectedVertices) throw new Error('VTK vertex count changed.');
  const positions = Array.from({ length: vertexCount }, () => Array.from({ length: 3 }, () => {
    const n = Number(tokens[at++]) * grid.metersPerUnit;
    if (!Number.isFinite(n)) throw new Error('Non-finite VTK coordinate.'); return n;
  }));
  take('POLYGONS'); const faceCount = integer(), entries = integer();
  if (faceCount !== grid.expectedFaces || entries !== faceCount * 4) throw new Error('VTK polygon count changed.');
  const indices = Array.from({ length: faceCount }, () => {
    if (integer() !== 3) throw new Error('VTK mesh requires triangles.');
    const face = [integer(), integer(), integer()];
    if (new Set(face).size !== 3 || face.some(i => i < 0 || i >= vertexCount)) throw new Error('Invalid VTK triangle index.');
    return face;
  });
  let cellField: { name: string; values: Int32Array } | undefined;
  if (at < tokens.length) {
    take('CELL_DATA'); if (integer() !== faceCount) throw new Error('VTK cell count changed.');
    take('SCALARS'); const name = tokens[at++];
    if (!name) throw new Error('Missing VTK cell field name.');
    take('integer'); take('1'); take('LOOKUP_TABLE'); take('default');
    const values = Int32Array.from({ length: faceCount }, () => {
      const n = integer();
      if (n < -2147483648 || n > 2147483647) throw new Error('VTK cell value exceeds int32.');
      return n;
    });
    cellField = { name, values };
  }
  if (at !== tokens.length) throw new Error('Unconsumed VTK mesh data.');
  return { positions, indices, cellField };
}

export async function loadVtkShape(path: string, value: unknown) {
  const grid = parseMeshProfile(value), mesh = decodeVtkMesh(await readFile(path, 'utf8'), grid);
  return createIndexedShape(mesh.positions, mesh.indices, grid);
}
