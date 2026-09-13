import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { readSourceDossier, selectObservationCandidates } from './source-dossier';
import { readObservations } from './model';
import { readObservationRecipe, scienceObservationSources } from '../observations/recipe';
import { publisherRegistration, publisherTransform } from '../observations/registration';

test('every new candidate has a source dossier and primary-paper context', async () => {
  for (const id of ['m45', 'm1', 'm8']) {
    const root = `labs/nebula/models/${id}`;
    const dossier = readSourceDossier(JSON.parse(await readFile(`${root}/source-dossier.json`, 'utf8')));
    const recipe = readObservationRecipe(JSON.parse(await readFile(`${root}/${id === 'm8' ? 'alignment-candidates' : 'observations'}.json`, 'utf8')));
    assert.equal(dossier.objectId, id);
    assert.deepEqual(dossier.images.map(r => r.id).sort(), scienceObservationSources(recipe).map(r => r.id).sort());
    assert.ok(dossier.papers.length >= 3);
    assert.ok(recipe.images.length >= 4);
    const invalid = JSON.parse(await readFile(`${root}/source-dossier.json`, 'utf8'));
    invalid.papers[0].url = 'javascript:alert(1)';
    assert.throws(() => readSourceDossier(invalid), /HTTPS/);
  }
});

test('curation preserves useful publisher-registered comparisons without upgrading their evidence', async () => {
  const expected: Record<string, string[]> = {
    m45: ['noirlab-optical', 'spitzer-irac', 'spitzer-irac-mips', 'wise-four-band', 'iau-usama-widefield', 'andreo-widefield'],
    m1: ['hubble-optical', 'webb-infrared', 'webb-components', 'spitzer-infrared', 'vla-radio', 'chandra-xray'],
    m8: ['eso-optical', 'eso-vista', 'spitzer-mid-infrared'],
  };
  for (const [id, ids] of Object.entries(expected)) {
    const dossier = readSourceDossier(JSON.parse(await readFile(`labs/nebula/models/${id}/source-dossier.json`, 'utf8')));
    assert.deepEqual(dossier.selection?.imageIds, ids);
    const recipe = readObservationRecipe(JSON.parse(await readFile(`labs/nebula/models/${id}/${id === 'm8' ? 'alignment-candidates' : 'observations'}.json`, 'utf8')));
    const data = readObservations({ schema: 'cssearth-nebula-observations@1', id, frame: recipe.frame,
      images: scienceObservationSources(recipe).map(image => ({ id: image.id, label: image.label, source: image,
        layers: { original: { path: `test/${image.id}.png`, width: image.width, height: image.height } },
        imageToFrame: [1, 0, 0, 1, 0, 0], registration: publisherRegistration('Test source') })) });
    // Real astrometry is exercised by browser-source-candidates; this boundary check needs no ignored images.
    data.images[0]!.registration.status = 'verified';
    const selected = selectObservationCandidates(data, dossier.selection);
    for (const image of selected.images) assert.equal(image.source.coordinateOrigin, recipe.images.find(source => source.id === image.id)!.coordinateOrigin);
    assert.deepEqual(selected.images.map(image => image.id), ids);
    for (const image of selected.images) assert.strictEqual(image, data.images.find(source => source.id === image.id), 'Selection must preserve the source, transform and evidence.');
    assert.equal(selected.images[1]!.registration.status, 'publisher');
    const missing = { ...data, images: data.images.filter(image => image.id !== ids[1]) };
    assert.throws(() => selectObservationCandidates(missing, dossier.selection), /not prepared/);
    assert.equal(data.images.length, scienceObservationSources(recipe).length, 'Excluded source records remain available.');
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

test('wide optical intake accepts a ten-degree TAN footprint without relaxing registration', async () => {
  const raw = JSON.parse(await readFile('labs/nebula/models/m45/observations.json', 'utf8'));
  const source = raw.images.find((image: { id: string }) => image.id === 'iau-usama-widefield');
  assert.ok(source.fieldArcminutes[0] > 360);
  source.fieldArcminutes[0] = 600;
  const recipe = readObservationRecipe(raw);
  const image = recipe.images.find(image => image.id === source.id)!;
  assert.equal(image.coordinateOrigin, 'authored-bright-star-seed');
  assert.ok(publisherTransform(image, recipe.frame).every(Number.isFinite));
  assert.equal(image.matchedStarCatalogue, undefined, 'A bright-star seed must not invent a qualified catalogue.');
  source.fieldArcminutes[0] = 600.001;
  assert.throws(() => readObservationRecipe(raw), /Unsupported small-field sky frame/);
});
