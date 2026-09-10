import { requireRecord, requireArray, requireString } from '../../tools/source-values.mts';
import {parse, object, array, optional, string} from '../../tools/objects/material-composition/data-schema.mts';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { OBJECTS } from '../objects.mts';
import { validateDatasetText } from '../dataset-content.mts';
import { datasetCaption } from '../dataset-caption.mts';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';

const datasets = (value: unknown) => parse(value, array(object({id: string, title: optional(string), label: optional(string), summary: optional(string), description: optional(string)})), 'dataset controls');
const lenses = (value: unknown) => {
  const controls = requireRecord(value);
  return controls.lenses === undefined ? [] : datasets(requireRecord(controls.lenses).controls);
};
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('every registered dataset has a specific authored title, independent of category and source-link availability', async () => {
  for (const { id } of OBJECTS) {
    const titles = new Set();
    const root = `../../src/planets/${id}/`;
    const [rawDescriptor, rawPrepared, rawProvenance] = await Promise.all([
      read(root + 'object.json'), read(root + 'prepared/controls.json'), read(root + 'prepared/provenance.json'),
    ]);
    const descriptor = requireRecord(rawDescriptor);
    const recipe = requireRecord(requireRecord(descriptor.properties).recipe);
    const sources = requireArray(recipe.sources).map(value => requireRecord(value));
    const prepared = lenses(rawPrepared);
    const provenance = validateObjectProvenance(rawProvenance, id);
    const contentReference = sources.find(source => source.id === 'content');
    assert.ok(contentReference, `${id}: content source reference`);
    const source = requireRecord(await read(root + requireString(contentReference.path)));
    const staticControls = source.controls === undefined ? undefined : requireRecord(source.controls);
    const authored = lenses(staticControls?.lenses === undefined ? source : staticControls);
    for (const lens of prepared) {
      const original = authored.find(item => item.id === lens.id);
      assert.ok(original, `${id}/${lens.id}: prepared dataset has no authored control`);
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
