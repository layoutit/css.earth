import {array,number,shape,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadObjShape } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root = resolve(import.meta.dirname, '../../../../src/objects/comet-67p');
const json = async (path: string) => JSON.parse((await readFile(resolve(root, path))).toString('utf8'));

test('67P retains original Cheops XYZ positions and a closed non-radial surface', async () => {
  const config = await json('source/preparation/terrestrial.json'), profile = config.geometry.radialTerrain;
  const source = await loadObjShape(resolve(root, 'source', profile.path), profile.grid);
  const prepared = await json('evidence/terrain.json');
  const metres = config.geometry.radiusKm * 1000 / config.geometry.radius;
  // Independent bounds of the released kilometre vertex table, in metres.
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(Math.abs(Math.min(...source.positions.map(p => p[axis])) - [-2451.866, -1761.567, -1689.174][axis]) < .001);
    assert.ok(Math.abs(Math.max(...source.positions.map(p => p[axis])) - [2608.555, 1953.11, 1622.252][axis]) < .001);
  }
  const key = (p: number[]) => p.map((x: number) => x.toFixed(4)).join(',');
  const sourceVertices = new Set(source.positions.map(key)), positions = [], lookup = new Map(), indices = [];
  for (const face of prepared.faces) for (const v of face.vertices) {
    const p = v.map((x: number) => x * metres), k = key(p);
    assert.ok(sourceVertices.has(k), 'simplification must keep released positions, not move them onto a sphere');
    if (!lookup.has(k)) { lookup.set(k, positions.length); positions.push(p); }
    indices.push(lookup.get(k));
  }
  const topology = validateClosedMesh(Uint32Array.from(indices), positions);
  const original = validateClosedMesh(Uint32Array.from(source.indices.flat()), source.positions);
  assert.equal(topology.components, 1); assert.equal(topology.eulerCharacteristic, 2);
  assert.ok(Math.abs(topology.signedVolumeCubicMeters / original.signedVolumeCubicMeters - 1) < .01);
  // A source-facing inward radial normal exists at the neck. A radial shell
  // with forced outward radial normals could not represent this geometry.
  assert.ok(array(shape({normal:array(number),vertices:array(array(number))}))(prepared.faces).some(f => f.normal.reduce((s: number, n: number, a: number) => s + n * f.vertices[0][a], 0) < -10));
});
