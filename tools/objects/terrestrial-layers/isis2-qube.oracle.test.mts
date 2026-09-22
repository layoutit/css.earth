import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeIsis2Qube } from './isis2-qube.mts';
import { readOracleFixture, assertPinnedInputs, sampleList, ORACLE_ROOT } from '../../oracles/fixture.mts';
import { requireRecord, requireFiniteNumber } from '../../sources/source-values.mts';

/** pvl and numpy as the oracle for the ISIS2 QUBE reader over Borrelly's MICAS orthographic image and DEM components. */
const fixture = await readOracleFixture('isis2/borrelly-micas.json');
const config = JSON.parse(await readFile(resolve(ORACLE_ROOT, 'src/objects/comet-19p/source/preparation/terrestrial.json'), 'utf8'));
const recipe = config.raster.surfaceObservations[0];
const cubes = requireRecord(fixture.cases.cubes);

test('the fixture is bound to the pinned MICAS cubes', async () => {
  await assertPinnedInputs(fixture.inputs);
  assert.equal(fixture.inputs.length, 4);
});

test('core values, special pixels and valid counts match the independent QUBE reads', async () => {
  let compared = 0;
  for (const input of fixture.inputs) {
    const name = input.path.split('/').pop()!, expected = requireRecord(cubes[name]);
    const cube = decodeIsis2Qube(await readFile(resolve(ORACLE_ROOT, input.path)), recipe.grid);
    assert.equal(cube.width, requireFiniteNumber(expected.width)); assert.equal(cube.height, requireFiniteNumber(expected.height));
    assert.equal(expected.coreItemType, 'PC_REAL');
    let valid = 0; for (let i = 0; i < cube.valid.length; i++) valid += cube.valid[i];
    assert.equal(valid, requireFiniteNumber(expected.validCount), `${name} valid pixels`);
    const special = requireRecord(expected.specialCounts);
    assert.equal(Object.values(special).reduce<number>((sum, v) => sum + requireFiniteNumber(v), 0), cube.width * cube.height - valid, `${name} special pixels`);
    for (const { index, value } of sampleList(expected.samples)) { assert.equal(cube.data[index], Math.fround(value), `${name} at ${index}`); assert.equal(cube.valid[index], 1); compared++; }
  }
  assert.ok(compared >= 180, `${compared} values compared`);
});
