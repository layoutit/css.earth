import {fixtureRecord, required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('comet-19p');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { loadImageDem } from '../../../../tools/objects/terrestrial-layers/image-dem.mts';
import { parseRadialLoaderConfig } from '../../../../tools/objects/terrestrial-layers/radial-source.mts';
import { loadRadialTerrain } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import { loadSurfaceObservation } from '../../../../tools/objects/surface-observations/index.mts';
import { loadImageDemScience } from '../../../../tools/objects/terrestrial-layers/image-dem-science.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/comet-19p/source');
const config = JSON.parse(await readFile(resolve(root, 'preparation/terrestrial.json'), 'utf8'));
const profile = config.geometry.radialTerrain;
const source = await createSourceManifest({ planetId: 'comet-19p', planetName: 'Borrelly', sourceRoot: root });
const mesh = await loadImageDem(resolve(root, profile.path), profile.grid);

test('MICAS original XYZ cubes register every reviewed USGS terrain post independently', async () => {
  await source.verify();
  const recipe = config.raster.surfaceObservations[0];
  // The display faces preparation simplifies from this DEM; their samples set the display range.
  const radial = await loadRadialTerrain({ config: parseRadialLoaderConfig(config), sourceDirectory: root, source });
  if (!radial) throw new Error('Borrelly has no radial terrain.');
  const surface = await loadSurfaceObservation({ sourceDirectory: root, source, recipe, radial: { grid: mesh, faces: radial.faces }, config });
  const registration = fixtureRecord(surface.report, 'frames', 0, 'registration');
  assert.equal(registration.coordinatePixels, 62879);
  assert.ok(Number(registration.maximumCoordinateErrorMeters) < .000001);
  const changed = structuredClone(recipe); changed.grid.pixelToSource[1] += 16;
  await assert.rejects(loadSurfaceObservation({ sourceDirectory: root, source, recipe: changed, radial: { grid: mesh, faces: radial.faces }, config }), /registration/);
  const ratio = config.geometry.radius / (config.geometry.radiusKm * 1000);
  let accepted = 0;
  for (let i = 0; i < mesh.positions.length; i += 53) {
    const sample = surface.samplePoint(mesh.positions[i].map(v => v * ratio));
    if (sample.reason !== undefined) continue;
    accepted++;
    assert.equal(sample.gain, 1);
    assert.ok(sample.color.every(Number.isFinite));
    assert.ok(required(sample.radiance) >= .0007 && required(sample.radiance) <= .018);
  }
  assert.ok(accepted > 1000);
});

test('Borrelly height keeps its arbitrary plane datum after recentering the display', async () => {
  const lens = config.raster.scientific.find((lens: { quantity: string; }) => lens.quantity === 'height');
  const surface = await loadImageDemScience(root, lens, mesh);
  const lowest = mesh.positions.reduce((a, b) => a[2] < b[2] ? a : b);
  const sample = surface.samplePoint(lowest);
  assert.ok(sample);
  assert.ok(Math.abs(sample.value - (-.10336657)) < 1e-8);
  assert.equal(surface.samplePoint([100000, 100000, 100000]), null);
});

test('USGS minus DLR sign, metres-to-kilometres and registered plane match independent source anchors', async () => {
  // Independent NumPy inverse-affine and grid-triangle interpolation of the
  // released text tables, with the documented vertical offset applied once.
  const anchors = [{"sourcePoint":[1416,712,1501.2771],"dlrCoordinates":[141.00171038229865,91.22684647905024],"dlrHeight":1938.7599803153494,"differenceKm":-0.40000292977217017},{"sourcePoint":[200,1464,967.5896],"dlrCoordinates":[119.39760669149997,78.02012017492311],"dlrHeight":1005.0550022683456,"differenceKm":0.000014548274833671826},{"sourcePoint":[-2232,-3464,3914.161621],"dlrCoordinates":[76.77750614650347,165.5173078611534],"dlrHeight":3551.7436741046886,"differenceKm":0.3998978974384908}];
  const surface = await loadImageDemScience(root, config.raster.scientific.find((l: { id: string; }) => l.id === 'difference'), mesh);
  for (const anchor of anchors) {
    const p = [...anchor.sourcePoint]; p[2] += mesh.imageGrid.zOffsetMeters;
    const actual = surface.samplePoint(p);
    assert.ok(actual); assert.ok(Math.abs(actual.value - anchor.differenceKm) < 1e-9);
  }
});
