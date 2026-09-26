import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSourceManifest } from '@cssearth/objects/node';
import { parseSourceManifest } from '#preparation/source-files';

// The preparation tools read source manifests with their own parser (tools/objects/source-files.ts); it must agree with the
// package's validator on what a document and a generated intermediate need.
test('document descriptions are optional without weakening generator identity, in both manifest parsers', () => {
  const base = {
    schema: 'cssearth-authoritative-sources@2',
    inputs: [{ id: 'source', path: 'input/source.txt', origin: 'https://example.test/source.txt', credit: 'Fixture authority',
      license: 'Fixture license', acquisition: 'Fixture acquisition', redistribution: 'Fixture redistribution',
      sourceBinding: { kind: 'local' as const, reason: 'Authored test fixture' }, consumers: ['fixture'] }],
    generatedIntermediates: [{ path: 'generated/output.txt', generator: 'fixture generator' }],
    documents: [{ path: 'docs/NOTICE.md', purpose: 'Fixture attribution' }],
  };
  const { purpose, ...document } = base.documents[0]!;
  assert.equal(purpose, 'Fixture attribution');
  const manifest = { ...base, documents: [document] };
  for (const parse of [(value: unknown) => validateSourceManifest('fixture', value), (value: unknown) => parseSourceManifest(value, 'fixture')]) {
    assert.deepEqual(parse(manifest).documents[0], document);
    assert.throws(() => parse({ ...manifest, documents: [{ ...document, purpose: '' }] }), /empty purpose/);
    assert.throws(() => parse({ ...manifest, generatedIntermediates: [{ ...base.generatedIntermediates[0], generator: '' }] }), /generator/);
  }
});
