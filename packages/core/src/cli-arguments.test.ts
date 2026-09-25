import { expect, it } from 'vitest';
import { flagValue, positionalArguments } from './index.js';

it('an absent value flag does not swallow the first positional argument', () => {
  expect(positionalArguments(['first.fits', 'second.fits'], ['--reach'])).toEqual(['first.fits', 'second.fits']);
  expect(positionalArguments(['europa-pj45', 'work', '--horizons'], ['--raw'])).toEqual(['europa-pj45', 'work']);
});

it('a value flag takes the argument after it wherever it stands, and boolean flags take nothing', () => {
  expect(positionalArguments(['--reach', '200', 'first.fits', 'second.fits'], ['--reach'])).toEqual(['first.fits', 'second.fits']);
  expect(positionalArguments(['id', '--raw', 'frames', 'work', '--horizons'], ['--raw'])).toEqual(['id', 'work']);
  expect(flagValue(['id', '--raw', 'frames'], '--raw')).toBe('frames');
  expect(flagValue(['id'], '--raw')).toBeUndefined();
});
