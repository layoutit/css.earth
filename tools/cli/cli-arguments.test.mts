import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { flagValue, positionalArguments } from './cli-arguments.mts';

test('an absent value flag does not swallow the first positional argument', () => {
  assert.deepEqual(positionalArguments(['first.fits', 'second.fits'], ['--reach']), ['first.fits', 'second.fits']);
  assert.deepEqual(positionalArguments(['europa-pj45', 'work', '--horizons'], ['--raw']), ['europa-pj45', 'work']);
});

test('a value flag takes the argument after it wherever it stands, and boolean flags take nothing', () => {
  assert.deepEqual(positionalArguments(['--reach', '200', 'first.fits', 'second.fits'], ['--reach']), ['first.fits', 'second.fits']);
  assert.deepEqual(positionalArguments(['id', '--raw', 'frames', 'work', '--horizons'], ['--raw']), ['id', 'work']);
  assert.equal(flagValue(['id', '--raw', 'frames'], '--raw'), 'frames');
  assert.equal(flagValue(['id'], '--raw'), undefined);
});
