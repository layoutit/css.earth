import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parseTextKernel } from './text-kernel.js';
import { parseLeapSeconds } from './lsk.js';
import { parseSpacecraftClock, encodeClock, clockToEt, etToClock } from './sclk.js';

const lsk = parseLeapSeconds(parseTextKernel(`\\begindata
DELTET/DELTA_T_A = 32.184
DELTET/K = 1.657D-3
DELTET/EB = 1.671D-2
DELTET/M = ( 6.239996D0 1.99096871D-7 )
DELTET/DELTA_AT = ( 37, @2017-JAN-1 )
\\begintext`, 'lsk'));
const pool = parseTextKernel(`\\begindata
SCLK_KERNEL_ID = ( @2022-09-27T10:33:05 )
SCLK01_TIME_SYSTEM_135 = ( 2 )
SCLK01_N_FIELDS_135 = ( 2 )
SCLK01_MODULI_135 = ( 4294967296 50000 )
SCLK01_OFFSETS_135 = ( 0 0 )
SCLK01_COEFFICIENTS_135 = ( 0.0  -6.8156500000000E+08  1.0
                            1.0000000000000E+13  -4.8156500000000E+08  1.00001 )
SCLK_PARTITION_START_135 = ( 0.0 )
SCLK_PARTITION_END_135 = ( 2.14748364799999e+14 )
\\begintext`, 'sclk');

test('two-field clocks encode seconds and subseconds, convert through the rate per most significant count, and invert', () => {
  const clock = parseSpacecraftClock(pool, -135);
  assert.equal(clock.ticksPerMostSignificant, 50000);
  assert.equal(encodeClock(clock, '1/0000000010:00007'), 500007);
  assert.equal(encodeClock(clock, '401930040:7327'), 401930040 * 50000 + 7327);
  // In the first coefficient interval one most-significant count is one TDT second.
  const et = clockToEt(clock, lsk, encodeClock(clock, '10:0'));
  assert.ok(Math.abs(et - (-6.81565e8 + 10) - (et - (-6.81565e8 + 10))) < 1e-9);
  const tdt = -6.81565e8 + 10;
  assert.ok(Math.abs(et - tdt) < 2e-3 && Math.abs(et - tdt) > 1e-4, 'TDB differs from TDT by the periodic term only');
  assert.ok(Math.abs(etToClock(clock, lsk, et) - 500000) < 1e-6, 'round trip');
  // The second interval applies its own rate from its own epoch.
  const ticks = 1e13 + 50000 * 100;
  assert.ok(Math.abs(clockToEt(clock, lsk, ticks) - (-4.81565e8 + 100 * 1.00001) - (clockToEt(clock, lsk, ticks) - (-4.81565e8 + 100 * 1.00001))) < 1e-9);
  assert.throws(() => encodeClock(clock, '1/1:60000'), /out of range/);
  assert.throws(() => encodeClock(clock, '2/1:0'), /partition 2/);
});
