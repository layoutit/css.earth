import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { BASE_TILE } from '@layoutit/polycss';
import { rasterAtlasLayout, rasterLeafStyle, retainedPhotographicAtlas } from '@cssearth/bake/objects/layers/terrestrial';
const test = sourceTest();

test('a retained atlas is the layout its leaves were written from, in atlas texels', () => {
  // A large face, a small one and a sliver, in source units (radial-terrain.test.mts).
  const faces = [[[0,0,0],[40,0,0],[0,30,0]], [[0,0,5],[4,0,5],[0,3,5]], [[0,0,9],[40,0,9],[20,1,9]]]
    .map(vertices => ({ vertices, normal: [0,0,1], vertexNormals: [[0,0,1],[0,0,1],[0,0,1]] }));
  const layout = rasterAtlasLayout(faces, 4096 * faces.length, 8);
  // The scene as the bake writes it (terrestrial/solid-scene.ts) and as a runtime's face nodes hold it.
  const surfaceTriangles = faces.map(face => face.vertices.map(v => [v[1]! * BASE_TILE, v[0]! * BASE_TILE, v[2]! * BASE_TILE]));
  const written = layout.plans.map(({ geometry, matrix }) => rasterLeafStyle({ ...geometry, matrix }));
  const drawn = written.map(style => style.replace('--polycss-atlas-width:', 'width:').replace('--polycss-atlas-height:', 'height:') + ';border-width:0 1px 2px');
  for (const styles of [written, drawn]) {
    const retained = retainedPhotographicAtlas({ surfaceTriangles, bodyLeaves: styles.map(style => ({ tag: 'u', style })) });
    assert.deepEqual([retained.width, retained.height], [layout.width, layout.height]);
    assert.equal(retained.plans.length, layout.plans.length);
    for (const [index, plan] of retained.plans.entries()) {
      const source = layout.plans[index]!;
      assert.deepEqual(plan.rect, source.rect, 'the rectangle, in atlas texels');
      // A style writes a negative zero as 0.
      assert.deepEqual(plan.matrix, source.matrix.map(value => value + 0), 'the matrix of the texel box');
      assert.deepEqual(plan.geometry, { leafWidth: source.geometry.leafWidth, leafHeight: source.geometry.leafHeight });
      assert.deepEqual(plan.face.vertices, faces[index]!.vertices);
    }
  }
});

test('a face that does not lie on its triangle is refused', () => {
  const faces = [[[0,0,0],[40,0,0],[0,30,0]], [[0,0,5],[4,0,5],[0,5,9]]].map(vertices => ({ vertices, normal: [0,0,1], vertexNormals: [[0,0,1],[0,0,1],[0,0,1]] }));
  const layout = rasterAtlasLayout(faces, 4096 * faces.length, 8);
  const surfaceTriangles = faces.map(face => face.vertices.map(v => [v[1]! * BASE_TILE, v[0]! * BASE_TILE, v[2]! * BASE_TILE]));
  const bodyLeaves = layout.plans.map(({ geometry, matrix }) => ({ tag: 'u', style: rasterLeafStyle({ ...geometry, matrix }) }));
  assert.equal(retainedPhotographicAtlas({ surfaceTriangles, bodyLeaves }).plans.length, 2);
  assert.throws(() => retainedPhotographicAtlas({ surfaceTriangles: [...surfaceTriangles].reverse(), bodyLeaves }), /Unsupported retained atlas layout|does not lie on its triangle/u);
});
