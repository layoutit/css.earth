import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { parsePanelControls } from '../prepared-panel-content.mts';
import { parsePreparedPanelContent } from '@cssearth/objects';

type PanelContentInput = { schema: string; title: { label: unknown }; facts: { value: unknown }[] };
type PanelControlsInput = { datasets: { controls: Record<string, unknown>[] } };
const read = async (id: string, file: string): Promise<unknown> => JSON.parse(await readFile(new URL(`../../src/objects/${id}/prepared/${file}.json`, import.meta.url), 'utf8'));

test('scenes supply typed shared panel content and controls', async () => {
  // The parsers are the same for every scene; each object's content is checked when it is prepared.
  for (const id of ['earth', 'moon', 'saturn']) {
    const content = parsePreparedPanelContent(await read(id, 'content'));
    const controls = parsePanelControls(await read(id, 'controls'));
    assert.equal(content.objectId, id);
    const datasets = controls.datasets;
    if (datasets) assert.ok(datasets.controls.some(dataset => dataset.id === datasets.defaultDataset));
  }
});

test('unknown panel values are rejected before they can claim rendered field types', async () => {
  const rawContent = await read('earth', 'content');
  parsePreparedPanelContent(rawContent);
  const content = rawContent as PanelContentInput;
  const changes: readonly ((value: PanelContentInput) => void)[] = [value => { value.title.label = 7; }, value => { const fact = value.facts[0]; assert.ok(fact); fact.value = {}; }, value => { value.schema = 'unsupported'; }];
  for (const change of changes) {
    const invalid = structuredClone(content); change(invalid);
    assert.throws(() => parsePreparedPanelContent(invalid), TypeError);
  }
  const rawControls = await read('earth', 'controls');
  parsePanelControls(rawControls);
  const controls = rawControls as PanelControlsInput;
  Reflect.set(controls.datasets.controls[0], 'summary', 'Reader text published beside the controls.');
  assert.throws(() => parsePanelControls(controls), /carry reader text \(summary\)/);
});
