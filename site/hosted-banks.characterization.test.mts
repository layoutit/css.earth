import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { importWithJson } from './test/fixtures/module-import.mts';
const bank = { schema: 'cssearth-object@2', id: 'dots', type: 'catalogue-point-bank', properties: { host: 'star' } };
mock.module(new URL('./prepared/prepared-hosted-banks.json', import.meta.url).href, { defaultExport: {
  dots: { carriers: ['star'], descriptor: bank, files: { 'prepared/dots.bin': '/dots.bin' } },
  volume: { carriers: ['cloud'], descriptor: { id: 'volume', type: 'volume-dataset-bank' } },
} });
const { hostedBanksOf } = await import('./hosted-banks.mts');
test('banks select direct carriers and only the orbital centre’s point bank', () => {
  assert.deepEqual(hostedBanksOf('star'), [{ descriptor: bank, files: { 'prepared/dots.bin': '/dots.bin' } }]);
  assert.deepEqual(hostedBanksOf('planet', 'star'), hostedBanksOf('star'));
  assert.deepEqual(hostedBanksOf('missing'), []);
  assert.deepEqual(hostedBanksOf('cloud'), [{ descriptor: { id: 'volume', type: 'volume-dataset-bank' } }]);
});
test('hosted-bank import refuses malformed carriers, descriptors and file URLs', () => {
  const subject = new URL('./hosted-banks.mts', import.meta.url), dependency = new URL('./prepared/prepared-hosted-banks.json', import.meta.url);
  for (const value of [null, { dots: { carriers: [1], descriptor: bank } }, { dots: { carriers: [], descriptor: { ...bank, id: 'wrong' } } }, { dots: { carriers: [], descriptor: bank, files: { x: 1 } } }]) {
    const result = importWithJson(subject, dependency, value);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('expected'), result.stderr);
  }
});
