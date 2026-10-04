import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { inspectMeasurementSphere, measurementSphere, sphereHtml } from '@cssearth/telescope-cli/sphere/lane';
import { inspectMeasurementSphere as sourceInspect } from './sphere-lane.mts';

test('sphere runs a built package entry without runtime compilation or solar lookup', async () => {
  for (const operation of [inspectMeasurementSphere, measurementSphere, sphereHtml]) assert.equal(typeof operation, 'function');
  const source = readFileSync(new URL('./sphere.mts', import.meta.url), 'utf8');
  assert.match(source, /from '@cssearth\/telescope-cli\/sphere\/lane'/u);
  assert.doesNotMatch(source, /esbuild|followedWorkspaceSources|SPHERE_LANE|solar-geometry\.mts/u);
  assert.match(source, /solarGeometry:SolarGeometry/u);
  const declaration = readFileSync(new URL('../../dist/sphere-lane.d.ts', import.meta.url), 'utf8');
  assert.match(declaration, /measurementSphere/u);
  assert.match(declaration, /SolarGeometry/u);
  const input = 'invalid/target';
  await assert.rejects(inspectMeasurementSphere('/unavailable', input), { message: 'Sphere output needs an existing body identity' });
  await assert.rejects(sourceInspect('/unavailable', input), { message: 'Sphere output needs an existing body identity' });
});

test('built sphere entry imports under plain Node without TypeScript source loaders', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    "const owner = await import('@cssearth/telescope-cli/sphere/lane'); if (typeof owner.sphereHtml !== 'function') process.exit(2); console.log('sphere-entry-ready');"], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /sphere-entry-ready/u);
});
