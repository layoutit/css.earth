import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildLedger, JWST_MODES, JWST_TIME_SERIES, ledgerGuide, matchTarget, parseLedger, repositoryState, shippedObjects, withRepositoryState, type Ledger, type ShippedObject } from './archive-ledger.mts';

const repository = resolve(import.meta.dirname, '../../..');
const objects: ShippedObject[] = [{ id: 'titan', names: ['titan', 'Titan'] }, { id: 'pluto', names: ['pluto', 'Pluto'] }, { id: 'charon', names: ['charon', 'Charon'] },
  { id: 'dione', names: ['dione', 'Dione'] }, { id: 'dione-106', names: ['dione-106', 'Dione'] }, { id: 'chiron', names: ['chiron', 'Chiron'] },
  { id: 'hd-189733b', names: ['hd-189733b', 'HD 189733 b'] }, { id: 'hd-189733-companion', names: ['hd-189733-companion', 'HD 189733 B'] },
  { id: 'hd-181327', names: ['hd-181327', 'HD 181327'], position: { raDeg: 290.7458, decDeg: -54.5384, radiusDeg: 0.5 / 60 } }];
const moving = (target: string) => matchTarget({ target, moving: true, raDeg: null, decDeg: null }, objects);

test('a moving target is read by its first word, and a background pointing is no object', () => {
  assert.deepEqual(moving('TITAN-LEADING'), ['titan']);
  assert.deepEqual(moving('PLUTO+CHARON'), ['pluto', 'charon']);
  assert.deepEqual(moving('2060 CHIRON'), ['chiron']);
  assert.deepEqual(moving('BG-TITAN+20N'), []);
  assert.deepEqual(moving('TITAN-BACKGROUND'), []);
  assert.deepEqual(moving('TITANIA'), []);
});

test('a shared name goes to the unnumbered object unless the target carries the number', () => {
  assert.deepEqual(moving('DIONE'), ['dione']);
  assert.deepEqual(moving('106 DIONE'), ['dione-106']);
  assert.deepEqual(moving('DIONE-106'), ['dione-106']);
});

test('an id outranks a display name that differs only by case', () => {
  assert.deepEqual(matchTarget({ target: 'HD-189733B', moving: false, raDeg: null, decDeg: null }, objects), ['hd-189733b']);
});

test('a fixed target is matched by position, not by its first word', () => {
  assert.deepEqual(matchTarget({ target: 'DEBRIS-DISK-7', moving: false, raDeg: 290.7460, decDeg: -54.5385 }, objects), ['hd-181327']);
  assert.deepEqual(matchTarget({ target: 'TITAN-FIELD', moving: false, raDeg: 10, decDeg: 10 }, objects), []);
});

test('each mode\'s state comes from the pinned programs, and every named tool exists', async () => {
  const state = await repositoryState(repository);
  for (const { mode, tool } of JWST_MODES) {
    if (tool) await access(resolve(repository, tool));
    else assert.deepEqual(state.modes.get(mode)!.programs, [], `${mode} has pinned programs but names no tool`);
  }
  assert.deepEqual(state.modes.get('NIRCAM/CORON')!.checked, [], 'historical comparisons have no explicit acceptance rule');
  assert.ok(state.modes.get('MIRI/SLITLESS')!.checked.includes('wasp-43b-miri-1366'));
  for (const instrument of state.timeSeries.keys()) assert.ok(JWST_TIME_SERIES.some(entry => entry.programInstrument === instrument), `${instrument} has no time-series exposure type`);
});

test('a ledger counts observations by object and mode', () => {
  const held = { modes: new Map(JWST_MODES.map(({ mode }) => [mode, { bands: 0, programs: [] as string[], checked: [] as string[] }])), timeSeries: new Map<string, { programs: string[]; checked: string[] }>(), receiptProblems: [] as string[] };
  const ledger = buildLedger([{ observation: 'a', target: 'TITAN-LEADING', programme: '1251', mode: 'NIRSPEC/IFU', moving: true,
    startIso: '2022-01-01T00:00:00.000Z', endIso: '2022-01-01T01:00:00.000Z', filter: 'F100LP;G140H', raDeg: null, decDeg: null },
    { observation: 'b', target: 'TITAN-BACKGROUND', programme: '1251', mode: 'NIRSPEC/IFU', moving: true,
      startIso: '2022-01-02T00:00:00.000Z', endIso: '2022-01-02T01:00:00.000Z', filter: 'F100LP;G140H', raDeg: null, decDeg: null }],
  [{ exposure: 'MIR_LRS-SLITLESS', programme: '2021', observation: '2', target: 'HD-189733B', raDeg: null, decDeg: null }], new Map(), objects, held, '2026-09-18');
  assert.deepEqual(ledger.objects.map(object => [object.id, object.observations, object.records, object.timeSeriesVisits]), [
    ['hd-189733b', {}, [], { 'MIR_LRS-SLITLESS': 1 }],
    ['titan', { 'NIRSPEC/IFU': 1 }, [{ id: 'a', programme: '1251', mode: 'NIRSPEC/IFU', startIso: '2022-01-01T00:00:00.000Z', endIso: '2022-01-01T01:00:00.000Z', filter: 'F100LP;G140H' }], {}],
  ]);
  assert.equal(ledger.modes.find(mode => mode.mode === 'NIRSPEC/IFU')!.observations, 2);
});

// --- receipts ------------------------------------------------------------------------------------------------------------

/** A scratch repository holding one imaging program of two modes, and whatever receipts a case writes beside it. */
async function scratch(receipts: Readonly<Record<string, string>>) {
  const root = await mkdtemp(resolve(tmpdir(), 'jwst-ledger-')), imaging = resolve(root, 'tools/objects/jwst/imaging/programs');
  await mkdir(imaging, { recursive: true });
  await mkdir(resolve(root, 'tools/objects/jwst/programs'), { recursive: true });
  await writeFile(resolve(imaging, 'mixed-9999.json'), `${JSON.stringify({ schema: 'cssearth-jwst-imaging-program@1', id: 'mixed-9999', programme: '9999', target: 'MIXED', crdsContext: 'jwst_1535.pmap',
    bands: [
      { band: 'NIRCAM-F470N', observation: 'jw09999-o001_t001_nircam_f444w-f470n', stage: 'image3',
        level3: { name: 'jw09999-o001_t001_nircam_f444w-f470n_i2d.fits', uri: 'mast:JWST/product/jw09999-o001_t001_nircam_f444w-f470n_i2d.fits', bytes: 1024 } },
      { band: 'NIRSPEC-G395H-F290LP', observation: 'jw09999-o002_t001_nirspec_g395h-f290lp', stage: 'spec3',
        level3: { name: 'jw09999-o002_t001_nirspec_g395h-f290lp_s3d.fits', uri: 'mast:JWST/product/jw09999-o002_t001_nirspec_g395h-f290lp_s3d.fits', bytes: 2048 } },
    ] }, null, 1)}\n`);
  for (const [name, text] of Object.entries(receipts)) await writeFile(resolve(imaging, name), text);
  return root;
}

const DIGEST = 'a'.repeat(64);
const nircamReceipt = (changes: Record<string, unknown> = {}) => `${JSON.stringify({ schema: 'cssearth-jwst-image3-reproduction@1', program: 'mixed-9999', band: 'NIRCAM-F470N',
  observation: 'jw09999-o001_t001_nircam_f444w-f470n', mast: { name: 'jw09999-o001_t001_nircam_f444w-f470n_i2d.fits', bytes: 1024, sha256: DIGEST }, ...changes }, null, 1)}\n`;

test('a program of two modes with one unreadable receipt is checked for neither, and the receipt is reported', async () => {
  const root = await scratch({ 'mixed-9999.NIRCAM-F470N.reproduction.json': '{ "schema": "cssearth-jwst-image3-repro' });
  try {
    const state = await repositoryState(root);
    for (const mode of ['NIRCAM/IMAGE', 'NIRSPEC/IFU']) {
      assert.deepEqual(state.modes.get(mode)!.programs, ['mixed-9999'], `${mode} pins the program`);
      assert.deepEqual(state.modes.get(mode)!.checked, [], `${mode} is checked by a receipt that cannot be read`);
    }
    assert.equal(state.receiptProblems.length, 1);
    assert.match(state.receiptProblems[0]!, /mixed-9999\.NIRCAM-F470N\.reproduction\.json/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a historical receipt without a numerical acceptance rule remains a comparison, not checked agreement', async () => {
  const root = await scratch({ 'mixed-9999.NIRCAM-F470N.reproduction.json': nircamReceipt() });
  try {
    const state = await repositoryState(root);
    assert.deepEqual(state.modes.get('NIRCAM/IMAGE')!.checked, []);
    assert.deepEqual(state.modes.get('NIRSPEC/IFU')!.checked, []);
    assert.deepEqual(state.receiptProblems, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a receipt of another schema, another observation or another product proves nothing and is reported', async () => {
  for (const [why, receipt] of [['another schema', nircamReceipt({ schema: 'cssearth-jwst-nothing@1' })],
    ['another observation', nircamReceipt({ observation: 'jw09999-o003_t001_nircam_f444w-f470n' })],
    ['another product', nircamReceipt({ mast: { name: 'jw09999-o001_t001_nircam_f444w-f470n_i2d.fits', bytes: 4096, sha256: DIGEST } })]] as const) {
    const root = await scratch({ 'mixed-9999.NIRCAM-F470N.reproduction.json': receipt });
    try {
      const state = await repositoryState(root);
      assert.deepEqual(state.modes.get('NIRCAM/IMAGE')!.checked, [], why);
      assert.equal(state.receiptProblems.length, 1, why);
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});

test('a receipt no pinned program holds a band for is reported rather than ignored', async () => {
  const root = await scratch({ 'ghost-1.NIRCAM-F470N.reproduction.json': nircamReceipt({ program: 'ghost-1' }) });
  try {
    const state = await repositoryState(root);
    assert.deepEqual(state.receiptProblems, ['ghost-1.NIRCAM-F470N.reproduction.json: no pinned program holds that band.']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

