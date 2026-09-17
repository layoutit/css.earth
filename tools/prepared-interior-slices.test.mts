import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rasterAtlasLayout } from './objects/terrestrial-layers/radial-terrain.mts';
import { fanQuads, INTERIOR_SLICE_NORMALS, interiorSliceLeaves, quadsIntersect } from './prepared-interior-slices.mts';

// An irregular closed body: a subdivided octahedron whose radius varies with direction, in source units.
function irregularBody() {
  const corners = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  let faces = [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]].map(face => face.map(i => corners[i]));
  const mid = (a: number[], b: number[]) => { const m = a.map((v, i) => (v + b[i]) / 2), l = Math.hypot(...m); return m.map(v => v / l); };
  for (let level = 0; level < 3; level++) faces = faces.flatMap(([a, b, c]) => { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); return [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]; });
  const radius = (p: number[]) => 100 * (1 + .35 * p[0] * p[0] - .25 * p[1] + .15 * Math.sin(3 * Math.atan2(p[1], p[2])));
  return faces.map(face => { const vertices = face.map(p => p.map(v => v * radius(p))); return { vertices, normal: [0, 0, 1], vertexNormals: vertices.map(() => [0, 0, 1]) }; });
}
const faces = irregularBody();
const styles = rasterAtlasLayout(faces as never, 256, 1, 0).plans.map(({ geometry: g }) =>
  `transform:matrix3d(${g.matrix});--polycss-atlas-width:${g.leafWidth}px;--polycss-atlas-height:${g.leafHeight}px`);

test('each view axis gets a slice of the body mesh whose leaf boxes clear every surface leaf box', () => {
  const slices = interiorSliceLeaves(styles);
  assert.equal(slices.length, INTERIOR_SLICE_NORMALS.length);
  const boxes = styles.map(style => {
    const m = /matrix3d\(([^)]*)\)/.exec(style)![1].split(',').map(Number), w = Number(/width:([\d.]+)px/.exec(style)![1]), h = Number(/height:([\d.]+)px/.exec(style)![1]);
    const p = (x: number, y: number) => [0, 1, 2].map(i => m[i] * x + m[4 + i] * y + m[12 + i]), c = [p(0, 0), p(w, 0), p(w, h), p(0, h)];
    return [[c[0], c[1], c[2]], [c[0], c[2], c[3]]];
  });
  for (const slice of slices) {
    assert.ok(slice.shrink > .3 && slice.shrink < 1, `a usable slice, shrunk inside the surface: ${slice.shrink}`);
    assert.ok(slice.matrices.length >= 8, 'one fan leaf per outline edge');
    for (const quad of fanQuads(slice.matrices)) assert.ok(!boxes.some(box => quadsIntersect(quad, box)), 'no slice box cuts a surface box');
    // Every fan leaf lies in its slice plane.
    for (const m of slice.matrices) assert.ok(Math.abs(slice.normal[0] * m[12] + slice.normal[1] * m[13] + slice.normal[2] * m[14]) < 1e-6);
  }
});

test('a surface whose leaves do not enclose the origin has no slice', () => {
  assert.throws(() => interiorSliceLeaves(styles.slice(0, styles.length / 2)), /one surface loop around the body origin/);
});
