import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createObservationMapping, reprojectObservationPrior } from './observation-prior.ts';
import type { VolumeSource } from '@cssearth/volume-bake/compact-inputs/density-grid';
import type { ImageWcs, OverlayFrame } from '@cssearth/bake/volume';

const close = (a: readonly number[], b: readonly number[], eps = 1e-10) => a.forEach((value, i) => assert.ok(Math.abs(value - b[i]) < eps, `${value} != ${b[i]}`));
const rotate = ([x, y, z, w]: readonly number[], p: readonly number[]) => {
  const tx = 2 * (y * p[2] - z * p[1]), ty = 2 * (z * p[0] - x * p[2]), tz = 2 * (x * p[1] - y * p[0]);
  return [p[0] + w * tx + y * tz - z * ty, p[1] + w * ty + z * tx - x * tz, p[2] + w * tz + x * ty - y * tx];
};
test('tangent photo mapping matches independent Astropy rays and holds those rays across physical depths', async () => {
  const oracle = JSON.parse(await readFile('labs/nebula/packages/lab/src/features/alignment/fixtures/astropy-wcs.json', 'utf8'));
  const fixture = oracle.fixtures.find((item: { id: string }) => item.id === 'lmc-overlays-smash-original');
  const frame = JSON.parse(await readFile('labs/nebula/models/lmc/full-density/object.json', 'utf8')).properties.volume as OverlayFrame;
  const mapping = createObservationMapping(fixture.wcs, frame), [width, height] = fixture.wcs.referenceDimension;
  for (let i = 0; i < fixture.pixels.length; i++) {
    const [fx, fy] = fixture.pixels[i], uv = [(fx - .5) / width, (height + .5 - fy) / height];
    const tangent = mapping.tangentAtUv(uv[0], uv[1]); close(mapping.uvAtTangent(...tangent)!, uv);
    for (const z of [-10, 0, 10]) {
      const point = mapping.pointAtDepth(...tangent, z), reference = rotate(frame.localToReferenceXyzw, point)
        .map((value, axis) => value + frame.originM[axis] / frame.metersPerUnit);
      const norm = Math.hypot(...reference); close(reference.map(value => value / norm), fixture.expectedIcrsRays[i], 1e-12);
      close(mapping.tangentAtPoint(...point), tangent);
    }
  }
  assert.equal(mapping.uvAtTangent(mapping.boundsUnits.max[0] + 10, 0), null);
  assert.throws(() => mapping.pointAtDepth(0, 0, -mapping.distanceUnits), /observer/);
  const p = mapping.pointAtDepth(2, 3, 1), q = mapping.pointAtDepth(2, 3, 2);
  assert.ok(Math.abs(Math.hypot(...p.map((value, i) => value - q[i])) - mapping.rayPathPerDepth(2, 3)) < 1e-12);
});
test('prior samples perspective rays, decodes after interpolation, retains full depth and never mutates source', () => {
  const wcs: ImageWcs = { projection: 'TAN', coordinateFrame: 'ICRS', referenceDimension: [10, 10], referencePixel: [5.5, 5.5],
    referenceValueDeg: [0, 0], scaleDeg: [-.1, .1], rotationDeg: 0 };
  // Local z away = reference x, local x east = reference y, local y north = reference z.
  const frame: OverlayFrame = { referenceFrame: 'ICRS', epochJdTt: 2451545, originM: [10, 0, 0], metersPerUnit: 1,
    localToReferenceXyzw: [.5, .5, .5, .5] };
  const mapping = createObservationMapping(wcs, frame);
  assert.throws(() => createObservationMapping(wcs, { ...frame, localToReferenceXyzw: [.5, .5, -.5, -.5] }), /away from the observer/);
  const bytes = Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 255]);
  const source = { width: 2, height: 1, depth: 2, encodedRgba: bytes,
    recipe: { grid: { bounds: { min: [0, -1, -2], max: [4, 1, 2] }, encoding: 'sqrt-density-unorm8' } } } as VolumeSource;
  const snapshot = new Uint8Array(bytes);
  const result = reprojectObservationPrior(source, mapping, { dimensions: [1, 1, 2], boundsUnits: { min: [1, -.5], max: [3, .5] } });
  // Tangent x=2 becomes physical x=1.8 at z=-1 and x=2.2 at z=+1; grid-centre alpha is .4/.6, then squared.
  close([...result.density], [.16, .36], 1e-7);
  assert.deepEqual(result.boundsKpc.min, [1, -.5, -2]); assert.deepEqual(result.boundsKpc.max, [3, .5, 2]);
  assert.deepEqual(bytes, snapshot); assert.equal(result.diagnostics.sampledCells, 2);
  assert.throws(() => reprojectObservationPrior(source, mapping, { dimensions: [1, 1, 0] }), /integer/);
});
