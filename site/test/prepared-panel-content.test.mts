import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { SCENE_OBJECTS } from '../objects.mts';
import { parsePreparedPanelContent, parsePanelControls } from '../prepared-panel-content.mts';

type PanelContentInput = { schema: string; title: { baseline: unknown }; facts: { value: unknown }[] };
type PanelControlsInput = { lenses: { controls: Record<string, unknown>[] } };
const read = async (id: string, file: string): Promise<unknown> => JSON.parse(await readFile(new URL(`../../src/objects/${id}/prepared/${file}.json`, import.meta.url), 'utf8'));

test('every registered scene supplies typed shared panel content and controls', async () => {
  for (const { id } of SCENE_OBJECTS) {
    const content = parsePreparedPanelContent(await read(id, 'content'));
    const controls = parsePanelControls(await read(id, 'controls'));
    assert.equal(content.objectId, id);
    const lenses = controls.lenses;
    if (lenses) assert.ok(lenses.controls.some(lens => lens.id === lenses.defaultLens));
  }
});

test('unknown panel values are rejected before they can claim rendered field types', async () => {
  const rawContent = await read('earth', 'content');
  parsePreparedPanelContent(rawContent);
  const content = rawContent as PanelContentInput;
  const changes: readonly ((value: PanelContentInput) => void)[] = [value => { value.title.baseline = 'bad'; }, value => { const fact = value.facts[0]; assert.ok(fact); fact.value = {}; }, value => { value.schema = 'unsupported'; }];
  for (const change of changes) {
    const invalid = structuredClone(content); change(invalid);
    assert.throws(() => parsePreparedPanelContent(invalid), TypeError);
  }
  const rawControls = await read('earth', 'controls');
  parsePanelControls(rawControls);
  const controls = rawControls as PanelControlsInput;
  Reflect.set(controls.lenses.controls[0], 'summary', 'Reader text published beside the controls.');
  assert.throws(() => parsePanelControls(controls), /carry reader text \(summary\)/);
});
