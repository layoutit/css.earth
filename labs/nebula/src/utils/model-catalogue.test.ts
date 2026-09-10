import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { parseLabModelJson } from './model-paths.js';

const read = async (path: string) => parseLabModelJson(await readFile(path, 'utf8'));
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('the curated lab retains exactly the three selected images and closes both density banks', async () => {
  const ids = ['vista-infrared', 'horalek-widefield', 'wise-wide-infrared'];
  const subjects = await read('labs/nebula/src/subjects.json');
  assert.deepEqual(subjects.map((subject: {id: string}) => subject.id), ['lmc-clouds', 'smc-particles']);
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
  for (const subject of subjects) {
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
