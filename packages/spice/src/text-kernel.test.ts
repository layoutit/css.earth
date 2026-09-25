import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parseTextKernel, parseDateToken, numbers, strings, number } from './text-kernel.js';
import { parseLeapSeconds, utcToEt } from './lsk.js';

const lskText = `KPL/LSK
Documentation with an = sign and a 'quote' that must be ignored.
\\begindata
DELTET/DELTA_T_A       =   32.184
DELTET/K               =   1.657D-3
DELTET/EB              =   1.671D-2
DELTET/M               = (  6.239996D0   1.99096871D-7 )
DELTET/DELTA_AT        = ( 10,   @1972-JAN-1
                           11,   @1972-JUL-1
                           32,   @1999-JAN-1
                           37,   @2017-JAN-1 )
\\begintext
trailing prose
\\begindata
NAME = 'it''s quoted'
LIST += ( 1, 2 )
LIST += 3
\\begintext`;

test('parses data blocks, D exponents, quoted strings, dates and += appends; ignores prose', () => {
  const pool = parseTextKernel(lskText, 'naif0012.tls');
  assert.equal(number(pool, 'DELTET/K'), 1.657e-3);
  assert.deepEqual(numbers(pool, 'DELTET/M'), [6.239996, 1.99096871e-7]);
  assert.deepEqual(strings(pool, 'NAME'), ["it's quoted"]);
  assert.deepEqual(numbers(pool, 'LIST'), [1, 2, 3]);
  assert.equal(parseDateToken('@2000-JAN-1/12:00:00'), 0);
  assert.equal(parseDateToken('@2000-01-02'), -43200 + 86400);
  assert.deepEqual(pool.sources, ['naif0012.tls']);
});

test('leap seconds and the TDB periodic term reproduce ET at reference instants', () => {
  const lsk = parseLeapSeconds(parseTextKernel(lskText, 'naif0012.tls'));
  assert.equal(lsk.table.at(-1)?.leapSeconds, 37);
  // J2000 epoch: 2000-01-01T12:00:00 UTC is ET 64.1839 s (32 leap seconds + 32.184 s + the periodic term).
  assert.ok(Math.abs(utcToEt(lsk, '2000-01-01T12:00:00Z') - 64.1839) < 1e-3);
  // DART impact epoch: 37 leap seconds are in force.
  const et = utcToEt(lsk, '2022-09-26T23:14:12.737Z');
  const seconds = (Date.UTC(2022, 8, 26, 23, 14, 12) - Date.UTC(2000, 0, 1, 12)) / 1000 + 0.737 + 37 + 32.184;
  assert.ok(Math.abs(et - seconds) < 2e-3, `${et} vs ${seconds}`);
});

test('frame-kernel date tokens accept dash-separated times, five-digit years and B.C. years', () => {
  assert.equal(parseDateToken('@2022-09-26-23:15:33.366361'), (Date.UTC(2022, 8, 26, 23, 15, 0) - Date.UTC(2000, 0, 1, 12)) / 1000 + 33.366361);
  assert.ok(parseDateToken('@17191-MAR-15-00:00:00.000') > 4e11);
  assert.ok(parseDateToken('@13201B.C.-MAY-06-00:00:00.000') < -4e11);
});

test('day-first date tokens parse like year-first ones', () => {
  assert.equal(parseDateToken('@01-JAN-2010-00:01:06.184000'), parseDateToken('@2010-JAN-01/00:01:06.184'));
  assert.equal(parseDateToken('@1972-JAN-1'), (Date.UTC(1972, 0, 1) - Date.UTC(2000, 0, 1, 12)) / 1000);
});
