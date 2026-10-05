import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { parsePreparedVolumePresentation } from './volume-presentation.mts';

const ids = ['optical', 'infrared'];
const bank = { id: 'nebula', defaultDataset: 'optical', datasets: ids.map(id => ({ id })) };
/** Each dataset's own manifest input. */
const sources = ids.map(id => ({ datasetId: id }));
const presentation = {
  schema: 'cssearth-volume-presentation@2', objectId: 'nebula', defaultDataset: 'optical',
  controls: ids.map(id => ({ id, label: id, title: `Observed nebula in ${id}`, summary: 'Registered observation over the shared inferred field.',
    thumbnailUrl: `/scenes/nebula/${id}.webp`,
    texture: { url: `/scenes/nebula/${id}.webp`, width: 600, height: 400,
      attribution: { label: 'Observatory', url: 'https://example.test/source' } } })),
};

test('volume dataset cards preserve all prepared dataset previews and explicit attribution', () => {
  const result = parsePreparedVolumePresentation(presentation, bank, sources);
  assert.deepEqual(result.controls.map(dataset => dataset.id), ids);
  assert.deepEqual(result.controls.map(dataset => {
    assert.ok(dataset.texture);
    const { minimap: _minimap, ...preview } = dataset.texture;
    return preview;
  }), presentation.controls.map(dataset => dataset.texture));
  assert.equal(result.defaultDataset, bank.defaultDataset);
});

test('volume dataset presentation rejects wrong owners, missing datasets and unbound sources', () => {
  assert.throws(() => parsePreparedVolumePresentation({ ...presentation, objectId: 'another' }, bank, sources), /owner/);
  assert.throws(() => parsePreparedVolumePresentation({ ...presentation, controls: presentation.controls.slice(1) }, bank, sources), /rendered datasets/);
  assert.throws(() => parsePreparedVolumePresentation({ ...presentation, defaultDataset: 'infrared' }, bank, sources), /rendered datasets/);
  assert.throws(() => parsePreparedVolumePresentation(presentation, bank, sources.slice(1)), /dataset sources/);
  const invalid = structuredClone(presentation); invalid.controls[0].texture.width = 0;
  assert.throws(() => parsePreparedVolumePresentation(invalid, bank, sources), /preview/);
  assert.throws(() => parsePreparedVolumePresentation({ ...presentation, controls: [{ ...presentation.controls[0], texture: { url: 'a', width: 'bad', height: 1 } }, presentation.controls[1]] }, bank, sources), /finite/);
});
