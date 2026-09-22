import {required} from '../../../tools/contract/test-values.mts';
import { sourceTest } from '../source-test.mts';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import { loadRadialTerrain } from '../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import { contactEllipsoidMesh } from '../../../tools/objects/terrestrial-layers/contact-ellipsoids.mts';
import { ellipsoidParameterMesh } from '../../../tools/objects/terrestrial-layers/ellipsoid-parameters.mts';

export function checkGalileoLucy(id: string) {
  const test = sourceTest(id);
  const sourceDirectory = resolve('src/objects', id, 'source');
  const read = async (path: string) => JSON.parse((await readFile(resolve(sourceDirectory, path))).toString('utf8'));
  test(`${id}: source closure and representation are consistent`, async () => {
    const source = await createSourceManifest({ planetId: id, planetName: id, sourceRoot: sourceDirectory });
    await source.verify();
    const config = await read('preparation/terrestrial.json'), model = await read('shape/model.json');
    const radial = required(await loadRadialTerrain({ config, sourceDirectory, source }));
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
      assert.equal(model.sourceFaces - model.omittedZeroAreaSourceFaceIndices.length, model.faces);
      assert(Math.abs(model.volumeEquivalentRadiusKm - .369) < 1e-12);
      assert.match(model.meaning, /Authored reconstruction/);
    }
    // Reader copy lives in text.json beside the package, outside the pinned source tree.
    const text = await read('../text.json');
    assert(Object.values(text.datasets as Record<string, {detail:string}>).every(dataset => dataset.detail.length <= 7));
  });
  if (id !== 'dinkinesh') test(`${id}: approximate placement around its parent is complete`, async () => {
    const world = JSON.parse((await readFile('src/objects/sun/prepared/world-context.json')).toString('utf8'));
    const context = world.bodies.find((body: { id: string; }) => body.id === id);
    assert.equal(context.placement, 'approximate');
    assert.equal(context.orbit.centerBodyId, id === 'dactyl' ? 'ida' : 'dinkinesh');
    // The reader summary of the shape dataset carries the placement caveat since the text pipeline.
    assert.match((await read('../text.json')).datasets.shape.summary, /position is approximate/);
  });
}
