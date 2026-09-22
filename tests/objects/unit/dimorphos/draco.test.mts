import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('dimorphos');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodePds4GeometryCube } from '../../../../tools/objects/terrestrial-layers/pds4-geometry-cube.mts';
import { fitBackplaneCamera } from '../../../../tools/objects/surface-observations/cameras.mts';
import { loadObjShape } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/dimorphos/source');
const config = JSON.parse((await readFile(resolve(root, 'preparation/terrestrial.json'))).toString('utf8'));
const recipe = config.raster.surfaceObservations.find((recipe: { id: string }) => recipe.id === 'draco');
const frame = recipe.frames.find((frame: { id: string }) => frame.id === 't-minus-11s');
const name = 'dart_0401930040_12262_01_geo.fits';
assert.equal(frame.path, `observations/${name}`);
const cube = decodePds4GeometryCube(await readFile(resolve(root, frame.path)), await readFile(resolve(root, frame.labelPath), 'utf8'), { fileName: name, cube: recipe.cube, filter: recipe.filter });
const headerRangeKm = Number(cube.header.PSCRNG), headerIfovMicroradians = Number(cube.header.PXMRAD);

test('the pinned DRACO cube decodes through the declared planes to the archived acquisition and its DSK', () => {
  assert.equal(cube.startTime, frame.startTime);
  assert.equal(cube.startTime, '2022-09-26T23:14:12.737Z');
  assert.equal(cube.qualityReport.shapeKernel, 'dimorphos_g_00243mm_spc_0000n00000_v004.bds');
  assert.equal(cube.header.SRCFILE, 'dart_0401930040_12262_01.fits');
  assert.deepEqual(cube.qualityReport.planes, { image: 'ioverf', x: 'xcoord', y: 'ycoord', z: 'zcoord', incidence: 'incidence', emission: 'emission', phase: 'phase' });
  assert.equal(cube.qualityReport.geometryPixels, 128291);
  assert.equal(cube.qualityReport.saturatedPixels, 0);
  assert.ok(Math.abs(cube.qualityReport.medianPhaseDegrees - 60.54) < 0.05);
  assert.equal(headerRangeKm, 70.413);
  // Adjacent archived intercepts at the nadir pixel are 0.348 m apart: range times the header IFOV.
  assert.ok(Math.abs((cube.qualityReport.nadirPixelFootprintMeters ?? 0) - headerRangeKm * headerIfovMicroradians * 1e-3) < 0.005);
  // The archived pixel-scale planes are 180/pi times that footprint; they are reported, never used.
  assert.ok(Math.abs((cube.qualityReport.archivedPixelScaleRatio ?? 0) - 180 / Math.PI) < 0.3);
});

test('a pinhole camera recovered from the archived intercepts explains every held-out pixel', () => {
  const camera = fitBackplaneCamera(cube);
  assert.ok(camera.fitPixels >= 700 && camera.holdoutPixels > 120000, `${camera.fitPixels} fit / ${camera.holdoutPixels} holdout`);
  assert.ok(camera.maximumResidualPixels < 0.001, `maximum residual ${camera.maximumResidualPixels} px`);
  assert.ok(camera.rmsResidualPixels < 0.0001);
  // The recovered spacecraft position agrees with the header's range to the target centre.
  assert.ok(Math.abs(Math.hypot(...camera.positionKm) - headerRangeKm) < 0.05);
});

test('the 0.243 m intercepts lie on the retained 0.972 m OBJ within the recipe transfer bound', async () => {
  const mesh = await loadObjShape(resolve(root, config.geometry.radialTerrain.path), config.geometry.radialTerrain.grid);
  let sampled = 0, maximum = 0;
  for (let i = 0; i < cube.width * cube.height; i += 53) if (cube.valid(i)) {
    const hit = mesh.closestPoint(cube.xyz(i).map(v => v * 1000), recipe.transfer.maximumSourceDistanceMeters);
    assert.ok(hit, `pixel ${i} has no source point within ${recipe.transfer.maximumSourceDistanceMeters} m`);
    sampled++; maximum = Math.max(maximum, hit.distanceMeters);
  }
  assert.ok(sampled > 2000);
  assert.ok(maximum < 0.5, `maximum transfer distance ${maximum} m`);
});

for (const entry of recipe.frames.filter((entry: { id: string }) => entry.id !== 't-minus-11s')) {
  test(`${entry.id}: the closer frame keeps its archived camera, native footprint and mesh correspondence`, async () => {
    const observed = decodePds4GeometryCube(await readFile(resolve(root, entry.path)), await readFile(resolve(root, entry.labelPath), 'utf8'),
      { fileName: entry.path.split('/').at(-1), cube: recipe.cube, filter: recipe.filter });
    assert.equal(observed.startTime, entry.startTime);
    assert.equal(observed.qualityReport.saturatedPixels, 0);
    const camera = fitBackplaneCamera(observed);
    assert.ok(camera.fitPixels > 1300 && camera.holdoutPixels > 240000);
    assert.ok(camera.maximumResidualPixels < 0.0003);
    const footprint = observed.qualityReport.nadirPixelFootprintMeters;
    assert.ok(footprint && Math.abs(footprint - Number(observed.header.PSCRNG) * Number(observed.header.PXMRAD) * 1e-3) < 0.005);
    const mesh = await loadObjShape(resolve(root, config.geometry.radialTerrain.path), config.geometry.radialTerrain.grid);
    let sampled = 0;
    for (let i = 0; i < observed.width * observed.height; i += 53) if (observed.valid(i)) {
      const hit = mesh.closestPoint(observed.xyz(i).map(n => n * 1000), recipe.transfer.maximumSourceDistanceMeters);
      assert.ok(hit && hit.distanceMeters < 0.5, `pixel ${i} misses the retained source surface`); sampled++;
    }
    assert.ok(sampled > 4500);
  });
}
