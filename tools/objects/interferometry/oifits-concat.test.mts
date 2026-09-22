import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { binaryTable, binaryTableHdu, numbers, primaryHdu, readFitsHdus, tableColumn } from './fits-table.mts';
import { subsetOifits } from './oifits-concat.mts';

const table = (name: string, columns: Parameters<typeof binaryTableHdu>[1], rows: Parameters<typeof binaryTableHdu>[2], cards: Parameters<typeof binaryTableHdu>[3]) => binaryTableHdu(name, columns, rows, cards);
const input = (array = 'ARRAY', observableArray = array) => Buffer.concat([
  primaryHdu(),
  table('OI_TARGET', [{ name: 'TARGET_ID', form: 'I' }, { name: 'TARGET', form: '8A' }], [[1, 'Europa'], [2, 'Io']], []),
  table('OI_WAVELENGTH', [{ name: 'EFF_WAVE', form: 'D' }, { name: 'EFF_BAND', form: 'D' }], [[4.5e-7, 1e-8], [4.6e-7, 1e-8]], [['INSNAME', 'STIS']]),
  table('OI_ARRAY', [{ name: 'STA_INDEX', form: 'I' }, { name: 'STA_NAME', form: '4A' }], [[1, 'A'], [2, 'B'], [3, 'C']], [['ARRNAME', array]]),
  table('OI_CORR', [{ name: 'IINDX', form: 'J' }, { name: 'JINDX', form: 'J' }, { name: 'CORR', form: 'D' }], [[1, 2, 0.25]], [['CORRNAME', 'COV']]),
  table('OI_VIS', [{ name: 'TARGET_ID', form: 'I' }, { name: 'MJD', form: 'D' }, { name: 'VISAMP', form: '2D' }, { name: 'VISAMPERR', form: '2D' }, { name: 'VISPHI', form: '2D' }, { name: 'VISPHIERR', form: '2D' }, { name: 'STA_INDEX', form: '2I' }, { name: 'FLAG', form: '2L' }],
    [[1, 60000, [0.4, 0.5], [0.04, 0.05], [10, 20], [1, 2], [1, 2], [false, true]], [2, 60001, [0.6, 0.7], [0.06, 0.07], [30, 40], [3, 4], [2, 3], [true, false]]], [['INSNAME', 'STIS'], ['ARRNAME', observableArray], ['CORRNAME', 'COV'], ['PHIORDER', 1]]),
  table('OI_VIS2', [{ name: 'TARGET_ID', form: 'I' }, { name: 'VIS2DATA', form: '2D' }, { name: 'VIS2ERR', form: '2D' }, { name: 'STA_INDEX', form: '2I' }, { name: 'FLAG', form: '2L' }], [[1, [0.16, 0.25], [0.01, 0.02], [1, 2], [false, false]]], [['INSNAME', 'STIS'], ['ARRNAME', observableArray], ['CORRNAME', 'COV']]),
  table('OI_T3', [{ name: 'TARGET_ID', form: 'I' }, { name: 'T3PHI', form: '2D' }, { name: 'T3PHIERR', form: '2D' }, { name: 'STA_INDEX', form: '3I' }, { name: 'FLAG', form: '2L' }], [[1, [2, 3], [0.2, 0.3], [1, 2, 3], [false, true]]], [['INSNAME', 'STIS'], ['ARRNAME', observableArray], ['CORRNAME', 'COV']]),
]);

test('selected OIFITS rows reopen with their linked tables, flags, errors and phase convention byte-preserved', () => {
  const source = input(), subset = subsetOifits(source, { OI_VIS: [1], OI_VIS2: [0], OI_T3: [0] }), sourceVis = binaryTable(readFitsHdus(source).find(hdu => hdu.extname === 'OI_VIS')!), outputVis = binaryTable(readFitsHdus(subset).find(hdu => hdu.extname === 'OI_VIS')!);
  const reopened = readFitsHdus(subset), names = reopened.map(hdu => hdu.extname);
  assert.deepEqual(names, ['PRIMARY', 'OI_TARGET', 'OI_WAVELENGTH', 'OI_ARRAY', 'OI_CORR', 'OI_VIS', 'OI_VIS2', 'OI_T3']);
  assert.equal(binaryTable(reopened.find(hdu => hdu.extname === 'OI_TARGET')!).rows, 2);
  assert.equal(outputVis.rows, 1);
  assert.equal(outputVis.hdu.header.PHIORDER, 1);
  assert.deepEqual(numbers(subset, outputVis, 0, tableColumn(outputVis, 'VISPHI')), [30, 40]);
  assert.deepEqual(numbers(subset, outputVis, 0, tableColumn(outputVis, 'VISAMPERR')), [0.06, 0.07]);
  assert.deepEqual(numbers(subset, outputVis, 0, tableColumn(outputVis, 'FLAG')), [1, 0]);
  assert.deepEqual(subset.subarray(outputVis.hdu.dataOffset, outputVis.hdu.dataOffset + outputVis.rowBytes), source.subarray(sourceVis.hdu.dataOffset + sourceVis.rowBytes, sourceVis.hdu.dataOffset + 2 * sourceVis.rowBytes));
});

test('OIFITS subset refuses a selected row whose linked array table is absent', () => assert.throws(() => subsetOifits(input('OTHER', 'ARRAY'), { OI_VIS: [0] }), /No OI_ARRAY/u));
