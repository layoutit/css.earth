import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { archivePrograms } from '../programs.mts';
import { parseReproductionReceipt, repositoryState } from './archive-ledger.mts';
import { PROGRAMS } from './imaging/archive.mts';

// These receipts were authored under imaging/programs; relocation must not invalidate their program ids or pins.
test('historical imaging receipts validate unchanged in the shared JWST programs root', async () => {
  for (const [id, band, accepted] of [
    ['europa-1250', 'MIRI-F1280W', false],
    ['makemake-jw01254-o004_t001_nirspec_g235m-f170lp', 'NIRSPEC-G235M-F170LP', false],
  ] as const) {
    const name = `${id}.${band}.reproduction.json`;
    const raw: unknown = JSON.parse(await readFile(join(PROGRAMS, name), 'utf8'));
    const oldPath = `packages/telescope-cli/src/archives/jwst/imaging/programs/${name}`;
    const historical = parseReproductionReceipt(raw, oldPath);
    assert.equal(historical.program, id);
    assert.equal(historical.accepted, accepted);
    assert.deepEqual(parseReproductionReceipt(raw, archivePrograms('jwst').file(name)), historical);
    const state = await repositoryState();
    assert.ok([...state.modes.values()].some(mode => mode.programs.includes(id)));
    assert.ok(!state.receiptProblems.some(problem => problem.startsWith(name)), state.receiptProblems.join('\n'));
  }
});

test('the shared root skips known KLIP programs but refuses malformed or unknown imaging programs', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'jwst-programs-'));
  const programs = join(repository, archivePrograms('jwst').path);
  try {
    await mkdir(programs, { recursive: true });
    const file = join(programs, 'klip.json');
    await writeFile(file, JSON.stringify({ schema: 'cssearth-jwst-klip-program@1', id: 'test' }));
    assert.deepEqual((await repositoryState(repository)).receiptProblems, []);
    for (const schema of ['unknown', 'cssearth-jwst-imaging-program@1']) {
      await writeFile(file, JSON.stringify({ schema, id: 'test' }));
      await assert.rejects(repositoryState(repository), /not an imaging program/u);
    }
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});
