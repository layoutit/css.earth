import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFileSync } from 'node:fs';
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

test('PDS3 rejects repeated assignments, even identical ones, instead of using the first', () => {
  for (const second of ['16', '8']) {
    assert.throws(() => pds3Keyword(`SAMPLE_BITS = 16\nSAMPLE_BITS = ${second}\n`, 'SAMPLE_BITS'), /Duplicate.*SAMPLE_BITS/);
    assert.throws(() => pds3Values(`OBJECT = IMAGE\nSAMPLE_BITS = 16\nSAMPLE_BITS = ${second}\nEND_OBJECT = IMAGE\n`, 'SAMPLE_BITS', ['IMAGE']), /Duplicate/);
  }
});

test('PDS3 selects explicit OBJECT/GROUP scopes and rejects ambiguous unscoped fields', () => {
  const label = 'SAMPLE_BITS = 8\nOBJECT = IMAGE\nSAMPLE_BITS = 16\nGROUP = CAMERA\nFILTER_NAME = RED\nEND_GROUP\nEND_OBJECT = IMAGE\nEND\n';
  assert.throws(() => pds3Keyword(label, 'SAMPLE_BITS'), /Ambiguous/);
  assert.equal(pds3Keyword(label, 'SAMPLE_BITS', []), '8');
  assert.equal(pds3Keyword(label, 'SAMPLE_BITS', ['IMAGE']), '16');
  assert.equal(pds3Keyword(label, 'FILTER_NAME', ['IMAGE', 'CAMERA']), 'RED');
  assert.equal(pds3Keyword(label, 'FILTER_NAME', ['CAMERA']), undefined);
  assert.equal(pds3Keyword(label, 'FILTER_NAME', []), undefined);
  const repeated = 'OBJECT = IMAGE\nLINES = 1\nEND_OBJECT\nOBJECT = IMAGE\nLINES = 2\nEND_OBJECT\n';
  assert.throws(() => pds3Keyword(repeated, 'LINES', ['IMAGE']), /Ambiguous PDS3 scope/);
});

test('PDS3 quoted descriptions and comments cannot supply or hide actual keywords', () => {
  const label = `/* SAMPLE_BITS = 1 */ SAMPLE_BITS = 2
DESCRIPTION = "Calibration log:
SAMPLE_BITS = 3
OBJECT = FALSE_IMAGE
END
/* this is text */"
SAMPLE_BITS = 16 /* ignored comment */ SAMPLE_BITS = 4
END
SAMPLE_BITS = 5
"unterminated attached bytes`;
  assert.equal(pds3Keyword(label, 'SAMPLE_BITS'), '16');
  assert.match(pds3Keyword(label, 'DESCRIPTION') ?? '', /SAMPLE_BITS = 3/);
  assert.equal(pds3Keyword('DESCRIPTION = "\nUNITS = \'I/F\'\n"\n', 'UNITS'), undefined);
});

test('PDS3 flat sequences and sets preserve quoted commas, units and record-spanning items', () => {
  const label = `FILTER_NAME =
("CL1", /* first filter */
 'RED, NIR',
 BLUE)
SCALES = {1 <KM/(SEC)>, 2 <M>}
^IMAGE = ("image,one.img", 2)
`;
  assert.deepEqual(pds3Values(label, 'FILTER_NAME'), ['CL1', 'RED, NIR', 'BLUE']);
  assert.deepEqual(pds3Values(label.replaceAll('\n', '\r\n'), 'FILTER_NAME'), ['CL1', 'RED, NIR', 'BLUE']);
  assert.deepEqual(pds3Values(label, 'SCALES'), ['1 <KM/(SEC)>', '2 <M>']);
  assert.deepEqual(pds3Values(label, '^IMAGE'), ['image,one.img', '2']);
  assert.equal(pds3Keyword('cassini:target_name = SATURN', 'CASSINI:TARGET_NAME'), 'SATURN');
});

test('PDS3 refuses malformed scopes, incomplete values and unsupported selected list shapes', () => {
  for (const label of ['OBJECT = IMAGE\nX = 1\n', 'END_OBJECT\nX = 1', 'OBJECT = IMAGE\nEND_GROUP = IMAGE',
    'OBJECT = IMAGE\nEND_OBJECT = TABLE', 'OBJECT = IMAGE\nEND', 'X =', 'X =\nY = 1',
    'X = "unfinished', 'X = (1, 2', 'X = (1, 2}', 'X = /* unfinished',
    'X = ()', 'X = (1,)', 'X = (,1)', 'X = ((1,2))', 'X = "one" "two"', 'X = 1; X = 2']) {
    assert.throws(() => pds3Values(label, 'X'), /PDS3/, label);
  }
  assert.throws(() => pds3Values('X = 1', ''), /keyword/);
  assert.throws(() => pds3Values('X = 1', 'X', ['.*']), /selector/);
});

test('PDS3 bounds label size and structural nesting', () => {
  assert.throws(() => pds3Keyword(' '.repeat(8 * 1024 * 1024 + 1), 'X'), /limit/);
  assert.throws(() => pds3Keyword('OBJECT = IMAGE\n'.repeat(65), 'X'), /nesting/);
  assert.throws(() => pds3Keyword('X = ' + '('.repeat(65), 'X'), /nesting/);
});

test('native Cassini and Voyager labels retain observation identity and distinguish calibration prose from fields', () => {
  const read = (path: string) => readFileSync(new URL(`../../src/objects/${path}`, import.meta.url), 'utf8');
  const cassini = read('tethys/source/observations/N1807429484_1_CALIB.LBL');
  assert.equal(pds3Keyword(cassini, 'TARGET_NAME', []), 'TETHYS');
  assert.equal(pds3Keyword(cassini, 'START_TIME', []), '2015-101T06:43:09.680');
  assert.equal(pds3Keyword(cassini, 'SPACECRAFT_CLOCK_START_COUNT', []), '1807429484.105');
  assert.deepEqual(pds3Values(cassini, 'FILTER_NAME', []), ['CL1', 'CL2']);
  assert.equal(pds3Keyword(cassini, 'UNITS'), undefined);
  assert.match(pds3Keyword(cassini, 'DESCRIPTION', []) ?? '', /UNITS = 'I\/F'/);
  assert.equal(pds3Keyword(cassini, 'SAMPLE_BITS', ['IMAGE']), '32');
  const voyager = read('proteus/source/observations/C1137339_GEOMED.LBL');
  assert.equal(pds3Keyword(voyager, 'REFLECTANCE_SCALING_FACTOR', []), undefined);
  assert.equal(pds3Keyword(voyager, 'REFLECTANCE_SCALING_FACTOR', ['IMAGE']), '1.0000E-04');
  assert.equal(pds3Keyword(voyager, 'FILTER_NAME', []), 'BLUE');
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

test('PDS4 numbers accept finite decimal notation, never empty text or JavaScript numeric extensions', () => {
  for (const [text, value] of [['0', 0], ['-0', -0], ['+12', 12], ['.25', .25], ['1.', 1], ['-1.25E+3', -1250], [' 1e-3 ', .001]] as const) {
    assert.equal(pds4Number(`<offset unit="byte">${text}</offset>`, 'offset', 'byte'), value);
  }
  for (const text of ['', ' ', '\r\n\t', '0x10', '0b10', '0o10', 'NaN', 'Infinity', '-Infinity', '1e999', '1_000', '1 2', '<x>1</x>', '1<!--comment-->']) {
    assert.throws(() => pds4Number(`<offset unit="byte">${text}</offset>`, 'offset', 'byte'), /Invalid PDS4 number/);
  }
  assert.throws(() => pds4Number('<offset>1</offset><offset>2</offset>', 'offset'), /ambiguous/);
});
