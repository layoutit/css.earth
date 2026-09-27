import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';
import { PDS_PROGRAMS, PDS_PROGRAMS_PATH } from './archive-final.mts';
import { buildPdsLedger } from './archive-ledger.mts';
// Plain node:test: it reads only the tracked programs and receipts beside this code.

test('every pinned PDS program qualifies, including receipts that recorded where the programs lived before they moved', async () => {
  const programs = (await readdir(PDS_PROGRAMS)).filter(name => name.endsWith('.archive-final.json')).map(name => name.slice(0, -'.archive-final.json'.length)).sort();
  assert.ok(programs.length > 0, 'no pinned PDS program');
  const ledger = await buildPdsLedger();
  assert.deepEqual(ledger.modes.flatMap(mode => mode.qualified).sort(), programs);
  assert.deepEqual(ledger.modes.flatMap(mode => mode.receipts).sort(), programs.map(id => `${PDS_PROGRAMS_PATH}/${id}.archive-final.product.json`));
});
