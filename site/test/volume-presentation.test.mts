import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parsePreparedVolumePresentation } from '../volume-presentation.mts';
import type { ProvenanceDocument } from '../../src/platform/object-provenance.mts';

const ids = ['optical', 'infrared'];
const bank = { id: 'nebula', defaultLens: 'optical', lenses: ids.map(id => ({ id })) };
const digest = 'a'.repeat(64);
const provenance: Pick<ProvenanceDocument, 'objectId' | 'sources' | 'products'> = {
  objectId: 'nebula',
  sources: ids.map(id => ({ id, lensId: id, path: `source/${id}.jpg`, origin: 'https://example.test/image',
    sourceUrl: 'https://example.test/source', credit: 'Observatory', acquisition: 'Download', sha256: digest,
    bytes: 1, dependencies: [], verification: 'manifest-pin' })),
  products: ids.map(id => ({ id, lensIds: [id], label: id, process: 'Mapped observation', recipe: 'mapping',
    selector: '', recipeDependencies: ['mapping'], inputs: [id], parents: [], outputs: [] })),
};
const presentation = {
  schema: 'cssearth-volume-presentation@1', objectId: 'nebula', defaultLens: 'optical',
  controls: ids.map(id => ({ id, label: id, title: `Observed nebula in ${id}`, summary: 'Registered observation over the shared inferred field.',
    thumbnailUrl: `/scenes/nebula/${id}.webp`,
    texture: { url: `/scenes/nebula/${id}.webp`, width: 600, height: 400,
      attribution: { label: 'Observatory', url: 'https://example.test/source' } } })),
};

test('volume dataset cards preserve all prepared lens previews and explicit attribution', () => {
  const result = parsePreparedVolumePresentation(presentation, bank, provenance);
  assert.deepEqual(result.controls.map(lens => lens.id), ids);
  assert.deepEqual(result.controls.map(lens => {
    assert.ok(lens.texture);
    const { minimap: _minimap, ...preview } = lens.texture;
    return preview;
  }), presentation.controls.map(lens => lens.texture));
  assert.equal(result.defaultLens, bank.defaultLens);
});

test('volume dataset presentation rejects wrong owners, missing lenses and unbound sources', () => {
  assert.throws(() => parsePreparedVolumePresentation({ ...presentation, objectId: 'another' }, bank, provenance), /owner/);
  assert.throws(() => parsePreparedVolumePresentation({ ...presentation, controls: presentation.controls.slice(1) }, bank, provenance), /rendered lenses/);
  assert.throws(() => parsePreparedVolumePresentation({ ...presentation, defaultLens: 'infrared' }, bank, provenance), /rendered lenses/);
  assert.throws(() => parsePreparedVolumePresentation(presentation, bank, { ...provenance, sources: provenance.sources.slice(1) }), /provenance/);
  assert.throws(() => parsePreparedVolumePresentation(presentation, bank, { ...provenance, products: provenance.products.slice(1) }), /provenance/);
  const invalid = structuredClone(presentation); invalid.controls[0].texture.width = 0;
  assert.throws(() => parsePreparedVolumePresentation(invalid, bank, provenance), /preview/);
  assert.throws(() => parsePreparedVolumePresentation({ ...presentation, controls: [{ ...presentation.controls[0], texture: { url: 'a', width: 'bad', height: 1 } }, presentation.controls[1]] }, bank, provenance), /finite/);
});
