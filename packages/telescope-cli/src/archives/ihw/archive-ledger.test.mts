import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { WORKSPACE } from '@cssearth/telescope/node';
import { archiveFinalQualified, IHW_PROGRAMS, ihwLedgerFocus } from './archive-ledger.mts';
// Plain node:test: the programs, their receipts and the ledger focus are tracked, so a checkout always holds them, and a file the
// code cannot find is a failure, never an unrestored download to skip.

test('the ledger reads its focus and the pinned programs where they are tracked, beside the IHW archive code', async () => {
  assert.equal(IHW_PROGRAMS.path, 'packages/telescope-cli/src/archives/ihw/programs');
  assert.ok((await readdir(resolve(WORKSPACE, IHW_PROGRAMS.path))).length > 0, `${IHW_PROGRAMS.path} holds no programs`);
  const focus = await ihwLedgerFocus();
  assert.ok((await readdir(resolve(WORKSPACE, 'src/objects'))).includes(focus.object), `${focus.object} is not a shipped body`);
});

test('the tracked archive-final receipt, which records its location before the move, still qualifies', async () => {
  const focus = await ihwLedgerFocus(), name = `${focus.archiveFinal.program}.archive-final.product.json`;
  const receipt = JSON.parse(await readFile(resolve(WORKSPACE, IHW_PROGRAMS.file(name)), 'utf8')) as { evidence: { receipt: string }[] };
  assert.deepEqual(receipt.evidence.map(entry => entry.receipt), [`tools/objects/ihw/programs/${name}`], 'the receipt keeps the path it recorded');
  assert.equal(await archiveFinalQualified(focus), true);
});
