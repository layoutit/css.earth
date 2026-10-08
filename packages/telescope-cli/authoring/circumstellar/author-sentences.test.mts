import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { colorFact, edgeOnLimitations, edgeOnReading, parseCircumstellarRecipe } from './author.mts';

/** The record sentences the author writes by kind of image, checked against the records the repository tracks: a recipe that
 * names no archive image on the edge-on route, and every recipe's color fact, must come out as they were written before the
 * archive arm existed. The tracked records are the author's own earlier output, so this needs no image. */
const read = (id: string, name: string): unknown => JSON.parse(readFileSync(new URL(`../../../../src/objects/${id}/source/${name}`, import.meta.url), 'utf8'));
interface Provenance { limitations: string[]; models: Record<string, string>; measured: { datasets: Record<string, { bands: unknown[] }> } }
interface Presentation { datasets: { id: string; facts: { id: string; value: string }[] }[] }
const EXISTING = ['beta-pictoris-disc', 'eps-eridani-disc', 'fomalhaut-disc', 'hd-181327-disc', 'pds-70-disc'];

test('every tracked disc bank keeps the color fact its presentation holds', () => {
  for (const id of EXISTING) {
    const recipe = parseCircumstellarRecipe(read(id, 'circumstellar.json')), presentation = read(id, 'presentation.json') as Presentation;
    for (const dataset of recipe.datasets) {
      const tracked = presentation.datasets.find(entry => entry.id === dataset.id)?.facts.find(fact => fact.id === 'color')?.value;
      assert.equal(colorFact(dataset), tracked, `${id}/${dataset.id}`);
    }
  }
});

test('the edge-on bank without an archive image keeps its limitations and reading sentences byte for byte', () => {
  const recipe = parseCircumstellarRecipe(read('beta-pictoris-disc', 'circumstellar.json')), provenance = read('beta-pictoris-disc', 'provenance.json') as Provenance;
  assert.deepEqual(recipe.datasets.map(dataset => dataset.geometry), ['edge-on', 'edge-on', 'edge-on']);
  assert.deepEqual(edgeOnLimitations(recipe.datasets), provenance.limitations);
  for (const dataset of recipe.datasets) {
    const reading = edgeOnReading(dataset, provenance.measured.datasets[dataset.id]!.bands.length, '');
    assert.ok(provenance.models[dataset.id]!.startsWith(`Fitted edge-on disc. ${reading} The midplane is measured on the mean of the channels`), `${dataset.id}: ${reading.slice(0, 80)}`);
  }
});

test('an edge-on dataset that names an archive image is described as one, not as a coronagraph mosaic', () => {
  // Fomalhaut's tracked archive recipe, turned into an edge-on dataset shown through a stated stretch.
  const raw = read('fomalhaut-disc', 'circumstellar.json') as { datasets: Record<string, unknown>[] }, source = raw.datasets[0]!;
  const { colorMap: _colorMap, adoptPublishedRing: _adopt, planeThroughStar: _plane, taperInPlane: _taper, ...rest } = source;
  const recipe = parseCircumstellarRecipe({ ...raw, datasets: [{ ...rest, geometry: 'edge-on', stretch: { a: 10, top: 0.0005, source: 'Stated, not fitted.' } }] });
  const dataset = recipe.datasets[0]!, archive = dataset.archive!;
  const limitations = edgeOnLimitations(recipe.datasets), own = limitations.at(-1)!;
  assert.equal(own, `${dataset.id}: ${archive.limitation}`);
  assert.ok(!limitations.some(line => /MAST|coronagraphy|contrast to the star/u.test(line)));
  const reading = edgeOnReading(dataset, 1, '2015-12-30T00:00:00');
  assert.ok(reading.startsWith(`The archive image (${archive.title}) is read through its own WCS`));
  assert.match(reading, /catalogue position and proper motion put it on 2015-12-30T00:00:00\. 2 point sources \(star, SE\) are removed first/u);
  assert.match(reading, /smoothed to a 1\.56″ × 1\.15″ beam/u);
  assert.ok(reading.endsWith('it is not divided by the star, and the one band feeds every channel.'));
  assert.ok(!/TARG_RA|divided by the star's own flux/u.test(reading));
  assert.equal(colorFact(dataset), `Brightness only: one band (${archive.filter}) in every channel, in the archive image's ${archive.unit}`);
  // Without a stated limitation the dataset still says what its image is.
  const plain = parseCircumstellarRecipe({ ...raw, datasets: [{ ...rest, archive: (({ limitation: _limitation, ...kept }) => kept)(source.archive as Record<string, unknown>), geometry: 'edge-on', stretch: { a: 10, top: 0.0005, source: 'Stated, not fitted.' } }] });
  assert.match(edgeOnLimitations(plain.datasets).at(-1)!, /^dust: the ALMA 12-m array.* image is its archive’s product .*not the paper’s own, one band shown in every channel, brightness only\.$/u);
});
