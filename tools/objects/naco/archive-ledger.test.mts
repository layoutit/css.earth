/** What a NACO receipt has to say for the mode it names to count as reduced. Everything here runs against a scratch programs
 * directory, so nothing asks the ESO archive anything. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { checkReceipt, modeStates } from './archive-ledger.mts';

const FRAMES = { imaging: 231_839, spectroscopy: 9438 };
const DIGESTS = ['a'.repeat(64), 'b'.repeat(64)];
const program = (id: string, mode: string) => ({ schema: 'cssearth-naco-program@1', program: id, instrument: 'NAOS+CONICA', programme: '080.C-0881(C)',
  object: 'CERES', mode, night: '2007-11-11', objectTemplates: ['2007-11-11T02:38:47', '2007-11-11T02:45:32'], skyTemplates: [] });
const receipt = (changes: Record<string, unknown> = {}) => ({ schema: 'cssearth-naco-reproduction@1', program: 'ceres-night', product: 'COADDED_IMG', kind: 'two-templates',
  sequences: DIGESTS.map((sha256, index) => ({ template: ['2007-11-11T02:38:47', '2007-11-11T02:45:32'][index], path: `.local/naco/${index}.fits`, sha256, bytes: 100 })), ...changes });

/** A scratch programs directory holding one imaging program and one spectroscopy program, and whatever a case writes beside. */
async function scratch(files: Readonly<Record<string, unknown>>) {
  const directory = await mkdtemp(resolve(tmpdir(), 'naco-ledger-'));
  await writeFile(resolve(directory, 'ceres-night.json'), `${JSON.stringify(program('ceres-night', 'imaging'), null, 2)}\n`);
  await writeFile(resolve(directory, 'europa-night.json'), `${JSON.stringify(program('europa-night', 'spectroscopy'), null, 2)}\n`);
  for (const [name, value] of Object.entries(files))
    await writeFile(resolve(directory, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  return directory;
}

const of = (modes: Awaited<ReturnType<typeof modeStates>>['modes'], mode: string) => modes.find(entry => entry.mode === mode)!;

test('an accepted receipt reduces the mode of the program it names, and the other mode stays pinned', async () => {
  const directory = await scratch({ 'ceres-night.COADDED_IMG.reproduction.json': receipt() });
  try {
    const { modes, problems } = await modeStates(FRAMES, directory);
    assert.equal(of(modes, 'imaging').state, 'reduced');
    assert.deepEqual(of(modes, 'imaging').receipts, ['ceres-night.COADDED_IMG.reproduction.json']);
    assert.equal(of(modes, 'spectroscopy').state, 'pinned', 'europa-night has no receipt');
    assert.deepEqual(problems, []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a receipt that cannot be read, names another program or pins only one side reduces nothing and is reported', async () => {
  for (const [why, value] of [['unreadable', '{ "schema": "cssearth-naco-repro'], ['another schema', receipt({ schema: 'cssearth-naco-nothing@1' })],
    ['another program', receipt({ program: 'europa-night' })], ['one side', receipt({ sequences: [{ template: '2007-11-11T02:38:47', path: 'a', sha256: DIGESTS[0], bytes: 1 }] })],
    ['the same side twice', receipt({ sequences: DIGESTS.map(() => ({ template: '2007-11-11T02:38:47', path: 'a', sha256: DIGESTS[0], bytes: 1 })) })],
    ['a template the program does not pin', receipt({ sequences: [{ template: '2007-11-11T09:00:00', path: 'a', sha256: DIGESTS[0], bytes: 1 },
      { template: '2007-11-11T02:45:32', path: 'b', sha256: DIGESTS[1], bytes: 1 }] })],
    ['no digest', receipt({ sequences: DIGESTS.map((_, index) => ({ template: '2007-11-11T02:38:47', path: `${index}`, sha256: 'not a digest', bytes: 1 })) })]] as const) {
    const directory = await scratch({ 'ceres-night.COADDED_IMG.reproduction.json': value });
    try {
      const { modes, problems } = await modeStates(FRAMES, directory);
      assert.equal(of(modes, 'imaging').state, 'pinned', why);
      assert.deepEqual(of(modes, 'imaging').receipts, [], why);
      assert.equal(problems.length, 1, why);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
});

test('a spectrum receipt has to name the object and the night its program pins', async () => {
  const spectrum = (changes: Record<string, unknown> = {}) => ({ schema: 'cssearth-naco-spectrum@1', program: 'europa-night', object: 'CERES', night: '2007-11-11', kind: 'two-nod-halves',
    halves: DIGESTS.map((sha256, index) => ({ half: `${'ab'[index]}-half`, path: `.local/naco/${index}.fits`, sha256, bytes: 100 })), ...changes });
  const accepted = await scratch({ 'europa-night.spectrum.reproduction.json': spectrum() });
  try {
    const { modes, problems } = await modeStates(FRAMES, accepted);
    assert.equal(of(modes, 'spectroscopy').state, 'reduced');
    assert.deepEqual(problems, []);
  } finally { await rm(accepted, { recursive: true, force: true }); }
  const refused = await scratch({ 'europa-night.spectrum.reproduction.json': spectrum({ night: '2012-01-03' }) });
  try {
    const { modes, problems } = await modeStates(FRAMES, refused);
    assert.equal(of(modes, 'spectroscopy').state, 'pinned');
    assert.match(problems[0]!, /it names the night 2012-01-03/u);
  } finally { await rm(refused, { recursive: true, force: true }); }
});

test('a receipt is read against the program it claims', () => {
  const pinned = program('ceres-night', 'imaging');
  assert.throws(() => checkReceipt({ schema: 'other' }, 'ceres-night.COADDED_IMG.reproduction.json', pinned), /is not a NACO receipt/u);
  assert.throws(() => checkReceipt(receipt(), 'ceres-night.OTHER.reproduction.json', pinned), /it is the receipt named/u);
});

test('every receipt beside the pinned programs is accepted', async () => {
  const { problems } = await modeStates({ imaging: 1, spectroscopy: 1 });
  assert.deepEqual(problems, [], 'run node tools/objects/naco/archive-ledger.mts --local');
});
