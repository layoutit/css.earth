import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SCENE_OBJECTS } from '../objects.mts';
import { validateDatasetText } from '../dataset-content.mts';
import { parsePreparedText } from '../object-text.mts';
import { requireArray, requireRecord, requireString } from '../../tools/sources/source-values.mts';

const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('every registered dataset has a specific published title, independent of category and source-link availability', async () => {
  for (const { id } of SCENE_OBJECTS) {
    const root = `../../src/objects/${id}/`;
    const [rawControls, rawText] = await Promise.all([
      read(root + 'prepared/controls.json'), read(root + 'prepared/text.json'),
    ]);
    const lenses = requireRecord(rawControls).lenses;
    if (lenses === null || lenses === undefined) continue;
    const text = parsePreparedText(rawText, id);
    const titles = new Set<string>();
    for (const control of requireArray(requireRecord(lenses).controls).map(value => requireRecord(value))) {
      const lensId = requireString(control.id);
      const lens = { id: lensId, label: requireString(control.label), ...text.datasets[lensId] };
      const { title } = validateDatasetText(lens);
      assert.ok(!titles.has(title), `${id}/${lensId}: duplicate title within this object`);
      titles.add(title);
    }
  }
});

test('missing titles, category labels, repeated summaries and missing summaries are rejected', () => {
  const lens = { id: 'radar', label: 'Radar', title: 'C3-MDIR radar mosaic', summary: 'The radar images map the ground beneath the clouds.' };
  assert.equal(validateDatasetText(lens).title, lens.title);
  for (const title of [undefined, '', 'Radar', ' radar ', lens.summary, 'x'.repeat(121)]) {
    assert.throws(() => validateDatasetText({ ...lens, title }), /specific dataset title/u);
  }
  assert.throws(() => validateDatasetText({ ...lens, summary: '' }), /dataset summary/u);
});
