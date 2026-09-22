/** What a JunoCam registration receipt has to say for the images it names to count as measured. Everything here runs against a
 * scratch copy of the pinned program, so nothing asks the PDS anything. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { PROGRAMS, parseProgram } from './archive.mts';
import { checkRegistration, junoReceipts } from './archive-ledger.mts';

const read = async (name: string) => JSON.parse(await readFile(resolve(PROGRAMS, name), 'utf8')) as Record<string, unknown>;

/** A scratch programs directory holding europa-pj45 and whatever receipt a case writes beside it. */
async function scratch(receipt: unknown) {
  const directory = await mkdtemp(resolve(tmpdir(), 'juno-ledger-'));
  await writeFile(resolve(directory, 'europa-pj45.json'), `${JSON.stringify(await read('europa-pj45.json'), null, 2)}\n`);
  if (receipt !== undefined) await writeFile(resolve(directory, 'europa-pj45.registration.json'),
    typeof receipt === 'string' ? receipt : `${JSON.stringify(receipt, null, 2)}\n`);
  return directory;
}

test('the receipt beside the pinned program measures the images it registered within the budget', async () => {
  const directory = await scratch(await read('europa-pj45.registration.json'));
  try {
    const { measured, problems } = await junoReceipts(directory);
    assert.deepEqual(measured, [{ program: 'europa-pj45', target: 'EUROPA', images: 4 }]);
    assert.deepEqual(problems, []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a program with no receipt measures nothing and is not a problem', async () => {
  const directory = await scratch(undefined);
  try {
    const { measured, problems } = await junoReceipts(directory);
    assert.deepEqual(measured, []);
    assert.deepEqual(problems, []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a receipt that cannot be read, states another schema or names another image measures nothing and is reported', async () => {
  const receipt = await read('europa-pj45.registration.json'), images = receipt.images as Record<string, unknown>[];
  const target = receipt.target as Record<string, unknown>, policy = receipt.policy as Record<string, unknown>;
  for (const [why, value] of [['unreadable', '{ "schema": "cssearth-junocam-regist'], ['another schema', { ...receipt, schema: 'cssearth-junocam-nothing@1' }],
    ['another program', { ...receipt, program: 'europa-pj46' }], ['another target', { ...receipt, target: { ...target, naifId: 501 } }],
    ['a laxer budget', { ...receipt, policy: { ...policy, maximumResidualPixels: 9 } }],
    ['an image the program does not pin', { ...receipt, images: [{ ...images[0], productId: 'JNCR_2022272_45C00009_V01' }] }],
    ['another take of a pinned image', { ...receipt, images: [{ ...images[0], altitudeKmInLabel: 1 }] }],
    ['kernels the program does not pin', { ...receipt, kernels: (receipt.kernels as unknown[]).slice(1) }]] as const) {
    const directory = await scratch(value);
    try {
      const { measured, problems } = await junoReceipts(directory);
      assert.deepEqual(measured, [], why);
      assert.equal(problems.length, 1, why);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
});

test('an image whose holdout residual is over the budget is registered but not measured', async () => {
  const receipt = await read('europa-pj45.registration.json'), images = receipt.images as Record<string, unknown>[];
  const over = images.map((image, index) => index ? image : { ...image, holdoutResidualPixels: { ...(image.holdoutResidualPixels as object), after: 9 } });
  const directory = await scratch({ ...receipt, images: over });
  try {
    const { measured, problems } = await junoReceipts(directory);
    assert.deepEqual(measured, [{ program: 'europa-pj45', target: 'EUROPA', images: 3 }]);
    assert.deepEqual(problems, []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a receipt is read against the program it claims', async () => {
  const program = parseProgram(await read('europa-pj45.json'));
  assert.throws(() => checkRegistration({ schema: 'other' }, 'x.json', program), /is not a registration receipt/u);
  assert.throws(() => checkRegistration({ schema: 'cssearth-junocam-registration@1', program: 'other' }, 'x.json', program), /it is the receipt of other/u);
});

test('every receipt beside the pinned programs is accepted', async () => {
  const { problems } = await junoReceipts();
  assert.deepEqual(problems, [], 'run node tools/objects/juno/archive-ledger.mts --local');
});
