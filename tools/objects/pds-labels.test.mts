import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pds3Keyword, pds3Values, pds4Block, pds4Blocks, pds4Elements, pds4Field, pds4Number } from './pds-labels.mts';

test('PDS3 keywords read quoted values and lists without their quotes', () => {
  const label = 'FILTER_NAME = ("CL1","GRN")\nUNITS = \'I/F\'\n  TARGET_NAME = "HYPERION"\nREFLECTANCE_SCALING_FACTOR = 1.000000E-04\n';
  assert.deepEqual(pds3Values(label, 'FILTER_NAME'), ['CL1', 'GRN']);
  assert.equal(pds3Keyword(label, 'FILTER_NAME'), 'CL1,GRN');
  assert.equal(pds3Keyword(label, 'UNITS'), 'I/F');
  assert.equal(pds3Keyword(label, 'TARGET_NAME'), 'HYPERION');
  assert.equal(pds3Keyword(label, 'REFLECTANCE_SCALING_FACTOR'), '1.000000E-04');
  assert.equal(pds3Keyword(label, 'START_TIME'), undefined);
});

test('PDS4 fields are exactly one element, blocks keep nested content and numbers carry their declared unit', () => {
  const xml = '<a><x>1</x><x>2</x><w unit="nm"> 475 </w><b><c>3</c></b></a>';
  assert.throws(() => pds4Field(xml, 'x'), /Expected one/);
  assert.deepEqual(pds4Blocks(xml, 'x'), ['1', '2']);
  assert.equal(pds4Number(xml, 'w', 'nm'), 475);
  assert.throws(() => pds4Number(xml, 'w', 'm'), /unit/);
  assert.equal(pds4Block(xml, 'b'), '<c>3</c>');
  assert.throws(() => pds4Field(xml, 'b'), /Expected one/);
  assert.deepEqual(pds4Elements(xml, 'w'), [{ tag: '<w unit="nm">', content: ' 475 ' }]);
});
