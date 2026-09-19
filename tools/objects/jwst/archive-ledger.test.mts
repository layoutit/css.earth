import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { buildLedger, JWST_MODES, JWST_TIME_SERIES, ledgerGuide, matchTarget, repositoryState, shippedObjects, type Ledger, type ShippedObject } from './archive-ledger.mts';

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
  assert.ok(state.modes.get('NIRCAM/CORON')!.checked.includes('hd-181327-2780'));
  assert.ok(state.modes.get('MIRI/SLITLESS')!.checked.includes('wasp-43b-miri-1366'));
  for (const instrument of state.timeSeries.keys()) assert.ok(JWST_TIME_SERIES.some(entry => entry.programInstrument === instrument), `${instrument} has no time-series exposure type`);
});

test('the checked-in ledger names only shipped objects, agrees with the pinned programs, and the guide is written from it', async () => {
  const ledger = JSON.parse(await readFile(resolve(repository, 'data/jwst/ledger.json'), 'utf8')) as Ledger;
  assert.equal(ledger.schema, 'cssearth-jwst-ledger@1');
  const shipped = new Set((await shippedObjects(repository)).map(object => object.id)), state = await repositoryState(repository);
  for (const object of ledger.objects) assert.ok(shipped.has(object.id), `${object.id} is not shipped`);
  for (const mode of ledger.modes) {
    assert.deepEqual(mode.programs, [...state.modes.get(mode.mode)!.programs].sort(), `${mode.mode}: run archive-ledger.mts --write`);
    assert.deepEqual(mode.checked, [...state.modes.get(mode.mode)!.checked].sort(), `${mode.mode}: run archive-ledger.mts --write`);
  }
  assert.equal(await readFile(resolve(repository, 'docs/jwst-ledger.md'), 'utf8'), ledgerGuide(ledger));
});

test('a ledger counts observations by object and mode', () => {
  const held = { modes: new Map(JWST_MODES.map(({ mode }) => [mode, { bands: 0, programs: [] as string[], checked: [] as string[] }])), timeSeries: new Map<string, { programs: string[]; checked: string[] }>() };
  const ledger = buildLedger([{ observation: 'a', target: 'TITAN-LEADING', programme: '1251', mode: 'NIRSPEC/IFU', moving: true, raDeg: null, decDeg: null },
    { observation: 'b', target: 'TITAN-BACKGROUND', programme: '1251', mode: 'NIRSPEC/IFU', moving: true, raDeg: null, decDeg: null }],
  [{ exposure: 'MIR_LRS-SLITLESS', programme: '2021', observation: '2', target: 'HD-189733B', raDeg: null, decDeg: null }], new Map(), objects, held, '2026-09-18');
  assert.deepEqual(ledger.objects.map(object => [object.id, object.observations, object.timeSeriesVisits]), [['hd-189733b', {}, { 'MIR_LRS-SLITLESS': 1 }], ['titan', { 'NIRSPEC/IFU': 1 }, {}]]);
  assert.equal(ledger.modes.find(mode => mode.mode === 'NIRSPEC/IFU')!.observations, 2);
});
