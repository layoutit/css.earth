import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { binaryTable, numbers, readFitsHdus, tableColumn } from './fits-table.mts';
import { findLostFringes, pairVisibilities, removeLostFringes, type ExposureVisibilities } from './lost-fringes.mts';

const repository = resolve(import.meta.dirname, '../../..');
const exposure = (id: string, block: number, pairs: Record<string, number>, object = 'STAR'): ExposureVisibilities => ({ id, object, block, pairs: new Map(Object.entries(pairs)) });

test('a pair lost for one block is found against the blocks around it, and a pair near a null is not', () => {
  const lost = findLostFringes([
    exposure('a', 1, { '1-2': 0.30, '3-4': 0.0004 }), exposure('b', 3, { '1-2': 0.0002, '3-4': 0.00003 }), exposure('c', 5, { '1-2': 0.28, '3-4': 0.0005 }),
    // Another object's blocks in between are not neighbours.
    exposure('d', 4, { '1-2': 0.9 }, 'CALIBRATOR'),
  ]);
  assert.deepEqual([...lost], [['b', ['1-2']]]);
});

test('the first block is checked against the next one, and two lost blocks in a row are both found', () => {
  const lost = findLostFringes([exposure('a', 0, { '1-2': 0.001 }), exposure('b', 1, { '1-2': 0.002 }), exposure('c', 2, { '1-2': 0.3 }), exposure('d', 3, { '1-2': 0.31 })]);
  assert.deepEqual([...lost.keys()], ['b']);
  assert.deepEqual([...findLostFringes([exposure('a', 0, { '1-2': 0.3 }), exposure('b', 1, { '1-2': 0.001 }), exposure('c', 2, { '1-2': 0.001 }), exposure('d', 3, { '1-2': 0.3 })]).keys()], ['b', 'c']);
  assert.equal(findLostFringes([exposure('only', 0, { '1-2': 0 })]).size, 0);
});

test('removing a pair flags its squared visibilities and every closure phase that uses it, with errors pndrs ignores', async () => {
  const input = await readFile(resolve(repository, 'src/objects/pi1-gruis/source/observations/PI_GRU_forImage.fits'));
  const before = pairVisibilities(input), { bytes, vis2, closures } = removeLostFringes(input, ['1-2']);
  assert.ok(before.has('1-2') && vis2 > 0 && closures > 0);
  assert.equal(pairVisibilities(bytes).has('1-2'), false);
  for (const hdu of readFitsHdus(bytes).filter(hdu => hdu.extname === 'OI_VIS2' || hdu.extname === 'OI_T3')) {
    const table = binaryTable(hdu), error = tableColumn(table, hdu.extname === 'OI_VIS2' ? 'VIS2ERR' : 'T3PHIERR');
    for (let row = 0; row < table.rows; row++) {
      const stations = numbers(bytes, table, row, tableColumn(table, 'STA_INDEX')), uses = stations.includes(1) && stations.includes(2);
      assert.equal(numbers(bytes, table, row, tableColumn(table, 'FLAG')).every(Boolean), uses || numbers(input, table, row, tableColumn(table, 'FLAG')).every(Boolean));
      if (uses) assert.ok(numbers(bytes, table, row, error).every(value => value >= 1e5));
    }
  }
});

test('on π¹ Gruis\'s first night the rule removes the baselines the author removed', async t => {
  const night = resolve(repository, 'output/stars/pi1-gruis-pionier-2014-09/nights/2014-09-25/lost-fringes.json');
  if (!await access(night).then(() => true, () => false)) return t.skip('run image-star.mts on the π¹ Gruis season first');
  const lost = JSON.parse(await readFile(night, 'utf8')) as Record<string, string[]>;
  // Block 1 (23:23 UT) lost telescope 3; the two-exposure block 21 (03:04 UT) lost four of six baselines.
  assert.deepEqual(lost, {
    ...Object.fromEntries([0, 1, 2, 3, 4].map(exposure => [`raw-1-${exposure}`, ['1-3', '3-4', '2-3']])),
    ...Object.fromEntries([0, 1].map(exposure => [`raw-21-${exposure}`, ['1-4', '3-4', '1-2', '2-3']])),
  });
});
