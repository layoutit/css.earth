import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadPdsPlateShape } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import { preparePdsConstraintMap } from '../../../../tools/objects/terrestrial-layers/pds-constraint-map.mts';
const root = resolve(import.meta.dirname, '../../../../src/objects/comet-81p');
const json = async (path: string) => JSON.parse((await readFile(resolve(root, path))).toString('utf8'));

test('Wild 2 coverage material reproduces from plate flags and registers every source plate center', async () => {
  const profile = (await json('source/preparation/terrestrial.json')).geometry.radialTerrain;
  const mesh = await loadPdsPlateShape(resolve(root, 'source', profile.path), profile.grid);
  const material = (await json('source/manifest.json')).inputs.find((input: { id: string; }) => input.id === 'model-surface');
  assert.equal(material.recipe.kind, 'plate-coverage');
  assert.deepEqual(await preparePdsConstraintMap(mesh, material.recipe), await readFile(resolve(root, 'source', material.path)));
  for (const [i, triangle] of mesh.indices.entries()) {
    const center = [0, 1, 2].map(axis => triangle.reduce((sum, vertex) => sum + mesh.positions[vertex][axis], 0) / 3);
    const longitude = Math.atan2(center[1], center[0]) * 180 / Math.PI;
    const latitude = Math.atan2(center[2], Math.hypot(center[0], center[1])) * 180 / Math.PI;
    const hit = mesh.hit(longitude, latitude);
    assert.ok(hit);
    assert.equal(required(mesh.faceProvenance)[hit.faceId] === 0, required(mesh.faceProvenance)[i] === 0,
      'radial material projection must not exchange observed terrain and estimated plates at source centers');
  }
});

test('Wild 2 closes the nucleus using published completion vertices and retains source provenance', async () => {
  const config = await json('source/preparation/terrestrial.json'), profile = config.geometry.radialTerrain;
  const source = await loadPdsPlateShape(resolve(root, 'source', profile.path), profile.grid);
  const observed = await loadPdsPlateShape(resolve(root, 'source/shape/wild2_cart_vis.tab'), {
    metersPerUnit: 1, indexBase: 0, expectedVertices: 6432, expectedFaces: 12514,
  });
  const terrain = await json('prepared/terrain.json');
  const meters = config.geometry.radiusKm * 1000 / config.geometry.radius;
  const key = (point: number[]) => point.map((n: number) => n.toFixed(4)).join(',');
  const lookup = new Map(source.positions.map((point, i) => [key(point), i]));
  assert.ok("vertexProvenance" in source && "coverage" in source);
  const fullObserved = source.positions.filter((_, i) => source.vertexProvenance[i] === 0);
  const matches = new Set();
  for (const point of observed.positions) {
    let distance = Infinity, nearest = -1;
    for (let i = 0; i < fullObserved.length; i++) {
      const candidate = Math.hypot(...point.map((n, j) => n - fullObserved[i][j]));
      if (candidate < distance) { distance = candidate; nearest = i; }
    }
    // The two published Cartesian products differ by up to 11.22 mm.
    // This cross-release comparison detects frame/scale drift, not exact bytes.
    assert.ok(distance < .02, 'full-model observed coordinates match the separate release within 2 cm');
    matches.add(nearest);
  }
  assert.equal(matches.size, 6432, 'all observed vertices have distinct corresponding full-model vertices');
  assert.deepEqual(source.coverage, {
    model: 'pds-observed-ellipsoid-flags', sourceVertices: 8761, sourceFaces: 17518,
    observedVertices: 6432, ellipsoidVertices: 2329, observedFaces: 12364, ellipsoidFaces: 4338, connectingFaces: 816,
  });
  const indices = terrain.faces.flatMap((face: { vertices: number[][]; }) => face.vertices.map((vertex: number[]) => {
    const index = lookup.get(key(vertex.map((n: number) => n * meters)));
    assert.notEqual(index, undefined, 'every retained position belongs to the published full model');
    return index;
  }));
  const before = validateClosedMesh(Uint32Array.from(source.indices.flat()), source.positions);
  const after = validateClosedMesh(Uint32Array.from(indices), source.positions);
  assert.equal(after.eulerCharacteristic, 2);
  assert.equal(after.components, 1);
  assert.ok(Math.abs(after.signedVolumeCubicMeters / before.signedVolumeCubicMeters - 1) < .03);
  assert.equal(terrain.faces.length, 992);
  for (const axis of [0, 1, 2]) for (const sign of [-1, 1]) {
    const origin = [0, 0, 0], direction = [0, 0, 0]; origin[axis] = 10000 * sign; direction[axis] = -sign;
    assert.ok(source.intersect(origin, direction), 'full model has a surface from every principal direction');
  }
  const runtime = await json('prepared/runtime.json');
  assert.equal(runtime.surfaceHit.frontFace, undefined);
  assert.equal(runtime.surfaceHit.triangles.length, 992);
  assert.equal((await json('source/preparation/rotation.json')).schema, 'cssearth-display-orientation@1');
});
