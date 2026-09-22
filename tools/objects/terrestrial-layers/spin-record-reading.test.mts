import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readingPole, spinRecordReading } from './spin-record-reading.mts';
import { OBSERVER_CAMERAS_FILE, parseObserverCameras } from './observer-cameras.mts';

const OBJECTS = resolve(import.meta.dirname, '../../../src/objects');

test('the published pole decides a record either way', () => {
  const iris = spinRecordReading('19.0414 25.8850 7.13884337\n2435469.872840 0\n', { longitudeDegrees: 20, latitudeDegrees: 23 });
  assert.equal(iris.order, 'longitude-first');
  assert.ok(Math.abs(iris.separationDegrees - 3.0) < 0.05 && Math.abs((iris.otherSeparationDegrees ?? 0) - 6.8) < 0.05, `${iris.separationDegrees} ${iris.otherSeparationDegrees}`);
  assert.equal(spinRecordReading('65.29 77.69 5.18364\n2450000 0\n', { longitudeDegrees: 75, latitudeDegrees: 64 }).order, 'latitude-first');
});

test('a pole stated past the south pole is folded, not refused', () => {
  const elektra = spinRecordReading('67.7331 -92.2669 5.224663\n2451000 0\n', { longitudeDegrees: 68, latitudeDegrees: -89 });
  assert.equal(elektra.order, 'longitude-first');
  assert.ok(elektra.separationDegrees < 5 && (elektra.otherSeparationDegrees ?? 0) > 150, `${elektra.separationDegrees} ${elektra.otherSeparationDegrees}`);
});

test('a record the published pole cannot place is refused', () => {
  assert.throws(() => spinRecordReading('50.8485 153.6484 4.27718447\n2434747.0 0\n', { longitudeDegrees: 154, latitudeDegrees: 24 }), /Neither reading/);
  assert.throws(() => spinRecordReading('20 21 7\n2450000 0\n', { longitudeDegrees: 20.5, latitudeDegrees: 20.5 }), /does not decide/);
});

// Bodies whose released record describes a different solution from every published pole; each keeps the finding in its
// ledger. Eleonora's and Thisbe's records disagree with Table A.1 but not with the survey's released model, which their
// lens records state and their figures confirm.
const RECORD_DISAGREES = new Map([['nemesis', 'release-record-solution']]);

test('every released spin record reads one way against its published pole, apart from the recorded disagreement', async () => {
  const unreadable: string[] = [];
  let read = 0;
  for (const id of readdirSync(OBJECTS)) {
    const source = resolve(OBJECTS, id, 'source'), record = resolve(source, 'reference/release-parameters.txt'), lens = resolve(source, OBSERVER_CAMERAS_FILE);
    const stated = existsSync(lens) ? parseObserverCameras(JSON.parse(readFileSync(lens, 'utf8'))).rotation.publishedPole : undefined;
    const pole = existsSync(record) ? await readingPole(source, stated) : null;
    if (!pole) continue;
    try { spinRecordReading(readFileSync(record, 'utf8'), pole); read++; } catch { unreadable.push(id); }
  }
  assert.deepEqual(unreadable.sort(), [...RECORD_DISAGREES.keys()].sort());
  assert.ok(read >= 20, `${read} records read`);
  for (const [id, entry] of RECORD_DISAGREES) {
    const ledger = JSON.parse(readFileSync(resolve(OBJECTS, id, 'investigations.json'), 'utf8')) as { entries: { id: string; status: string }[] };
    assert.equal(ledger.entries.find(e => e.id === entry)?.status, 'unresolved', `${id} keeps ${entry} open`);
  }
});

test('every ground-based lens states the column order its published pole supports', async () => {
  for (const id of readdirSync(OBJECTS)) {
    const source = resolve(OBJECTS, id, 'source'), path = resolve(source, OBSERVER_CAMERAS_FILE);
    if (!existsSync(path)) continue;
    const { rotation } = parseObserverCameras(JSON.parse(readFileSync(path, 'utf8')));
    const pole = await readingPole(source, rotation.publishedPole);
    if (rotation.kind !== 'spin-record' || !pole) continue;
    assert.equal(spinRecordReading(readFileSync(resolve(source, rotation.path), 'utf8'), pole).order, rotation.columnOrder, `${id}: ${rotation.path}`);
  }
});
