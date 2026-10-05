import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDatasetControl, parsePanelControls, withDatasetText, uniformDatasetColors } from './prepared-panel-content.mts';
const dataset = { id: 'normal', label: 'Visible', title: 'Cloud map', summary: 'Cloud bands.', thumbnailUrl: '/preview.webp' };
test('dataset text joins overwrite published title and summary without erasing optional control fields', () => {
  assert.equal(withDatasetText(undefined, {}), undefined);
  const controls = { title: { label: 'Datasets', src: '/title.svg', width: 10, height: 4 }, defaultDataset: 'normal', controls: [{ id: 'normal', label: 'Visible', thumbnailUrl: '/x', noData: true }] };
  assert.deepEqual(withDatasetText(controls, { normal: { title: 'Cloud map', summary: 'Cloud bands.' } })?.controls[0], { ...controls.controls[0], title: 'Cloud map', summary: 'Cloud bands.' });
  assert.equal(withDatasetText(controls, { normal: { title: 'Map', summary: 'Bands.', detail: 'Published detail' } })?.controls[0].detail, 'Published detail');
  assert.throws(() => withDatasetText(controls, {}), /Dataset normal has no published reader text/);
});
test('uniform datasets publish lowercase colors and reject missing or malformed billboard colors', () => {
  assert.deepEqual([...uniformDatasetColors(undefined, undefined, 'star')], []);
  assert.deepEqual([...uniformDatasetColors({}, undefined, 'star')], []);
  const raster = { surfaces: [{ id: 'normal', science: { kind: 'stellar-photometric-color' } }, { id: 'other' }, { id: 'map', science: { kind: 'image' } }] };
  assert.deepEqual([...uniformDatasetColors(raster, { controls: [{ id: 'normal', billboardColor: '#AbCdEf' }] }, 'star')], [['normal', '#abcdef']]);
  for (const controls of [[{ id: 'normal', billboardColor: '#abcdef trailing' }], [], [{ id: 'normal', billboardColor: '#fff' }], [{ id: 'normal', billboardColor: null }]]) assert.throws(() => uniformDatasetColors(raster, { controls }, 'star'), /expected a #rrggbb color for a uniform surface/);
});
test('dataset preview, facts and both legend shapes retain their public values', () => {
  const parsed = parseDatasetControl({ ...dataset, description: 'Description', detail: 'Detail', texture: { url: '/x', width: 2, height: 3, minimap: { ready: true }, attribution: { label: 'Observatory' } }, facts: [{ id: 'fact', label: 'Size', value: '2' }], legend: [{ label: 'Cloud', color: '#fff' }] });
  assert.equal(parsed.description, 'Description');
  assert.deepEqual(parsed.texture?.minimap, { ready: true });
  assert.deepEqual(parsed.facts, [{ id: 'fact', label: 'Size', value: '2' }]);
  assert.equal(parsed.texture?.attribution?.label, 'Observatory');
  assert.deepEqual(parsed.legend?.items, [{ label: 'Cloud', description: '', color: '#fff' }]);
  assert.equal(parsed.legend?.title, 'Visible');
  const scale = parseDatasetControl({ ...dataset, legend: { kind: 'scale', title: 'Temperature', width: 2, height: 3, colors: ['#fff'], labels: ['High'], items: [{ label: 'Hot', color: '#f00', description: 'High temperature' }] } });
  assert.equal(scale.legend?.width, 2);
  assert.deepEqual(scale.legend?.labels, ['High']);
  assert.equal(scale.legend?.items?.[0].description, 'High temperature');
  assert.throws(() => parseDatasetControl({ ...dataset, legend: { kind: 'invalid' } }), /legend kind is invalid/);
});
test('panel dataset controls retain volume and step switches while rejecting reader prose', () => {
  const title = { label: 'Datasets', src: '/title.svg', width: 10, height: 4 };
  const control = { id: 'normal', label: 'Visible', thumbnailUrl: '/x', noData: false, texture: { url: '/x', width: 1, height: 2, attribution: { label: 'Credit', url: 'https://x.test' } }, volume: { objectId: 'cloud', datasetId: 'optical', surface: 'normal' }, step: { group: 'time', label: 'Epoch', autoplay: false, opens: 'last' } };
  const input = { settings: null, datasets: { title, defaultDataset: 'normal', controls: [control] } };
  const result = parsePanelControls(input);
  assert.deepEqual(result.datasets?.controls[0].step, control.step);
  assert.deepEqual(result.datasets?.controls[0].volume, control.volume);
  assert.equal(result.datasets?.controls[0].noData, false);
  assert.equal(parsePanelControls({ ...input, datasets: { ...input.datasets, controls: [{ ...control, step: { ...control.step, opens: 'first' } }] } }).datasets?.controls[0].step?.opens, 'first');
  assert.throws(() => parsePanelControls({ ...input, datasets: { ...input.datasets, controls: [{ ...control, step: { ...control.step, opens: 'middle' } }] } }), /step opens must be/);
  assert.throws(() => parsePanelControls({ ...input, datasets: { ...input.datasets, controls: [{ ...control, description: '' }] } }), /carry reader text \(description\)/);
});
test('null datasets and empty settings retain absent-panel output', () => {
  assert.deepEqual(parsePanelControls({ datasets: null, settings: null }), { datasets: undefined, settings: undefined });
});
