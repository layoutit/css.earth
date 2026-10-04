import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseProductRecord, PRODUCT_RECORD_SCHEMA, EVIDENCE_KINDS } from './telescope-product.ts';
const record = () => ({ schema: PRODUCT_RECORD_SCHEMA, telescope: 'fixture', stage: 'final', inputs: [{ role: 'raw', identity: 'source', bytes: 0 }],
  parameters: { opaque: [null, 1] }, software: [{ name: 'tool', version: '1' }], outputs: [{ path: 'final.fits', bytes: 3, units: '', conventions: { axes: 'ICRS' } }],
  evidence: [{ kind: 'archive-origin', product: 'final.fits', receipt: 'evidence.json', establishes: 'origin' }] });
test('product records preserve leaf shapes and every evidence kind', () => {
  assert.deepEqual(parseProductRecord({ ...record(), ignored: true }), record());
  for (const kind of EVIDENCE_KINDS) assert.equal(parseProductRecord({ ...record(), evidence: [{ ...record().evidence[0], kind }] }).evidence[0].kind, kind);
});
test('product refusal diagnostics and admission order are unchanged', () => {
  const cases: readonly [unknown, string][] = [
    [{ ...record(), schema: 'wrong' }, 'Unsupported product record schema wrong.'],
    [{ ...record(), inputs: [{ ...record().inputs[0], bytes: -1 }] }, 'Input 0 needs a byte count.'],
    [{ ...record(), outputs: [{ path: 'x', bytes: 1.5 }] }, 'Output 0 needs a byte count.'],
    [{ ...record(), evidence: [{ ...record().evidence[0], kind: 'exists' }] }, 'Evidence 0 has no known kind (exists).'],
    [{ ...record(), evidence: [{ ...record().evidence[0], product: 'other' }] }, 'Evidence 0 names other, which this record did not produce.'],
    [{ ...record(), outputs: [], evidence: [] }, 'A product record names at least one output.'],
  ];
  for (const [value, message] of cases) assert.throws(() => parseProductRecord(value), { name: 'TypeError', message });
});
test('product transport calls the shared reader and retains no second parser', () => {
  const owner = readFileSync(new URL('../../../telescope/src/product-record.ts', import.meta.url), 'utf8');
  const transport = readFileSync(new URL('../../../telescope/src/node/product-record.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(owner, /(?:function|const)\s+parseProductRecord\b|Unsupported product record schema/u);
  assert.match(transport, /import \{[^;]*parseProductRecord[^;]*from '@cssearth\/objects'/u);
  assert.match(transport, /text => parseProductRecord\(JSON\.parse\(text\) as unknown\)/u);
});
