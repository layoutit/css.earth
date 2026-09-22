/** What a Hubble receipt has to say for the configuration it names to count as re-calibrated. Everything here runs against a
 * scratch copy of the pinned programs, so nothing asks MAST anything. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { PROGRAMS } from './archive.mts';
import { parseReproductionReceipt, recalibrationTool, repositoryReceipts } from './archive-ledger.mts';

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
  assert.throws(() => parseReproductionReceipt({ schema: 'cssearth-hst-reproduction@1', mast: { name: 'a.fits' } }, 'x.json'), /program/u);
});

test('every receipt beside the pinned programs is accepted', async () => {
  const { problems } = await repositoryReceipts();
  assert.deepEqual(problems, [], 'run node tools/objects/hst/archive-ledger.mts --local');
});

/** A scratch repository holding one archive-final program and whatever record a case writes beside it. */
async function archiveScratch(record: unknown, program = 'europa-ghrs-5376') {
  const root = await mkdtemp(resolve(tmpdir(), 'hst-archive-final-')), directory = resolve(root, 'tools/objects/hst/programs');
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, `${program}.archive-final.json`), `${JSON.stringify(await read(`${program}.archive-final.json`), null, 2)}\n`);
  if (record !== undefined) await writeFile(resolve(directory, `${program}.archive-final.product.json`), typeof record === 'string' ? record : `${JSON.stringify(record, null, 2)}\n`);
  return root;
}

test('an instrument whose pipeline is retired can still be qualified on the archive’s own product, and is never counted as re-calibrated', async () => {
  const root = await archiveScratch(await read('europa-ghrs-5376.archive-final.product.json'));
  try {
    const { archiveFinal, configurations, problems } = await repositoryReceipts(root);
    assert.deepEqual([...archiveFinal.get('HRS/1')!.qualified], ['europa-ghrs-5376']);
    assert.deepEqual(problems, []);
    // The two capabilities never bleed into one another: nothing was re-calibrated on HRS/1 and no pipeline for it exists here.
    assert.equal(configurations.get('HRS/1'), undefined, 'an archive-final program is not a pinned re-calibration program');
    assert.equal(recalibrationTool('HRS/1'), null);
    assert.equal(recalibrationTool('WFC3/IR'), 'tools/objects/hst/calibrate.mts', 'a pipeline that is installed is named even where nothing has been run on it');
    assert.equal(recalibrationTool('STIS'), null, 'a configuration with no detector is a product of products, with no raw exposure behind it');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a program that moves a component to another unit of the same file is not qualified by the record of the old one', async () => {
  // The reviewer's case. A WFPC2 exposure keeps all four chips in one pair of files, so selecting chip 2 instead of chip 1
  // changes which detector was measured and leaves every pinned digest untouched. The record of the chip-1 run must not qualify
  // the chip-2 program, and the configuration falls back to pinned-but-not-qualified with the reason said.
  const program = await read('europa-wfpc2-11085.archive-final.json') as Record<string, unknown>;
  const record = await read('europa-wfpc2-11085.archive-final.product.json');
  const moved = { ...program, components: (program.components as Record<string, unknown>[]).map(entry => entry.role === 'science' ? { ...entry, hdu: 2 } : entry) };
  const root = await mkdtemp(resolve(tmpdir(), 'hst-archive-final-')), directory = resolve(root, 'tools/objects/hst/programs');
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'europa-wfpc2-11085.archive-final.json'), `${JSON.stringify(moved, null, 2)}\n`);
  await writeFile(resolve(directory, 'europa-wfpc2-11085.archive-final.product.json'), `${JSON.stringify(record, null, 2)}\n`);
  try {
    const { archiveFinal, problems } = await repositoryReceipts(root);
    assert.deepEqual([...archiveFinal.get('WFPC2/PC')!.qualified], [], 'the chip-1 record qualifies no chip-2 program');
    assert.deepEqual([...archiveFinal.get('WFPC2/PC')!.programs], ['europa-wfpc2-11085'], 'the archive products stay listed; only the route is unqualified');
    assert.equal(problems.length, 1);
    assert.match(problems[0]!, /qualified against another run: components/u, problems[0]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a record that cannot be read, names something else or claims agreement qualifies nothing and is reported', async () => {
  const record = await read('europa-ghrs-5376.archive-final.product.json');
  const parameters = record.parameters as Record<string, unknown>, outputs = record.outputs as Record<string, unknown>[];
  const evidence = record.evidence as Record<string, unknown>[], selection = parameters.selection as Record<string, unknown>;
  for (const [why, value] of [
    ['no record at all', undefined],
    ['unreadable', '{ "schema": "cssearth-telescope-'],
    ['another stage', { ...record, stage: 'calibrate' }],
    ['no selection at all', { ...record, parameters: Object.fromEntries(Object.entries(parameters).filter(([key]) => key !== 'selection')) }],
    ['another observation', { ...record, parameters: { ...parameters, selection: { ...selection, observation: 'z2cf0208t' } } }],
    ['another configuration', { ...record, parameters: { ...parameters, selection: { ...selection, configuration: 'HRS/2' } } }],
    ['another identity', { ...record, parameters: { ...parameters, selection: { ...selection, identity: { ...(selection.identity as Record<string, unknown>), aperture: 'SSA' } } } }],
    ['software of ours', { ...record, software: [{ name: 'calhrs', version: '1.0' }] }],
    ['another size', { ...record, outputs: outputs.map((output, index) => index ? output : { ...output, bytes: 1 }) }],
    ['one file short', { ...record, outputs: outputs.slice(1), evidence: evidence.filter(entry => outputs.slice(1).some(output => output.path === entry.product)) }],
    ['agreement claimed', { ...record, evidence: [...evidence, { ...evidence[0]!, kind: 'archive-agreement' }] }],
  ] as const) {
    const root = await archiveScratch(value);
    try {
      const { archiveFinal, problems } = await repositoryReceipts(root);
      assert.deepEqual([...archiveFinal.get('HRS/1')!.qualified], [], why);
      assert.deepEqual([...archiveFinal.get('HRS/1')!.programs], ['europa-ghrs-5376'], `${why}: the program is still listed, so the observations do not disappear`);
      assert.equal(problems.length, 1, why);
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});
