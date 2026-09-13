import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { readSourceDossier } from './source-dossier';
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
