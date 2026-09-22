import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { decodeIsis2Qube } from './isis2-qube.mts';

function fixture() {
  const header = `CCSD3ZF0000100000001NJPL3IF0PDS200000001 = SFDU_LABEL
RECORD_TYPE = FIXED_LENGTH
RECORD_BYTES = 512
FILE_RECORDS = 4
LABEL_RECORDS = 3
FILE_STATE = CLEAN
^QUBE = 4
AXES = 3
AXIS_NAME = (SAMPLE,LINE,BAND)
CORE_ITEMS = (2,2,1)
CORE_ITEM_BYTES = 4
CORE_ITEM_TYPE = PC_REAL
CORE_BASE = 0.0
CORE_MULTIPLIER = 1.0
CORE_VALID_MINIMUM = 16#FF7FFFFA#
CORE_NULL = 16#FF7FFFFB#
CORE_LOW_REPR_SATURATION = 16#FF7FFFFC#
CORE_LOW_INSTR_SATURATION = 16#FF7FFFFD#
CORE_HIGH_INSTR_SATURATION = 16#FF7FFFFE#
CORE_HIGH_REPR_SATURATION = 16#FF7FFFFF#
SUFFIX_ITEMS = (0,0,0)
END
`;
  const bytes = Buffer.alloc(2048); bytes.write(header); bytes.writeFloatLE(0, 1536);
  bytes.writeFloatLE(-.125, 1540); bytes.writeUInt32LE(0xff7ffffb, 1544); bytes.writeFloatLE(.25, 1548);
  return bytes;
}
test('legacy ISIS2 keeps finite zero and negative values separate from special pixels', () => {
  const bytes = fixture(), grid = { width: 2, height: 2 }, image = decodeIsis2Qube(bytes, grid);
  assert.deepEqual([...image.valid], [1, 1, 0, 1]);
  assert.deepEqual([...image.data], [0, -.125, NaN, .25]);
  assert.throws(() => decodeIsis2Qube(bytes.subarray(0, 2047), grid), /layout/);
  assert.throws(() => decodeIsis2Qube(bytes, { width: 4, height: 1 }), /layout/);
  const wrong = Buffer.from(bytes); wrong.write('SUN_REAL', bytes.indexOf('PC_REAL'));
  assert.throws(() => decodeIsis2Qube(wrong, grid), /layout|PDS3/);
});
