import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { eruptionShares } from './eruption-share.mts';
import { NATIVE, inspect, resample } from './simulation.mts';
import { openTecplot, readTecplotVariable } from './tecplot-binary.mts';
import { tecplotBytes, twoBrickSolution } from './tecplot-fixture.mts';

async function withFile<T>(bytes: Buffer, run: (path: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-tecplot-'));
  try { const path = join(directory, 'solution.plt'); await writeFile(path, bytes); return await run(path); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('a Tecplot binary file gives its variables, its zone layout and each variable\'s values', async () => {
  await withFile(twoBrickSolution([1e-18, 2e-18, 3e-18]), async path => {
    const file = await openTecplot(path);
    assert.equal(file.version, 112);
    assert.deepEqual(file.variables.slice(0, 4), ['X [R]', 'Y [R]', 'Z [R]', '`r [g/cm^3]']);
    assert.equal(file.zones.length, 1);
    assert.deepEqual([file.zones[0]!.points, file.zones[0]!.elements, file.zones[0]!.connectivity?.nodesPerElement], [12, 2, 8]);
    assert.deepEqual([...await readTecplotVariable(file, 0, 'X [R]')], [-4, -4, -4, -4, 0, 0, 0, 0, 4, 4, 4, 4]);
    const density = file.zones[0]!.variables.find(variable => variable.name === '`r [g/cm^3]')!;
    assert.ok(Math.abs(density.minimum! - 1e-18) < 1e-24 && Math.abs(density.maximum! - 3e-18) < 1e-24);
    assert.equal((await inspect(path)).zones[0]!.points, 12);
  });
});

test('a file that is not Tecplot binary, or that ends early, is refused', async () => {
  await withFile(Buffer.from('not a tecplot file at all'), async path => { await assert.rejects(openTecplot(path), /Not a Tecplot binary file/); });
  const whole = twoBrickSolution([1, 2, 3]);
  await withFile(whole.subarray(0, whole.length - 4), async path => { await assert.rejects(openTecplot(path), /zones end at byte|ends inside/); });
  await withFile(tecplotBytes({ variables: ['X [R]'], values: [[0, 1]], bricks: [] }), async path => { await assert.rejects(readTecplotVariable(await openTecplot(path), 0, 'rho'), /no variable "rho"/); });
});

test('each simulation cell paints the voxels inside it with the mean of its corners', async () => {
  await withFile(twoBrickSolution([1e-18, 2e-18, 3e-18]), async path => {
    const { density, field, measured } = await resample(path), { size } = NATIVE, at = (i: number, j: number, k: number) => (k * size + j) * size + i;
    assert.equal(measured.cellsInside, 2);
    assert.equal(measured.coveredShare, 1);
    // The plane x = 0 is shared: the left brick averages 1e-18 and 2e-18, the right one 2e-18 and 3e-18.
    assert.ok(Math.abs(density[at(10, 64, 64)]! / 1.5e-18 - 1) < 1e-5);
    assert.ok(Math.abs(density[at(110, 20, 100)]! / 2.5e-18 - 1) < 1e-5);
    assert.ok(Math.abs(field[at(10, 64, 64)]! - 5) < 1e-5);
  });
});

test('an eruption is the part of the volume where one run departs from the median of the three', () => {
  const { size, halfUnits } = NATIVE, step = 2 * halfUnits / size;
  const quiet = new Float32Array(size ** 3).fill(1), northern = new Float32Array(size ** 3).fill(1);
  for (let k = 0; k < size; k++) if (-halfUnits + (k + 0.5) * step > 0) northern.fill(2, k * size * size, (k + 1) * size * size);
  const shares = eruptionShares([northern, quiet, quiet]);
  // The northern half of a shell is half its volume, and the mean latitude of a hemisphere is 30 degrees.
  assert.ok(Math.abs(shares.share[0]! - 0.5) < 0.01);
  assert.deepEqual(shares.share.slice(1), [0, 0]);
  assert.ok(Math.abs(shares.meanLatitudeDegrees[0]! - 32.7) < 1.5);
  assert.equal(shares.twoRunsShare, 0);
  // Two runs disturbed differently at the same place: the median is no longer the quiet state there, and the share says so.
  const stronger = northern.map(value => value === 2 ? 4 : 1);
  assert.ok(Math.abs(eruptionShares([northern, stronger, quiet]).twoRunsShare - 0.5) < 0.01);
});
