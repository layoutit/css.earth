import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { OBJECTS } from '../objects.mjs';
import { validateDatasetText } from '../dataset-content.mjs';
import { datasetCaption } from '../dataset-caption.mjs';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('every registered dataset has a specific authored title, independent of category and source-link availability', async () => {
  for (const { id } of OBJECTS) {
    const titles = new Set();
    const root = `../../src/planets/${id}/`;
    const [descriptor, prepared, provenance] = await Promise.all([
      read(root + 'object.json'), read(root + 'prepared/controls.json'), read(root + 'prepared/provenance.json'),
    ]);
    const source = await read(root + descriptor.properties.recipe.sources.find(source => source.id === 'content').path);
    const authored = source.controls?.lenses?.controls ?? source.lenses.controls;
    for (const lens of prepared.lenses?.controls ?? []) {
      const original = authored.find(item => item.id === lens.id);
      const text = validateDatasetText(lens);
      assert.equal(text.title, original.title, `${id}/${lens.id}: category preparation changed title`);
      assert.equal(datasetCaption(provenance, lens).title, original.title);
      assert.equal(datasetCaption(undefined, lens).title, original.title);
      assert.ok(!titles.has(text.title), `${id}/${lens.id}: duplicate title within this object`);
      titles.add(text.title);
    }
  }
});

test('missing titles, category labels, paragraphs and repeated descriptions are rejected', () => {
  const lens = { id: 'radar', label: 'Radar', title: 'C3-MDIR radar mosaic', description: 'The radar images map the ground beneath the clouds.' };
  assert.equal(validateDatasetText(lens).title, lens.title);
  for (const title of [undefined, '', 'Radar', ' radar ', lens.description, 'x'.repeat(121)]) {
    assert.throws(() => validateDatasetText({ ...lens, title }), /specific dataset title/u);
  }
  assert.throws(() => validateDatasetText({ ...lens, description: '' }), /dataset description/u);
});
