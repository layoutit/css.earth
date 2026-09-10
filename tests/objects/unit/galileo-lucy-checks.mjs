import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../src/platform/source-manifest.mjs';
import { loadRadialTerrain } from '../../../tools/objects/terrestrial-layers/radial-terrain.mjs';
import { contactEllipsoidMesh } from '../../../tools/objects/terrestrial-layers/contact-ellipsoids.mjs';
import { ellipsoidParameterMesh } from '../../../tools/objects/terrestrial-layers/ellipsoid-parameters.mjs';
import { preparePlanetarySystem } from '../../../src/platform/prepare-planetary-system.mjs';
import { prepareEclipticPresentationFrame } from '../../../src/platform/solar-presentation-frame.mjs';

export function checkGalileoLucy(id) {
  const sourceDirectory = resolve('src/planets', id, 'source');
  const read = async path => JSON.parse(await readFile(resolve(sourceDirectory, path)));
  test(`${id}: source closure and representation are consistent`, async () => {
    const source = await createSourceManifest({ planetId: id, planetName: id, sourceRoot: sourceDirectory });
    await source.verify();
    const config = await read('preparation/terrestrial.json'), model = await read('shape/model.json');
    const radial = await loadRadialTerrain({ config, sourceDirectory, source });
    assert.equal(radial.faces.length, id === 'dactyl' ? 512 : id === 'selam' ? 1024 : 1200);
    assert.equal(config.raster.observations.length, 0, 'unregistered photography must not be presented as observed coverage');
    if (id === 'dactyl') {
      assert.deepEqual(ellipsoidParameterMesh(model).axesMeters, [800, 700, 600]);
    } else if (id === 'selam') {
      const mesh = contactEllipsoidMesh(model);
      assert.deepEqual(mesh.axesMeters, [[120, 100, 100], [140, 110, 105]]);
      assert(Math.abs(mesh.centersMeters[1] - 140 - mesh.contactXMeters) < 1e-10);
      const ratio = (120 * 100 * 100) / (140 * 110 * 105);
      assert(Math.abs(mesh.centersMeters[0] * ratio + mesh.centersMeters[1]) < 1e-10, 'equal-density origin must be the two-lobe volume centroid');
    } else {
      assert.equal(model.sourceSha256, '8dc8a6d9fc9f4138cfc44f896ca7732fdfdd9d44b10d6fb49fd43f80fa2e1b2f');
      assert.equal(model.sourceFaces - model.omittedZeroAreaSourceFaceIndices.length, model.faces);
      assert(Math.abs(model.volumeEquivalentRadiusKm - .369) < 1e-12);
      assert.match(model.meaning, /Authored reconstruction/);
    }
    const content = await read('content/object.json');
    assert(content.lenses.controls.every(control => control.detail.length <= 7));
  });
  if (id !== 'dinkinesh') test(`${id}: parent brightness and approximate placement are complete`, async () => {
    const config = await read('preparation/terrestrial.json');
    const system = await preparePlanetarySystem({ bodyId: id, presentationFrame: prepareEclipticPresentationFrame(id), kilometersPerUnit: config.geometry.radiusKm / config.geometry.radius });
    const parent = system.bodies.find(body => body.id === (id === 'dactyl' ? 'ida' : 'dinkinesh'));
    assert(parent.pointPresentation.samples.every(Number.isFinite));
    assert.equal(parent.illumination.geometricAlbedo, id === 'dactyl' ? .262 : .27);
    const world = JSON.parse(await readFile('src/planets/sun/prepared/world-context.json'));
    const context = world.bodies.find(body => body.id === id);
    assert.equal(context.placement, 'approximate');
    assert.equal(context.orbit.centerBodyId, parent.id);
    assert.match((await read('content/object.json')).panel.introduction, /Approximate orbital placement/);
  });
}
