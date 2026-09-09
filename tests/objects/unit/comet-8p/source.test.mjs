import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { contactEllipsoidMesh, loadContactEllipsoids } from '../../../../tools/objects/terrestrial-layers/contact-ellipsoids.mjs';
import { simplifyRadialShape } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mjs';
import { parseVectors } from '../../../../packages/astronomy/tools/lib/horizons.mjs';
const root = new URL('../../../../src/planets/comet-8p/source/', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const near = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} vs ${expected}`);

test('Spitzer area scaling preserves the published HST lobe proportions and volume origin', async () => {
  const model = await json('shape/model.json'), mesh = contactEllipsoidMesh(model);
  // Independent anchors: Table 3 radii, gamma from section 5.3. Gamma scales flux/area.
  near(mesh.axesMeters[0][0], 2800 * Math.sqrt(.9), 1e-9);
  near(mesh.axesMeters[1][0], 1200 * Math.sqrt(.9), 1e-9);
  near(mesh.axesMeters[0][0] / mesh.axesMeters[1][0], 7 / 3, 1e-12);
  near(Math.hypot(mesh.axesMeters[0][0], mesh.axesMeters[1][0]) / 1000, 2.9, .05);
  const weights = mesh.axesMeters.map(a => a.reduce((p, n) => p * n, 1));
  near(mesh.centersMeters.reduce((sum, c, i) => sum + c * weights[i], 0) / weights.reduce((a,b) => a+b), 0, 1e-9);
  near(mesh.centersMeters[1] - mesh.centersMeters[0], mesh.axesMeters[0][0] + mesh.axesMeters[1][0], 1e-9);
  for (const bad of [{...model, fluxScale:0}, {...model, subdivisions:0}, {...model, lobes:[]}, {...model, origin:'assumed-arbitrary'}]) assert.throws(() => contactEllipsoidMesh(bad));
});

test('independent Spitzer vectors reproduce both published model aspect angles', async () => {
  const rows = parseVectors(await readFile(new URL('reference/horizons-spitzer.txt', root), 'utf8'));
  const d = Math.PI / 180, pole = [Math.cos(285*d)*Math.cos(20*d), Math.sin(285*d)*Math.cos(20*d), Math.sin(20*d)];
  assert.equal(rows.length, 2);
  for (const [i, row] of rows.entries()) {
    const aspect = Math.acos(-row.position.reduce((sum,n,k) => sum + n*pole[k],0) / Math.hypot(...row.position)) / d;
    near(aspect, [92,65][i], .5);
  }
});

test('native triangle reduction retains contact and stays within 50 m of the analytic spheres', async () => {
  const model = await json('shape/model.json'), config = await json('preparation/terrestrial.json');
  const analytic = contactEllipsoidMesh(model), profile = config.geometry.radialTerrain;
  const mesh = await loadContactEllipsoids(new URL('shape/model.json', root), profile.grid);
  const faces = await simplifyRadialShape(mesh, profile, 1);
  assert.ok(faces.length <= 1000);
  assert.ok(faces.some(f => f.vertices.some(v => Math.hypot(v[0]-analytic.contactXMeters,v[1],v[2]) < 1e-5)));
  for (const face of faces) {
    assert.ok(face.vertexNormals.flat().every(Number.isFinite));
    const samples = [...face.vertices, face.vertices[0].map((_,i) => face.vertices.reduce((s,v) => s+v[i],0)/3)];
    for (const p of samples) {
      const distance = Math.min(...analytic.centersMeters.map((x,i) => Math.abs(Math.hypot(p[0]-x,p[1],p[2])-analytic.axesMeters[i][0])));
      assert.ok(distance < 50, `analytic surface deviation ${distance} m`);
    }
  }
  assert.equal(faces.simplification.topology.eulerCharacteristic, 3); // two closed spheres sharing one point
});

test('delivered mesh retains the analytic surface and the model pole stays at a fixed phase', async () => {
  const config = await json('preparation/terrestrial.json');
  const terrain = JSON.parse(await readFile(new URL('../prepared/terrain.json', root), 'utf8'));
  const model = contactEllipsoidMesh(await json('shape/model.json'));
  const meters = config.geometry.radiusKm * 1000 / config.geometry.radius;
  const vertices = terrain.faces.flatMap(face => face.vertices.map(p => p.map(n => n * meters)));
  assert.equal(terrain.faces.length, 1000);
  assert.ok(vertices.some(p => Math.hypot(p[0] - model.contactXMeters, p[1], p[2]) < 1e-5));
  for (const p of vertices) {
    const distance = Math.min(...model.centersMeters.map((x, i) =>
      Math.abs(Math.hypot(p[0] - x, p[1], p[2]) - model.axesMeters[i][0])));
    assert.ok(distance < 1e-6, 'Delivered vertices remain on the published analytic spheres.');
  }
  const { readAuthoredRotation } = await import('../../../../tools/objects/authored-rotation.mjs');
  const descriptor = JSON.parse(await readFile(new URL('../object.json', root), 'utf8'));
  const reference = descriptor.properties.recipe.sources.find(s => s.id === 'rotation');
  const { fileURLToPath } = await import('node:url');
  const directory = fileURLToPath(new URL('../', root));
  const a = await readAuthoredRotation(directory, reference, 2461286.5);
  const b = await readAuthoredRotation(directory, reference, 2461316.5);
  assert.deepEqual(a, b);
  assert.equal(a.spinRateRadPerDay, 0);
  near(a.poleDeclinationRad, 20 * Math.PI / 180, 1e-12);
  near(a.poleRightAscensionRad, 285 * Math.PI / 180, 1e-12);
});
