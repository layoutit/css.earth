import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { parseLabModelJson } from './model-paths.ts';

const read = async (path: string) => parseLabModelJson(await readFile(path, 'utf8'));
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('the curated lab retains the selected LMC images, SMC comparisons and verified density banks', async () => {
  const ids = ['vista-infrared', 'horalek-widefield', 'wise-wide-infrared'];
  const subjects = await read('labs/nebula/packages/lab/src/state/subjects.json');
  assert.deepEqual(subjects.map((subject: {id: string}) => subject.id), ['lmc-clouds', 'smc-particles', 'smc-vmc', 'smc-ellipsoid', 'smc-constrained', 'm2-9-inferred', 'helix-single-axis', 'helix-model-prior', 'm42', 'm8', 'carina', 'ngc6357', 'm78', 'horsehead', 'm45', 'omega-centauri', 'm1']);
  const experiment = subjects.find((subject: {id: string}) => subject.id === 'm2-9-inferred');
  assert.equal(experiment.density, undefined, 'An inferred-emission experiment must not masquerade as an independent density prior.');
  assert.equal(experiment.directory, experiment.emissionExperiment.directory);
  const experimentRecipe = await read('labs/nebula/models/m2-9/experiment.json');
  assert.equal(experimentRecipe.id, experiment.id);
  const helixFit = await read('labs/nebula/models/helix/single-axis.json');
  const helixModel = await read('labs/nebula/models/helix/model-prior.json');
  for (const key of ['source', 'nativeRemoval', 'grid', 'crop']) assert.deepEqual(helixFit[key], helixModel[key]);
  assert.deepEqual(helixFit.prior.center, helixModel.prior.center);
  assert.equal(helixFit.shapePrior, undefined);
  assert.ok(helixModel.shapePrior.components.length > 1);
  const lmc = subjects[0];
  assert.deepEqual(lmc.density.candidateImageIds, ids);
  const recipe = await read('labs/nebula/models/image-candidates.json');
  assert.deepEqual(recipe.targets.flatMap((target: any) => target.images.map((image: any) => image.id)), ids);
  const overlays = await read(lmc.density.overlays);
  assert.deepEqual(overlays.overlays.map((image: any) => image.id), ids);
  for (const image of overlays.overlays) {
    const bytes = await readFile(resolve(dirname(lmc.density.overlays), image.texturePath));
    assert.equal(digest(bytes), image.sha256);
  }
  const referencePin = lmc.density.starAlignmentReference;
  const referenceBytes = await readFile(referencePin.path);
  assert.equal(digest(referenceBytes), referencePin.sha256);
  const reference = JSON.parse(referenceBytes.toString());
  const stars = await read(lmc.stars);
  assert.deepEqual(reference.wcs, stars.provenance.footprint.wcs);
  assert.equal(reference.overlay.texturePath, undefined);
  assert.equal(stars.stars.length, 943);
  for (const subject of subjects.filter((item: { density?: unknown }) => item.density)) {
    assert.equal(subject.directory, subject.density.directory);
    assert.equal(subject.cloudParts, undefined);
    const descriptor = await read(subject.directory + '/object.json');
    const preparedPath = resolve(subject.directory, descriptor.prepared.url);
    const bytes = await readFile(preparedPath);
    assert.equal(digest(bytes), descriptor.prepared.sha256);
    for (const resource of JSON.parse(bytes.toString()).data.resources) {
      assert.equal(digest(await readFile(resolve(dirname(preparedPath), resource.path))), resource.sha256);
    }
  }
});
