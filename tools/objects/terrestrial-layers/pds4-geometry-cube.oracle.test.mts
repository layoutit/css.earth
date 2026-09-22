import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { decodePds4GeometryCube } from './pds4-geometry-cube.mts';
import { requireRecord, requireString, requireFiniteNumber } from '../../sources/source-values.mts';
import { readOracleFixture, assertPinnedInputs, sampleList, ORACLE_ROOT } from '../../oracles/fixture.mts';

/**
 * NASA's pds4_tools as the oracle for the geometry-cube decoder.
 * tools/oracles/pds/dart-draco-cube.py reads every label-defined plane of the
 * DRACO cube from its byte offset and samples values; the decoder must
 * reproduce them exactly, after its declared unit conversions.
 */
const fixture = await readOracleFixture('pds/dart-draco-cube.json');
const planes = requireRecord(fixture.cases.planes);
const source = resolve(ORACLE_ROOT, 'src/objects/dimorphos/source');
const config = JSON.parse(await readFile(resolve(source, 'preparation/terrestrial.json'), 'utf8'));
const mosaic = config.raster.surfaceObservations.find((entry: { id: string }) => entry.id === 'draco');
const recipe = { ...mosaic, ...mosaic.frames.find((frame: { id: string }) => frame.id === 't-minus-11s') };
const name = 'dart_0401930040_12262_01_geo.fits';
const bytes = await readFile(resolve(source, recipe.path)), xml = await readFile(resolve(source, recipe.labelPath), 'utf8');
const cube = decodePds4GeometryCube(bytes, xml, { fileName: name, cube: recipe.cube, filter: recipe.filter });
const samples = (plane: string) => sampleList(requireRecord(planes[plane]).samples);
const flagged = (value: number) => !Number.isFinite(value) || Math.abs(value) >= 1e8 || value === -999;

test('the fixture was generated from the pinned cube and label by a named PDS4 reader', async () => {
  assert.equal(fixture.oracle, 'pds4_tools');
  assert.equal(requireString(fixture.tool.pds4_tools), '1.4');
  await assertPinnedInputs(fixture.inputs);
  assert.equal(Object.keys(planes).length, 16, 'every label plane was read');
});

test('image and intercept values match the PDS4 reader exactly and flagged pixels are invalid', () => {
  let compared = 0;
  for (const { index, value } of samples('ioverf')) {
    if (flagged(value)) { assert.equal(cube.valid(index) && cube.acceptPixel(index), false, `flagged I/F at ${index}`); continue; }
    assert.equal(cube.planes.IMAGE[index], Math.fround(value), `I/F at ${index}`); compared++;
  }
  for (const [plane, axis] of [['xcoord', 0], ['ycoord', 1], ['zcoord', 2]] as const) for (const { index, value } of samples(plane)) {
    if (flagged(value)) { assert.equal(cube.valid(index), false, `${plane} flagged at ${index}`); continue; }
    assert.ok(cube.valid(index), `${plane} valid at ${index}`);
    assert.equal(cube.xyz(index)[axis], Math.fround(value), `${plane} at ${index}`); compared++;
  }
  assert.ok(compared >= 150, `${compared} values compared`);
  assert.equal(cube.qualityReport.geometryPixels, requireFiniteNumber(requireRecord(planes.xcoord).onBodyCount), 'on-body pixel count');
});

test('illumination angles match the PDS4 reader after the declared degree-to-radian conversion', () => {
  let compared = 0;
  for (const [plane, key] of [['incidence', 'INCIDENCE_ANGLE_IMAGE'], ['emission', 'EMISSION_ANGLE_IMAGE'], ['phase', 'PHASE_ANGLE_IMAGE']] as const) for (const { index, value } of samples(plane)) {
    if (flagged(value)) { assert.equal(cube.valid(index), false, `${plane} flagged at ${index}`); continue; }
    const ours = cube.planes[key][index] * 180 / Math.PI;
    assert.ok(Math.abs(ours - value) < 1e-4, `${plane} at ${index}: ${ours} vs ${value}`); compared++;
  }
  assert.ok(compared >= 120, `${compared} angles compared`);
});
