import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pyFloatRepr, pyInt, pyRound, pythonJson, type PyJson } from './python-json.mts';

// Literals from Python 3 (repr(round(v, n)) for n = 0 .. 4, and json.dumps).
const VALUES = [0.125, 2.675, -0.0001, 0.0005, 1.0005, -2.5, 2.5, 0.5, 1.5, 12345.6785, -9.127499999999999, 1e-05, 3.0000000000000004, 0.0, -0.0, 7.38443e-7, 0.0083];
const ROUNDED = [['0.0', '0.1', '0.12', '0.125', '0.125'], ['3.0', '2.7', '2.67', '2.675', '2.675'], ['-0.0', '-0.0', '-0.0', '-0.0', '-0.0001'], ['0.0', '0.0', '0.0', '0.001', '0.0005'],
  ['1.0', '1.0', '1.0', '1.0', '1.0005'], ['-2.0', '-2.5', '-2.5', '-2.5', '-2.5'], ['2.0', '2.5', '2.5', '2.5', '2.5'], ['0.0', '0.5', '0.5', '0.5', '0.5'], ['2.0', '1.5', '1.5', '1.5', '1.5'],
  ['12346.0', '12345.7', '12345.68', '12345.678', '12345.6785'], ['-9.0', '-9.1', '-9.13', '-9.127', '-9.1275'], ['0.0', '0.0', '0.0', '0.0', '0.0'], ['3.0', '3.0', '3.0', '3.0', '3.0'],
  ['0.0', '0.0', '0.0', '0.0', '0.0'], ['-0.0', '-0.0', '-0.0', '-0.0', '-0.0'], ['0.0', '0.0', '0.0', '0.0', '0.0'], ['0.0', '0.0', '0.01', '0.008', '0.0083']];

test('pyRound rounds as Python does: correctly, ties to even on the exact value, the sign kept', () => {
  VALUES.forEach((v, i) => assert.deepEqual([0, 1, 2, 3, 4].map(n => pyFloatRepr(pyRound(v, n))), ROUNDED[i], `round(${v}, n)`));
  assert.throws(() => pyRound(1, -1), RangeError);
});

test('pythonJson writes what json.dumps writes', () => {
  const value = new Map<string, Parameters<typeof pythonJson>[0]>([
    ['a', [1.0, -0.0, 1e-05, 1e16, 1.5e16, 123456789012345.6, 1234567890123456.0, 0.0001, 0.001, NaN, Infinity, -Infinity, 5e-324, 1.7976931348623157e308, 0.1, 2 / 3]],
    ['b', 'é☃\u{1F600}"\\\n\t\x01\x7f'], ['c', [pyInt(3), pyInt(-7), pyInt(2n ** 70n), true, false, null]], ['d', {}], ['e', []]]);
  assert.equal(pythonJson(value), '{"a": [1.0, -0.0, 1e-05, 1e+16, 1.5e+16, 123456789012345.6, 1234567890123456.0, 0.0001, 0.001, NaN, Infinity, -Infinity, 5e-324, 1.7976931348623157e+308, 0.1, 0.6666666666666666], "b": "\\u00e9\\u2603\\ud83d\\ude00\\"\\\\\\n\\t\\u0001\\u007f", "c": [3, -7, 1180591620717411303424, true, false, null], "d": {}, "e": []}');
  assert.equal(pythonJson({ east: -9.127, n: pyInt(2) }), '{"east": -9.127, "n": 2}');
  assert.throws(() => pyInt(0.5), RangeError);
});

test('the tracked source records read back and rewrite to the same bytes', async t => {
  const source = resolve(import.meta.dirname, '../../../../../../src/objects/homunculus-nebula-layers/source');
  for (const file of ['cloud-points.json', 'tube.json', 'kinematics.json']) {
    const text = await readFile(resolve(source, file), 'utf8').catch(() => undefined);
    if (text === undefined) { t.diagnostic(`${file} absent`); continue; }
    // kinematics.json's peak counts and tube.json's traced cells are Python ints; every other number is a float.
    const ints = (key: string, value: unknown): unknown => key === 'peaks' ? pyInt(value as number) : key === 'traced' ? (value as number[][]).map(cell => cell.map(v => pyInt(v))) : value;
    assert.equal(pythonJson(JSON.parse(text, (key, value: unknown) => ints(key, value)) as PyJson), text, file);
  }
});
