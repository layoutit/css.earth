import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('didymos');
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { decodePds4GeometryCube } from '../../../../tools/objects/terrestrial-layers/pds4-geometry-cube.mts';
import { fitBackplaneCamera } from '../../../../tools/objects/surface-observations/cameras.mts';
import { loadObjShape } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { parseGeoLens } from '../../../../tools/objects/surface-observations/formats/geo.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/didymos/source');
const config = JSON.parse(await readFile(resolve(root, 'preparation/terrestrial.json'), 'utf8'));
const recipe = parseGeoLens(config.raster.surfaceObservations.find((entry: { id: string }) => entry.id === 'draco'));
const declaration = recipe.cube;
assert.ok(declaration?.geometrySelection);
const mesh = await loadObjShape(resolve(root, config.geometry.radialTerrain.path), config.geometry.radialTerrain.grid);

test('the selected native radius interval encloses the complete Didymos mesh and excludes Dimorphos', async () => {
  const bounds = declaration.geometrySelection!;
  assert.equal(bounds.plane, 'radius'); assert.equal(bounds.unit, 'km');
  assert.ok(mesh.positions.every(point => Math.hypot(...point) / 1000 >= bounds.minimum && Math.hypot(...point) / 1000 <= bounds.maximum));
  const nearest = mesh.closestPoint([0, 0, 0], bounds.maximum * 1000);
  assert.ok(nearest && nearest.distanceMeters / 1000 >= bounds.minimum, 'triangle interiors also stay outside the lower radius bound');
  const companionRoot = resolve(root, '../../dimorphos/source');
  const companionConfig = JSON.parse(await readFile(resolve(companionRoot, 'preparation/terrestrial.json'), 'utf8')).geometry.radialTerrain;
  const companion = await loadObjShape(resolve(companionRoot, companionConfig.path), companionConfig.grid);
  assert.ok(companion.positions.every(point => Math.hypot(...point) / 1000 < bounds.minimum));
});

for (const frame of recipe.frames) test(`${frame.id}: target selection preserves projective geometry and transfers to the v003 source mesh`, async () => {
  assert.ok(frame.path && frame.labelPath);
  const bytes = await readFile(resolve(root, frame.path)), label = await readFile(resolve(root, frame.labelPath), 'utf8');
  const selected = decodePds4GeometryCube(bytes, label, { fileName: basename(frame.path), cube: declaration, filter: recipe.filter });
  assert.equal(selected.startTime, frame.startTime);
  assert.equal(selected.header.SHAPREF1, 'didymos_g_1165mm_spc_obj_0000n00000_v003.obj');
  assert.ok(selected.qualityReport.geometryPixels > 5000);
  assert.ok((selected.qualityReport.geometrySelection?.excludedGeometryPixels ?? 0) > 500);
  const camera = fitBackplaneCamera(selected);
  assert.ok(camera.holdoutPixels > 5000 && camera.maximumResidualPixels < 0.00002);
  let sampled = 0;
  for (let i = 0; i < selected.width * selected.height; i += 53) if (selected.valid(i)) {
    const hit = mesh.closestPoint(selected.xyz(i).map(n => n * 1000), recipe.transfer.maximumSeparationMeters);
    assert.ok(hit, `selected pixel ${i} misses the source mesh`); sampled++;
  }
  assert.ok(sampled >= 100);
  const mixed = decodePds4GeometryCube(bytes, label, { fileName: basename(frame.path), cube: { ...declaration, geometrySelection: undefined }, filter: recipe.filter });
  assert.throws(() => fitBackplaneCamera(mixed), /GEO camera.*(?:holdout|invalid projection)/);
});
