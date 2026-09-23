import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { loadKernelSet } from './kernel-set.mts';
import { utcToEt } from './lsk.mts';

// SpiceyPy 8.2.0 / CSPICE_N0067, evaluated with only the two tracked NAIF kernels below.
// This checks a useful subset even when the larger, ignored DART oracle kernel bank is absent.
const kernels = [
  'src/objects/dimorphos/source/spice/lsk/naif0012.tls',
  'src/objects/dimorphos/source/spice/pck/pck00010.tpc',
];
const sourceSha256 = [
  '678e32bdb5a744117a467cd9601cd6b373f0e9bc9bbde1371d5eee39600a039b',
  '59468328349aa730d18bf1f8d7e86efe6e40b75dfb921908f99321b3a7a701d2',
];
const utc = '2022-09-26T23:14:12.737Z';
const expectedEt = 717506121.9193614;
const expectedJ2000ToMars = [
  [0.8797050226175893, 0.03537940490177054, -0.47420182505994557],
  [0.16458137106031173, 0.91294093549659, 0.3734324846535435],
  [0.44613007686244893, -0.406555218885956, 0.7972959353435196],
];

test('tracked LSK and PCK agree with CSPICE for time and a body frame', async () => {
  for (let index = 0; index < kernels.length; index++) {
    assert.equal(createHash('sha256').update(await readFile(kernels[index]!)).digest('hex'), sourceSha256[index]);
  }
  const set = await loadKernelSet(kernels.map(path => resolve(path)));
  const et = utcToEt(set.leapSeconds, utc);
  assert.ok(Math.abs(et - expectedEt) < 1e-6);
  const actual = set.rotation('IAU_MARS', et);
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
    assert.ok(Math.abs(actual[row]![column]! - expectedJ2000ToMars[row]![column]!) < 1e-9,
      `frame element ${row},${column}: ${actual[row]![column]} vs ${expectedJ2000ToMars[row]![column]}`);
  }
});
