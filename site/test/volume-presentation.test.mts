import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parsePreparedVolumePresentation } from '../volume-presentation.mts';

const ids = ['optical', 'infrared'];
const bank = { id: 'nebula', defaultLens: 'optical', lenses: ids.map(id => ({ id })) };
/** Each lens's own manifest input. */
const sources = ids.map(id => ({ lensId: id }));
const presentation = {
  schema: 'cssearth-volume-presentation@1', objectId: 'nebula', defaultLens: 'optical',
  controls: ids.map(id => ({ id, label: id, title: `Observed nebula in ${id}`, summary: 'Registered observation over the shared inferred field.',
    thumbnailUrl: `/scenes/nebula/${id}.webp`,
    texture: { url: `/scenes/nebula/${id}.webp`, width: 600, height: 400,
      attribution: { label: 'Observatory', url: 'https://example.test/source' } } })),
};

test('volume dataset cards preserve all prepared lens previews and explicit attribution', () => {
  const result = parsePreparedVolumePresentation(presentation, bank, sources);
  assert.deepEqual(result.controls.map(lens => lens.id), ids);
  assert.deepEqual(result.controls.map(lens => {
    assert.ok(lens.texture);
    const { minimap: _minimap, ...preview } = lens.texture;
    return preview;
  }), presentation.controls.map(lens => lens.texture));
  assert.equal(result.defaultLens, bank.defaultLens);
});

test('volume dataset presentation rejects wrong owners, missing lenses and unbound sources', () => {
  assert.throws(() => parsePreparedVolumePresentation({ ...presentation, objectId: 'another' }, bank, sources), /owner/);
  assert.throws(() => parsePreparedVolumePresentation({ ...presentation, controls: presentation.controls.slice(1) }, bank, sources), /rendered lenses/);
  assert.throws(() => parsePreparedVolumePresentation({ ...presentation, defaultLens: 'infrared' }, bank, sources), /rendered lenses/);
  assert.throws(() => parsePreparedVolumePresentation(presentation, bank, sources.slice(1)), /dataset sources/);
  const invalid = structuredClone(presentation); invalid.controls[0].texture.width = 0;
  assert.throws(() => parsePreparedVolumePresentation(invalid, bank, sources), /preview/);
  assert.throws(() => parsePreparedVolumePresentation({ ...presentation, controls: [{ ...presentation.controls[0], texture: { url: 'a', width: 'bad', height: 1 } }, presentation.controls[1]] }, bank, sources), /finite/);
});
