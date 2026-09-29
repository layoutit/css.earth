import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { loadKernelSet } from '@cssearth/spice/node';
import { utcToEt } from '@cssearth/spice';
import { kernelBankPaths } from '@cssearth/bake/objects/cameras';

// SpiceyPy 8.2.0 / CSPICE_N0067, evaluated with only the two small NAIF kernels below, which the LICIACube bank
// restores on demand. This checks a useful subset even when the larger DART oracle kernels are absent.
const kernels = await kernelBankPaths('liciacube', ['lsk/naif0012.tls', 'pck/pck00010.tpc']);
const utc = '2022-09-26T23:14:12.737Z';
const expectedEt = 717506121.9193614;
const expectedJ2000ToMars = [
  [0.8797050226175893, 0.03537940490177054, -0.47420182505994557],
  [0.16458137106031173, 0.91294093549659, 0.3734324846535435],
  [0.44613007686244893, -0.406555218885956, 0.7972959353435196],
];

test('the LSK and PCK agree with CSPICE for time and a body frame', async () => {
  const set = await loadKernelSet(kernels.map(path => resolve(path)));
  const et = utcToEt(set.leapSeconds, utc);
  assert.ok(Math.abs(et - expectedEt) < 1e-6);
  const actual = set.rotation('IAU_MARS', et);
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
    assert.ok(Math.abs(actual[row]![column]! - expectedJ2000ToMars[row]![column]!) < 1e-9,
      `frame element ${row},${column}: ${actual[row]![column]} vs ${expectedJ2000ToMars[row]![column]}`);
  }
});
