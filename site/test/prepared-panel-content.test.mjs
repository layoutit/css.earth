import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { OBJECTS } from '../objects.mts';
import { parsePreparedPanelContent, parsePanelControls } from '../prepared-panel-content.mts';
const read = async (id, file) => JSON.parse(await readFile(new URL(`../../src/planets/${id}/prepared/${file}.json`, import.meta.url), 'utf8'));

test('every registered object supplies typed shared panel content and controls', async () => {
  for (const { id } of OBJECTS) {
    const content = parsePreparedPanelContent(await read(id, 'content'));
    const controls = parsePanelControls(await read(id, 'controls'));
    assert.equal(content.objectId, id);
    if (controls.lenses) assert.ok(controls.lenses.controls.some(lens => lens.id === controls.lenses.defaultLens));
  }
});

test('unknown panel values are rejected before they can claim rendered field types', async () => {
  const content = await read('earth', 'content');
  for (const change of [value => { value.title.baseline = 'bad'; }, value => { value.facts[0].value = {}; }, value => { value.schema = 'unsupported'; }]) {
    const invalid = structuredClone(content); change(invalid);
    assert.throws(() => parsePreparedPanelContent(invalid), TypeError);
  }
  const controls = await read('earth', 'controls');
  controls.lenses.controls[0].description = null;
  assert.throws(() => parsePanelControls(controls), /lens description/);
});
