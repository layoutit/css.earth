/** What a Chandra receipt has to say for the observation it names to count as reproduced. Everything here runs against a
 * scratch copy of the pinned programs, so nothing asks the Chandra Data Archive anything. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { PROGRAMS } from './archive.mts';
import { modeStates, parseChandraReceipt, pinnedState } from './archive-ledger.mts';

const VFAINT = 'ACIS-012367 no grating TIMED/VFAINT', FAINT = 'ACIS-0123 no grating TIMED/FAINT';
const read = async (name: string) => JSON.parse(await readFile(resolve(PROGRAMS, name), 'utf8')) as Record<string, unknown>;

/** A scratch programs directory holding one program of two observations, taken from the two ACIS programs pinned here, and
 * whatever receipts a case writes beside it. The two observations are in different modes, which is what the states separate. */
async function scratch(receipts: Readonly<Record<string, unknown>>) {
  const directory = await mkdtemp(resolve(tmpdir(), 'chandra-ledger-'));
  const polaris = await read('polaris-vfaint.json'), crab = await read('m1-crab-halo.json');
  const observations = [...polaris.observations as unknown[], ...(crab.observations as unknown[])];
  await writeFile(resolve(directory, 'polaris-vfaint.json'), `${JSON.stringify({ ...polaris, observations }, null, 2)}\n`);
  for (const [name, value] of Object.entries(receipts))
    await writeFile(resolve(directory, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  return directory;
}

const state = (key: string, modes: Record<string, unknown>) => (modes[key] as { state: string } | undefined)?.state;

test('a receipt naming the first observation reproduces that mode alone, and the other stays pinned', async () => {
  const directory = await scratch({ 'polaris-vfaint.acisf06431N003_evt2.reproduction.json': await read('polaris-vfaint.acisf06431N003_evt2.reproduction.json') });
  try {
    const pinned = await pinnedState(directory), modes = modeStates(pinned);
    assert.deepEqual([...pinned.reproduced], ['polaris-vfaint|6431']);
    assert.equal(state(VFAINT, modes), 'reproduced');
    assert.equal(state(FAINT, modes), 'pinned', 'obsid 2798 has no receipt of its own');
    assert.deepEqual(pinned.problems, []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a receipt that cannot be read, states another schema or names an obsid nothing pins reproduces nothing and is reported', async () => {
  const receipt = await read('polaris-vfaint.acisf06431N003_evt2.reproduction.json');
  for (const [why, value] of [['unreadable', '{ "schema": "cssearth-chandra-repro'], ['another schema', { ...receipt, schema: 'cssearth-chandra-nothing@1' }],
    ['another obsid', { ...receipt, obsid: 99999 }], ['no digest', { ...receipt, archive: { ...(receipt.archive as object), sha256: 'not a digest' } }],
    ['another size', { ...receipt, archive: { ...(receipt.archive as object), bytes: 1 } }],
    ['another mode', { ...receipt, dataMode: 'TIMED/FAINT' }]] as const) {
    const directory = await scratch({ 'polaris-vfaint.acisf06431N003_evt2.reproduction.json': value });
    try {
      const pinned = await pinnedState(directory);
      assert.deepEqual([...pinned.reproduced], [], why);
      assert.equal(pinned.problems.length, 1, why);
      assert.equal(state(VFAINT, modeStates(pinned)), 'pinned', why);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
});

test('a receipt whose file name is not the program and product it states is reported', async () => {
  const directory = await scratch({ 'polaris-vfaint.acisf02798N004_evt2.reproduction.json': await read('polaris-vfaint.acisf06431N003_evt2.reproduction.json') });
  try {
    const pinned = await pinnedState(directory);
    assert.deepEqual([...pinned.reproduced], []);
    assert.match(pinned.problems[0]!, /it is the receipt of polaris-vfaint acisf06431N003_evt2/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a receipt is read as the external value it is', () => {
  assert.throws(() => parseChandraReceipt({ schema: 'other' }, 'x.json'), /is not a reproduction receipt/u);
  assert.throws(() => parseChandraReceipt({ schema: 'cssearth-chandra-reproduction@1' }, 'x.json'), /archive file/u);
  assert.throws(() => parseChandraReceipt({ schema: 'cssearth-chandra-reproduction@1', archive: { path: 'p', bytes: 1, sha256: 'z' } }, 'x.json'), /not a sha256/u);
});

test('every receipt beside the pinned programs is accepted', async () => {
  const pinned = await pinnedState();
  assert.deepEqual(pinned.problems, [], 'run node tools/objects/chandra/archive-ledger.mts --local');
});
