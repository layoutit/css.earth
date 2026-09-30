import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { SCENE_OBJECTS } from '../objects.mts';
import { authoredDatasetMetadata, parsePreparedPanelContent, parsePanelControls } from '../prepared-panel-content.mts';

type PanelContentInput = { schema: string; title: { label: unknown }; facts: { value: unknown }[] };
type PanelControlsInput = { datasets: { controls: Record<string, unknown>[] } };
const read = async (id: string, file: string): Promise<unknown> => JSON.parse(await readFile(new URL(`../../src/objects/${id}/prepared/${file}.json`, import.meta.url), 'utf8'));

test('dataset source links come from the authored dataset records', async () => {
  const source: unknown = JSON.parse(await readFile(new URL('../../src/objects/earth/source/content/object.json', import.meta.url), 'utf8'));
  const { sourceUrls: urls } = authoredDatasetMetadata(source, 'earth');
  assert.equal(urls.get('normal'), 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x21600x10800.jpg');
  assert.equal(urls.get('clouds'), 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif');
  assert.throws(() => authoredDatasetMetadata(source, 'mars'), /metadata owner differs/u);
});

test('a dataset without a direct source link is omitted from source URLs', async () => {
  const source: unknown = JSON.parse(await readFile(new URL('../../src/objects/sun/source/content/object.json', import.meta.url), 'utf8'));
  const { sourceUrls: urls, systemDatasetIds } = authoredDatasetMetadata(source, 'sun');
  assert.equal(urls.get('cor1-density'), undefined);
  assert.ok(urls.get('photosphere'));
  assert.equal(systemDatasetIds.has('cor1-density'), false, 'the corona belongs to the Sun card');
});

test('Betelgeuse atmosphere volumes remain on its body card', async () => {
  const source: unknown = JSON.parse(await readFile(new URL('../../src/objects/betelgeuse/source/content/object.json', import.meta.url), 'utf8'));
  assert.equal(authoredDatasetMetadata(source, 'betelgeuse').systemDatasetIds.size, 0);
});

test('debris discs stay with their host system card', async () => {
  for (const [id, datasets] of [
    ['beta-pictoris', ['debris-disc-visible', 'debris-disc-colour', 'debris-disc']],
    ['hd-181327', ['debris-ring']],
    ['pds-70', ['dust-ring']],
  ] as const) {
    const source: unknown = JSON.parse(await readFile(new URL(`../../src/objects/${id}/source/content/object.json`, import.meta.url), 'utf8'));
    const { systemDatasetIds } = authoredDatasetMetadata(source, id);
    assert.deepEqual([...systemDatasetIds], datasets);
  }
});

test('every registered scene supplies typed shared panel content and controls', async () => {
  for (const { id } of SCENE_OBJECTS) {
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
