import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256 } from '../../src/platform/sha256.mts';
import { horizonsRows, observerRowValues } from './terrestrial-layers/observer-cameras.mts';
import { BATCH, LIGHT_SECONDS_PER_AU, horizonsCommand, horizonsTables, joinResponses, observerQuery, writeHorizonsTables } from './sphere-horizons.mts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const calendar = (jd: number) => {
  const date = new Date(Math.round((jd - 2440587.5) * 86_400_000)), pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return `${date.getUTCFullYear()}-${MONTHS[date.getUTCMonth()]}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
};
const response = (rows: readonly string[]) => `API VERSION: 1.2\nTarget body name: 7 Iris (A847 PA)\n$$SOE\n${rows.join('\n')}\n$$EOE\nColumn meaning:\n`;
const epochsOf = (url: string) => (new URL(url).searchParams.get('TLIST') ?? '').replace(/'/g, '').split(' ').map(Number);
/** Horizons as the tables need it: an observer row at each asked epoch with a range that grows with the row, and a vector pair per asked epoch. */
function fakeHorizons(asked: string[]) {
  return async (url: string) => {
    asked.push(url);
    const epochs = epochsOf(url);
    if (new URL(url).searchParams.get('EPHEM_TYPE') === "'OBSERVER'") return response(epochs.map(jd => ` ${calendar(jd)}  m   34.85884  23.43527  0.307632  ${(0.9 + (jd % 1) / 10).toFixed(14)}  -7.7749626   13.2559   13.2510  34.0598   6.7060`));
    return response(epochs.flatMap(jd => [`${jd.toFixed(9)} = A.D. ${calendar(jd)} TDB `, ' X = 1.630292157034432E+00 Y = 7.344829025493211E-01 Z = 4.709774264887426E-01']));
  };
}

test('the target is the one the astronomy record already queries', () => {
  assert.equal(horizonsCommand({ asteroid: { query: 'https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%277%3B%27&EPHEM_TYPE=ELEMENTS' } }), '7;');
  assert.throws(() => horizonsCommand({ asteroid: {} }), /no Horizons target/);
  assert.throws(() => horizonsCommand({ a: 'https://ssd.jpl.nasa.gov/api/horizons.api?COMMAND=%277%3B%27', b: 'https://ssd.jpl.nasa.gov/api/horizons.api?COMMAND=%278%3B%27' }), /7;, 8;/);
});

test('the observer query asks Paranal for exactly the stated exposure starts', () => {
  const query = observerQuery('7;', [2458036.664037720, 2458037.694929]);
  assert.equal(query.get('CENTER'), "'309'");
  assert.equal(query.get('TLIST'), "'2458036.664037720 2458037.694929000'");
  assert.equal(query.get('TIME_TYPE'), "'UT'");
});

test('thirty exposures go in two batches per table and come back as one table each, in time order', async () => {
  const starts = Array.from({ length: 30 }, (_, index) => 2458036.66 + index * 0.01).reverse(), asked: string[] = [];
  const { observer, heliocentric, epochs } = await horizonsTables('7;', [...starts, starts[0]], fakeHorizons(asked));
  assert.equal(asked.length, 4, 'two observer and two heliocentric requests');
  assert.deepEqual(asked.map(url => epochsOf(url).length), [BATCH, 30 - BATCH, BATCH, 30 - BATCH]);
  assert.deepEqual(epochs, [...new Set(starts)].sort((a, b) => a - b), 'a repeated start is asked once');
  assert.equal(observer.match(/\$\$SOE/g)?.length, 1);
  const rows = horizonsRows(observer), vectors = horizonsRows(heliocentric).filter(line => line.trimStart().startsWith('X ='));
  assert.equal(rows.length, 30); assert.equal(vectors.length, 30);
  const heliocentricEpochs = asked.slice(2).flatMap(epochsOf);
  heliocentricEpochs.forEach((epoch, index) => assert.ok(Math.abs(epoch - (epochs[index] - observerRowValues(rows[index]).rangeAu * LIGHT_SECONDS_PER_AU / 86_400)) < 1e-8, 'light left the body one light time earlier'));
});

test('a row that is not at its exposure start is refused, as the derivation would never match it', async () => {
  const shifted = async (url: string) => (await fakeHorizons([])(url)).replace(/(\d{2}:\d{2}):(\d{2})/, (_, minutes, seconds) => `${minutes}:${String((Number(seconds) + 5) % 60).padStart(2, '0')}`);
  await assert.rejects(horizonsTables('7;', [2458036.6600001], shifted), /not at its exposure start/);
  assert.throws(() => joinResponses(['no data here']), /no data block/);
});

test('writing keeps a table the manifest names and declares one it does not', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sphere-horizons-'));
  await writeFile(join(directory, 'manifest.json'), JSON.stringify({ schema: 'x', inputs: [{ id: 'iris-horizons-sphere-observer', path: 'observer.txt' }] }));
  const declared = await writeHorizonsTables('iris', directory, { observer: 'observer.txt', heliocentric: 'heliocentric.txt' }, { observer: 'OBS', heliocentric: 'HELIO' });
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  assert.deepEqual(declared, ['heliocentric.txt']);
  assert.equal(await readFile(join(directory, 'observer.txt'), 'utf8'), 'OBS');
  assert.equal(manifest.inputs[1].id, 'iris-horizons-sphere-heliocentric');
  assert.equal(await readFile(join(directory, 'heliocentric.txt'), 'utf8'), 'HELIO');
  assert.equal(manifest.inputs[1].sourceBinding, undefined, 'binding is author:sources’ job');
  assert.equal(await readFile(join(directory, 'heliocentric.txt'), 'utf8'), 'HELIO');
});
