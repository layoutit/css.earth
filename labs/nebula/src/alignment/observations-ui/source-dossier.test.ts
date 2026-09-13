import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { readSourceDossier, selectObservationCandidates } from './source-dossier';
import { readObservations } from './model';
import { readObservationRecipe } from '../observations/recipe';
import { publisherRegistration } from '../observations/registration';

test('every new candidate has a source dossier and primary-paper context', async () => {
  for (const id of ['m45', 'm1', 'm8']) {
    const root = `labs/nebula/models/${id}`;
    const dossier = readSourceDossier(JSON.parse(await readFile(`${root}/source-dossier.json`, 'utf8')));
    const recipe = readObservationRecipe(JSON.parse(await readFile(`${root}/${id === 'm8' ? 'alignment-candidates' : 'observations'}.json`, 'utf8')));
    assert.equal(dossier.objectId, id);
    assert.deepEqual(dossier.images.map(r => r.id).sort(), recipe.images.map(r => r.id).sort());
    assert.ok(dossier.papers.length >= 3);
    assert.ok(recipe.images.length >= 4);
    const invalid = JSON.parse(await readFile(`${root}/source-dossier.json`, 'utf8'));
    invalid.papers[0].url = 'javascript:alert(1)';
    assert.throws(() => readSourceDossier(invalid), /HTTPS/);
  }
});

test('curation preserves useful publisher-registered comparisons without upgrading their evidence', async () => {
  const expected: Record<string, string[]> = {
    m45: ['noirlab-optical', 'spitzer-irac', 'spitzer-irac-mips', 'wise-four-band'],
    m1: ['hubble-optical', 'webb-infrared', 'webb-components', 'spitzer-infrared', 'vla-radio', 'chandra-xray'],
    m8: ['eso-optical', 'eso-vista', 'spitzer-mid-infrared'],
  };
  for (const [id, ids] of Object.entries(expected)) {
    const dossier = readSourceDossier(JSON.parse(await readFile(`labs/nebula/models/${id}/source-dossier.json`, 'utf8')));
    assert.deepEqual(dossier.selection?.imageIds, ids);
    const recipe = readObservationRecipe(JSON.parse(await readFile(`labs/nebula/models/${id}/${id === 'm8' ? 'alignment-candidates' : 'observations'}.json`, 'utf8')));
    const data = readObservations({ schema: 'cssearth-nebula-observations@1', id, frame: recipe.frame,
      images: recipe.images.map(image => ({ id: image.id, label: image.label, source: image,
        layers: { original: { path: `test/${image.id}.png`, width: image.width, height: image.height } },
        imageToFrame: [1, 0, 0, 1, 0, 0], registration: publisherRegistration('Test source') })) });
    // Real astrometry is exercised by browser-source-candidates; this boundary check needs no ignored images.
    data.images[0]!.registration.status = 'verified';
    const selected = selectObservationCandidates(data, dossier.selection);
    assert.deepEqual(selected.images.map(image => image.id), ids);
    for (const image of selected.images) assert.strictEqual(image, data.images.find(source => source.id === image.id), 'Selection must preserve the source, transform and evidence.');
    assert.equal(selected.images[1]!.registration.status, 'publisher');
    const missing = { ...data, images: data.images.filter(image => image.id !== ids[1]) };
    assert.throws(() => selectObservationCandidates(missing, dossier.selection), /not prepared/);
    assert.equal(data.images.length, 6, 'Excluded source records remain available.');
  }
});

test('publisher-only images carry no invented stellar measurements', async () => {
  const evidence = publisherRegistration('Nonstellar band.');
  assert.equal(evidence.status, 'publisher'); assert.equal(evidence.matchedStars, 0);
  assert.deepEqual(evidence.matches, []);
  const raw = JSON.parse(await readFile('labs/nebula/models/m45/observations.json', 'utf8'));
  const recipe = readObservationRecipe(raw);
  assert.equal(recipe.images.find(i => i.id === 'iris-far-infrared')?.registrationMode, 'publisher-wcs');
  raw.images[0].registrationMode = 'assume-verified';
  assert.throws(() => readObservationRecipe(raw), /Unknown registration mode/);
});
