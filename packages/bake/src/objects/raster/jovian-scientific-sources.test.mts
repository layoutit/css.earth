import { required, fixtureRecord } from '@cssearth/objects/node/contract';
import { requireArray, shape, array, number, text } from '@cssearth/core';
import { parseGeologyDataset, loadGeologySurface } from '@cssearth/bake/objects/raster';
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import {readFile, type FileHandle} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import type { PathLike } from 'node:fs';

const planets = fileURLToPath(new URL('../../../../../src/objects/', import.meta.url));
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const scienceDataset = async (source: string, id: string): Promise<Record<string, unknown>> => {
  const surface = fixtureRecord(required(requireArray((await json(`${source}/preparation/raster.json`)).surfaces).find(value => fixtureRecord(value).id === id)));
  const {kind: _kind, ...science} = fixtureRecord(surface.science);
  return {id: surface.id, ...science};
};

for (const id of ['io']) test(`${id} independently archived label points anchor both hemispheres of the geology view`, async () => {
  const source = `${planets}${id}/source`;
  const dataset = parseGeologyDataset(await scienceDataset(source, 'geology'));
  const directory = dataset.path.slice(0, dataset.path.lastIndexOf('/'));
  const audit = shape({mismatch:number,anchors:array(shape({latitude:number,longitude:number,value:text,record:number}))})(await json(`${source}/${directory}/registration-anchors.json`)), surface = await loadGeologySurface(source, dataset);
  assert.ok(audit.anchors.some((point) => point.latitude > 20));
  assert.ok(audit.anchors.some((point) => point.latitude < -20));
  for (const point of audit.anchors) {
    const category = surface.sample(point.longitude, point.latitude);
    assert.notEqual(category, null);
    assert.equal(dataset.categories[required(category)].value, point.value, `Separate point record ${point.record}`);
    assert.equal(surface.sample(point.longitude + 360, point.latitude), category);
  }
  assert.ok(audit.mismatch > 0, 'Independent source-label disagreements are retained, not falsely reported as complete agreement');
  const display = await json(`${source}/${directory}/display-categories.json`);
  assert.deepEqual(display.categories, dataset.categories);
});
