import {createHash} from 'node:crypto';
import {requireRecord} from '../../../../tools/sources/source-values.mts';
import {fileURLToPath} from 'node:url';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { contactEllipsoidMesh, loadContactEllipsoids } from '../../../../tools/objects/terrestrial-layers/contact-ellipsoids.mts';
import { simplifyRadialShape } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import { parseVectors } from '../../../../packages/astronomy/tools/lib/horizons.mts';
const root = new URL('../../../../src/objects/comet-8p/source/', import.meta.url);
const json = async (path: string|URL) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const near = (actual: number, expected: number, tolerance: number) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} vs ${expected}`);

test('each model product binds its own shape source without blending the alternative', async () => {
  const {provenanceProducts} = await import('../../../../tools/objects/provenance-recipes.mts');
  const document=provenanceProducts({id:'comet-8p',
    recipes:new Map([['terrestrial',{id:'terrestrial',path:'source/preparation/terrestrial.json',sha256:createHash('sha256').update(await readFile(new URL('preparation/terrestrial.json',root))).digest('hex'),parameters:requireRecord(await json('preparation/terrestrial.json'))}]]),
    manifest:await json('manifest.json'),lenses:(await json('content/object.json')).lenses,assets:{}});
  assert.deepEqual(required(document.products.find(p=>p.id==='model')).inputPaths,['material/neutral.png','shape/model.json']);
  assert.deepEqual(required(document.products.find(p=>p.id==='arecibo')).inputPaths,['material/arecibo-neutral.png','shape/arecibo.json']);
});

test('Arecibo retains the published dimensions without Spitzer rescaling', async () => {
  const model = await json('shape/arecibo.json'), mesh = contactEllipsoidMesh(model);
  assert.deepEqual(mesh.axesMeters, [[2875,2055,2055],[2125,1635,1635]]);
  near(2 * (mesh.axesMeters[0][0] + mesh.axesMeters[1][0]), 10000, 1e-9);
  near(mesh.axesMeters[0][0] / mesh.axesMeters[1][0], 1.35, .01);
  const recipe = await json('preparation/terrestrial.json');
  const profile = recipe.geometry.radialTerrainAlternatives.find((model: { lensId: string; }) => model.lensId === 'arecibo');
  const source = await loadContactEllipsoids(fileURLToPath(new URL('shape/arecibo.json', root)), profile.grid);
  const faces = await simplifyRadialShape(source, profile, 1);
  assert.equal(faces.length, 1000);
  assert.equal(requireRecord(required(faces.simplification).topology).eulerCharacteristic, 3);
  assert.ok(faces.some(face => face.vertices.some(p => Math.hypot(p[0]-mesh.contactXMeters,p[1],p[2]) < 1e-5)));
  for (const face of faces) {
    for (const p of [...face.vertices, face.vertices[0].map((_,axis) => face.vertices.reduce((sum,v) => sum+v[axis],0)/3)]) {
      const error = Math.min(...mesh.axesMeters.map((axes,i) => Math.abs(Math.hypot((p[0]-mesh.centersMeters[i])/axes[0],p[1]/axes[1],p[2]/axes[2])-1)*Math.max(...axes)));
      assert.ok(error < 75, `Analytic ellipsoid residual ${error} m`);
    }
  }
});

test('both source meshes stay separate in one retained scene', async () => {
  const { loadRadialModels, combineRadialModels } = await import('../../../../tools/objects/terrestrial-layers/radial-models.mts');
  const { createSourceManifest } = await import('../../../../src/platform/source-manifest.mts');
  const { fileURLToPath } = await import('node:url');
  const sourceDirectory = fileURLToPath(root), config = await json('preparation/terrestrial.json');
  const source = await createSourceManifest({ planetId:'comet-8p', planetName:'Tuttle', sourceRoot:sourceDirectory });
  const models = await loadRadialModels({ config, sourceDirectory, source });
  const scene = required(combineRadialModels(models, 'comet-8p'));
  assert.equal(scene.leaves.length,2000);
  assert.deepEqual(scene.lensRanges,[{lensId:'model',start:0,count:1000},{lensId:'arecibo',start:1000,count:1000}]);
  assert.deepEqual(scene.faces.slice(0,1000),Array.from(models[0].radial.faces));
  assert.deepEqual(scene.faces.slice(1000),Array.from(models[1].radial.faces));
  assert.ok(scene.leaves.slice(1000).every(leaf=>requireRecord(leaf.attributes)['data-surface-model']==='arecibo'));
});

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
  const mesh = await loadContactEllipsoids(fileURLToPath(new URL('shape/model.json', root)), profile.grid);
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
  assert.equal(requireRecord(required(faces.simplification).topology).eulerCharacteristic, 3); // two closed spheres sharing one point
});

test('delivered mesh retains the analytic surface and the model pole stays at a fixed phase', async () => {
  const config = await json('preparation/terrestrial.json');
  const terrain = JSON.parse(await readFile(new URL('../prepared/terrain.json', root), 'utf8'));
  const model = contactEllipsoidMesh(await json('shape/model.json'));
  const meters = config.geometry.radiusKm * 1000 / config.geometry.radius;
  const vertices = terrain.faces.flatMap((face: { vertices: number[][]; }) => face.vertices.map((p: number[]) => p.map((n: number) => n * meters)));
  assert.equal(terrain.faces.length, 1000);
  assert.ok(vertices.some((p: number[]) => Math.hypot(p[0] - model.contactXMeters, p[1], p[2]) < 1e-5));
  for (const p of vertices) {
    const distance = Math.min(...model.centersMeters.map((x, i) =>
      Math.abs(Math.hypot(p[0] - x, p[1], p[2]) - model.axesMeters[i][0])));
    assert.ok(distance < 1e-6, 'Delivered vertices remain on the published analytic spheres.');
  }
  const { readAuthoredRotation } = await import('../../../../tools/objects/authored-rotation.mts');
  const descriptor = JSON.parse(await readFile(new URL('../object.json', root), 'utf8'));
  const reference = descriptor.properties.recipe.sources.find((s: { id: string; }) => s.id === 'rotation');
  const { fileURLToPath } = await import('node:url');
  const directory = fileURLToPath(new URL('../', root));
  const a = await readAuthoredRotation(directory, reference, 2461286.5);
  const b = await readAuthoredRotation(directory, reference, 2461316.5);
  assert.deepEqual(a, b);
  assert.equal(a.spinRateRadPerDay, 0);
  near(a.poleDeclinationRad, 20 * Math.PI / 180, 1e-12);
  near(a.poleRightAscensionRad, 285 * Math.PI / 180, 1e-12);
});
