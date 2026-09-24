import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { simplifyRadialTerrain } from './radial-mesh.mts';
const test = sourceTest();

const sample = (longitude: number, latitude: number) => {
  const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180;
  return 1 / Math.hypot(Math.cos(lat) * Math.cos(lon) / 3000, Math.cos(lat) * Math.sin(lon) / 2000, Math.sin(lat) / 1000);
};
const profile = { latitudeSegments: 32, longitudeSegments: 64, faceBudget: 1200,
  simplification: { method: 'meshoptimizer', targetFaces: 1200, maximumErrorMeters: 100 } };

test('meshoptimizer retains source positions and a closed welded surface within its budget', async () => {
  const { faces, report } = await simplifyRadialTerrain(sample, profile, .1);
  assert.ok(faces.length <= 1200 && faces.length > 0);
  assert.ok(report.estimatedErrorMeters <= 100);
  assert.equal(report.sourceFaces, 3968);
  assert.equal(report.sourceVertices, 1986, 'one shared vertex per seam/pole position');
  const edges = new Map(), vertices = new Set(), triangles = new Set();
  for (const face of faces) {
    const ids = face.vertices.map(vertex => {
      const [x,y,z] = vertex;
      assert.ok(Math.abs((x/300)**2+(y/200)**2+(z/100)**2-1)<1e-12, 'retained vertices remain on the independent analytic surface');
      const key = vertex.join(','); vertices.add(key); return key;
    });
    triangles.add([...ids].sort().join(';'));
    for (let i=0;i<3;i++) { const a=ids[i], b=ids[(i+1)%3], key=[a,b].sort().join(';');
      const edge=edges.get(key)??{count:0,winding:0};edge.count++;edge.winding+=a<b?1:-1;edges.set(key,edge); }
  }
  assert.equal(triangles.size, faces.length);
  assert.ok([...edges.values()].every(e=>e.count===2&&e.winding===0), 'every edge has two oppositely oriented incident triangles');
  assert.equal(vertices.size-edges.size+faces.length, 2);
});

test('meshoptimizer rejects a budget it cannot satisfy within the requested error', async () => {
  await assert.rejects(simplifyRadialTerrain(sample, {...profile, simplification:{...profile.simplification,targetFaces:4,maximumErrorMeters:1e-8}}, .1), /Meshoptimizer reached/);
  await assert.rejects(simplifyRadialTerrain(sample, {...profile, simplification:{...profile.simplification,targetFaces:2000}}, .1), /budget/);
});
