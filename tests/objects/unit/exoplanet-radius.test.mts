import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { SCENE_OBJECTS } from '../../../site/objects.mts';
import { readJsonSource } from '../../../tools/sources/source-values.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { sourceTest } from '../source-test.mts';
import { projectRoot } from '../fixtures.mts';
import { selectedObjectIds } from './anchor-table.mts';

const test = sourceTest();
const ids = selectedObjectIds(SCENE_OBJECTS.filter(object => object.classification === 'exoplanet').map(object => object.id));

for (const id of ids) test(`${id}: displayed radius agrees with its source and orbit record`, async () => {
  const directory = resolve(projectRoot, 'src/objects', id);
  const object = requireRecord(await readJsonSource(resolve(directory, 'object.json')), 'object');
  const properties = requireRecord(object.properties, 'properties');
  const recipe = requireRecord(properties.recipe, 'recipe');
  const shape = requireRecord(recipe.shape, 'shape');
  const frame = requireRecord(properties.worldFrame, 'world frame');
  const scene = requireRecord(await readJsonSource(resolve(directory, 'source/presentation/solar-system.json')), 'scene');
  const measurements = requireRecord(await readJsonSource(resolve(directory, 'source/measurements.json')), 'measurements');
  const astronomy = requireRecord(await readJsonSource(resolve(projectRoot, 'packages/astronomy/data/bodies', `${id}.json`)), 'astronomy');
  const physical = requireRecord(astronomy.physical, 'physical');
  const radiusKm = requireFiniteNumber(physical.meanRadiusKm, 'astronomy radius');

  assert.equal(requireFiniteNumber(measurements.radiusKm, 'source radius'), radiusKm);
  assert.equal(requireFiniteNumber(shape.radiusKm, 'shape radius'), radiusKm);
  assert.equal(requireFiniteNumber(scene.bodyRadiusKilometers, 'scene radius'), radiusKm);
  assert.ok(Math.abs(requireFiniteNumber(frame.bodyRadiusM, 'world radius') - radiusKm * 1000) < 1e-3);
  const preparedRadiusUnits = requireFiniteNumber(scene.bodyRadiusUnits, 'scene radius units')
    * requireFiniteNumber(scene.geometryScale, 'scene geometry scale');
  assert.ok(Math.abs(requireFiniteNumber(frame.metersPerUnit, 'world scale') * preparedRadiusUnits - radiusKm * 1000) < 1e-6);
});

test('K2-18b uses the radius measured by Benneke et al. (2019), Table 2', async () => {
  const directory = resolve(projectRoot, 'src/objects/k2-18b');
  const measurements = requireRecord(await readJsonSource(resolve(directory, 'source/measurements.json')), 'measurements');
  const content = requireRecord(await readJsonSource(resolve(directory, 'source/content/object.json')), 'content');
  const panel = requireRecord(content.panel, 'panel');
  const radius = requireArray(panel.facts, 'facts').map(fact => requireRecord(fact, 'fact'))
    .find(fact => fact.id === 'radius');
  assert.ok(radius, 'K2-18b must display its radius');
  assert.equal(requireFiniteNumber(measurements.radiusKm, 'radius'), Math.round(2.610 * 6378.137 * 10) / 10);
  assert.equal(requireString(radius.value, 'radius fact'), '2.610 Earth radii');
  assert.equal(requireString(requireRecord(radius.source, 'radius source').catalogueId, 'source id'), 'arxiv-1909-04642');
});
