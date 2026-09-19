/** What a Hubble receipt has to say for the configuration it names to count as re-calibrated. Everything here runs against a
 * scratch copy of the pinned programs, so nothing asks MAST anything. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { PROGRAMS } from './archive.mts';
import { parseReproductionReceipt, repositoryReceipts } from './archive-ledger.mts';

const read = async (name: string) => JSON.parse(await readFile(resolve(PROGRAMS, name), 'utf8')) as Record<string, unknown>;

/** A scratch repository holding europa-15419, which pins one WFC3/UVIS observation and one STIS/CCD observation, and whatever
 * receipts a case writes beside it. The two configurations are what the states have to keep apart. */
async function scratch(receipts: Readonly<Record<string, unknown>>) {
  const root = await mkdtemp(resolve(tmpdir(), 'hst-ledger-')), directory = resolve(root, 'tools/objects/hst/programs');
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'europa-15419.json'), `${JSON.stringify(await read('europa-15419.json'), null, 2)}\n`);
  for (const [name, value] of Object.entries(receipts))
    await writeFile(resolve(directory, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  return root;
}

test('a receipt for one configuration re-calibrates that one, and the program stays unproved in the other', async () => {
  const root = await scratch({ 'europa-15419.idr203wtq_drz.reproduction.json': await read('europa-15419.idr203wtq_drz.reproduction.json') });
  try {
    const { configurations, problems } = await repositoryReceipts(root);
    assert.deepEqual([...configurations.get('WFC3/UVIS')!.checked], ['europa-15419']);
    assert.deepEqual([...configurations.get('STIS/CCD')!.programs], ['europa-15419']);
    assert.deepEqual([...configurations.get('STIS/CCD')!.checked], [], 'odr2a1010 has no receipt of its own');
    assert.deepEqual(problems, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a receipt that cannot be read, states another schema or names another product proves nothing and is reported', async () => {
  const receipt = await read('europa-15419.idr203wtq_drz.reproduction.json'), mast = receipt.mast as Record<string, unknown>;
  for (const [why, value] of [['unreadable', '{ "schema": "cssearth-hst-repro'], ['another schema', { ...receipt, schema: 'cssearth-hst-nothing@1' }],
    ['another observation', { ...receipt, observation: 'odr2a1010' }], ['another size', { ...receipt, mast: { ...mast, bytes: 1 } }],
    ['no digest', { ...receipt, mast: { ...mast, sha256: 'not a digest' } }],
    ['a product the observation does not pin', { ...receipt, mast: { ...mast, name: 'idr203wtq_sx1.fits' } }]] as const) {
    const root = await scratch({ 'europa-15419.idr203wtq_drz.reproduction.json': value });
    try {
      const { configurations, problems } = await repositoryReceipts(root);
      assert.deepEqual([...configurations.get('WFC3/UVIS')!.checked], [], why);
      assert.equal(problems.length, 1, why);
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});

test('a receipt of a program nothing pins belongs to another pipeline and is left alone', async () => {
  // The line-stack and slit-scan routes write their own receipts in this directory, under their own schemas and for ids no
  // program pins. Reading them as reproduction receipts would report a problem that is not one.
  const root = await scratch({ 'europa-oxygen-aurora.stack.reproduction.json': { schema: 'cssearth-hst-line-stack@1', program: 'europa-oxygen-aurora' } });
  try {
    const { problems } = await repositoryReceipts(root);
    assert.deepEqual(problems, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a receipt is read as the external value it is', () => {
  assert.throws(() => parseReproductionReceipt({ schema: 'other' }, 'x.json'), /is not a reproduction receipt/u);
  assert.throws(() => parseReproductionReceipt({ schema: 'cssearth-hst-reproduction@1' }, 'x.json'), /MAST product/u);
  assert.throws(() => parseReproductionReceipt({ schema: 'cssearth-hst-reproduction@1', mast: { name: 'a.fits', bytes: 1, sha256: 'z' } }, 'x.json'), /not a sha256/u);
});

test('every receipt beside the pinned programs is accepted', async () => {
  const { problems } = await repositoryReceipts();
  assert.deepEqual(problems, [], 'run node tools/objects/hst/archive-ledger.mts --local');
});
