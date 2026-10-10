import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { isScratchSourcePath, parseVolumeSourcePreview, scratchSourceCachePath } from './volume-presentation-source.js';
import { VOLUME_SOURCE_MANIFEST_SCHEMA, parseVolumeSourceManifest, parseVolumeContextProducts } from './volume-source-manifest.js';

const manifest = { schema: VOLUME_SOURCE_MANIFEST_SCHEMA, pathBase: 'repository', inputs: 'owner-read' };
const product = { id: 'optical', label: 'Optical', inputs: ['image'], limitations: ['Inferred depth'], interpretation: { kind: 'observed', sourceKind: 7 } };

test('volume preview contract preserves all historically admitted kinds and cached authoredFrom omission', () => {
  for (const preview of [
    { path: 'source/image.png', url: 'https://example.test/image.png' },
    { path: 'source/image.png', authoredFrom: 'image', crop: { left: 0, top: 1, width: 2, height: 3 } },
    { path: '.local/image.png', skyBands: { path: 'source/bands.json' } },
  ]) assert.deepEqual(parseVolumeSourcePreview(preview), preview);
  assert.deepEqual(parseVolumeSourcePreview({ path: '.local/image.png', authoredFrom: 123 }), { path: '.local/image.png' });
});

test('an object\'s own .local/ is scratch like the shared one, and is mirrored under objects/<id>/', () => {
  const preview = { path: 'src/objects/lmc-volume/.local/new-references/iotw2547a.jpg', url: 'https://example.test/image.jpg' };
  assert.deepEqual(parseVolumeSourcePreview(preview), preview);
  assert.deepEqual(parseVolumeSourcePreview({ path: 'src/objects/m2-9-volume/.local/bands.png', skyBands: { path: 'source/bands.json' } }), { path: 'src/objects/m2-9-volume/.local/bands.png', skyBands: { path: 'source/bands.json' } });
  for (const path of ['.local/nebula-lab/a.jpg', 'src/objects/lmc-volume/.local/a.jpg']) assert.equal(isScratchSourcePath(path), true);
  for (const path of ['src/objects/lmc-volume/source/a.jpg', 'src/objects/.local/a.jpg', 'labs/.local/a.jpg']) assert.equal(isScratchSourcePath(path), false);
  assert.equal(scratchSourceCachePath('.local/nebula-lab/a.jpg'), 'nebula-lab/a.jpg');
  assert.equal(scratchSourceCachePath('src/objects/lmc-volume/.local/new-references/a.jpg'), 'objects/lmc-volume/new-references/a.jpg');
  assert.throws(() => scratchSourceCachePath('src/objects/lmc-volume/source/a.jpg'), { message: 'Not a scratch path: src/objects/lmc-volume/source/a.jpg' });
});

test('volume preview rejection diagnostics retain discriminator and crop ordering', () => {
  assert.throws(() => parseVolumeSourcePreview({ path: 'source/image.png' }), { message: 'A preview names exactly one of a URL, a sky band recipe or the input it is drawn from.' });
  assert.throws(() => parseVolumeSourcePreview({ path: 'source/image.png', skyBands: {} }), { message: 'A tracked preview names its URL or the input it is drawn from.' });
  assert.throws(() => parseVolumeSourcePreview({ path: '.local/image.png', url: 'https://example.test/x', crop: { left: -1 } }), { message: 'Invalid crop offset.' });
  assert.throws(() => parseVolumeSourcePreview({ path: '.local/image.png', url: 'https://example.test/x', crop: { left: 0, top: 0, width: 0 } }), { message: 'Expected a positive integer.' });
});

test('manifest subsets preserve opaque collections, non-volume restoration and exact diagnostics', () => {
  for (const reader of ['restoration', 'context', 'presentation'] as const)
    assert.equal(parseVolumeSourceManifest(manifest, { reader, objectId: 'nebula' }), manifest);
  assert.equal(parseVolumeSourceManifest({ schema: 'other' }, { reader: 'restoration', objectId: 'nebula' }), null);
  for (const [reader, message] of [
    ['restoration', 'Invalid repository volume source manifest: nebula.'],
    ['context', 'Invalid context manifest: nebula'],
    ['presentation', 'Invalid volume source manifest: nebula.'],
  ] as const) assert.throws(() => parseVolumeSourceManifest({ ...manifest, pathBase: 'object' }, { reader, objectId: 'nebula' }), { message });
});

test('context product parser preserves optional interpretation and admitted unknown fields', () => {
  assert.deepEqual(parseVolumeContextProducts([{ ...product, extra: true }]), [{ ...product, parents: [], datasetIds: [], observationAttribution: 'none', interpretation: { kind: 'observed' } }]);
  assert.throws(() => parseVolumeContextProducts([{ ...product, interpretation: null }]), { message: 'Expected a source record.' });
});

test('volume consumers retain one shared parser call and cannot redeclare moved parsing', () => {
  const source = (path: string) => readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8');
  const preview = source('site/build/prepare/catalog/prepare-volume-presentation.mts');
  assert.match(preview, /parseVolumePresentationSource\(raw\)/u);
  assert.match(source('packages/objects/src/prepared-data/source/volume-presentation-source.ts'), /preview: parseVolumeSourcePreview\(dataset\.preview\)/u);
  assert.doesNotMatch(preview, /function preview\(|\['path', 'url', 'skyBands', 'authoredFrom', 'crop'\]/u);
  const context = source('packages/bake/src/sources/context-source-records.ts');
  assert.match(context, /const products = parseVolumeContextProducts\(presentation\.products\)/u);
  assert.doesNotMatch(context, /sourceArray\(presentation\.products/u);
  for (const path of ['site/build/prepare/catalog/prepare-volume-presentation.mts', 'packages/bake/src/sources/context-source-records.ts', 'packages/bake/src/asset-publication/restore-source-inputs.ts']) {
    const text = source(path);
    assert.match(text, /parseVolumeSourceManifest\([^;]+reader:/u);
    assert.doesNotMatch(text, /manifest\.pathBase/u);
  }
});

test('presentation-source policy validates fields and input records without tightening other readers', () => {
  const options = { reader: 'presentation', objectId: 'nebula', policy: 'presentation-source' } as const;
  const valid = { ...manifest, inputs: [], documents: [] };
  assert.equal(parseVolumeSourceManifest(valid, options), valid);
  assert.throws(() => parseVolumeSourceManifest({ ...valid, extra: true }, options), { message: 'Unexpected volume source manifest field: extra.' });
  assert.throws(() => parseVolumeSourceManifest(manifest, options));
  assert.throws(() => parseVolumeSourceManifest({ ...valid, inputs: [null] }, options));
  assert.throws(() => parseVolumeSourceManifest({ ...valid, pathBase: 'object' }, options), { message: 'Invalid volume source manifest: nebula.' });
});
