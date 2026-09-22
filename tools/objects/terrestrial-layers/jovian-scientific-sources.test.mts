import { required, fixtureRecord } from '../../contract/test-values.mts';
import { requireArray } from '../../sources/source-values.mts';
import { parseGeologyLens,shape,array,number,text } from './source-records.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import {readFile, type FileHandle} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadScienceSurface} from './scientific-raster.mts';
import {loadGeologySurface} from './categorical-geology.mts';
import type { PathLike } from 'node:fs';

const planets = fileURLToPath(new URL('../../../src/objects/', import.meta.url));
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const scienceLens = async (source: string, id: string): Promise<Record<string, unknown>> => {
  const surface = fixtureRecord(required(requireArray((await json(`${source}/preparation/raster.json`)).surfaces).find(value => fixtureRecord(value).id === id)));
  const {kind: _kind, ...science} = fixtureRecord(surface.science);
  return {id: surface.id, ...science};
};

for (const id of ['io', 'ganymede']) test(`${id} independently archived label points anchor both hemispheres of the geology view`, async () => {
  const source = `${planets}${id}/source`;
  const lens = parseGeologyLens(await scienceLens(source, 'geology'));
  const directory = lens.path.slice(0, lens.path.lastIndexOf('/'));
  const audit = shape({mismatch:number,anchors:array(shape({latitude:number,longitude:number,value:text,record:number}))})(await json(`${source}/${directory}/registration-anchors.json`)), surface = await loadGeologySurface(source, lens);
  assert.ok(audit.anchors.some((point) => point.latitude > 20));
  assert.ok(audit.anchors.some((point) => point.latitude < -20));
  for (const point of audit.anchors) {
    const category = surface.sample(point.longitude, point.latitude);
    assert.notEqual(category, null);
    assert.equal(lens.categories[required(category)].value, point.value, `Separate point record ${point.record}`);
    assert.equal(surface.sample(point.longitude + 360, point.latitude), category);
  }
  assert.ok(audit.mismatch > 0, 'Independent source-label disagreements are retained, not falsely reported as complete agreement');
  const display = await json(`${source}/${directory}/display-categories.json`);
  assert.deepEqual(display.categories, lens.categories);
});

test('Agenor preserves independently decoded source heights and withholds incomplete interpolation footprints', async () => {
  const source = `${planets}europa/source`, lens = await scienceLens(source, 'elevation');
  const anchors = await json(`${source}/science/controlled-dtms/Agenor/value-anchors.json`);
  const bytes = await readFile(`${source}/${anchors.sourcePath}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), anchors.sha256);
  const original = await loadScienceSurface(source, {...lens, sampling: 'nearest'}), display = await loadScienceSurface(source, lens);
  for (const point of anchors.anchors) assert.equal(original.sample(point.longitudeEastDegrees, point.latitudeDegrees), point.heightMeters);
  for (const point of anchors.anchors.slice(1, -1)) assert.ok(Math.abs(required(display.sample(point.longitudeEastDegrees, point.latitudeDegrees)) - point.heightMeters) < 1e-8);
  for (const point of [anchors.anchors[0], anchors.anchors.at(-1)]) assert.equal(display.sample(point.longitudeEastDegrees, point.latitudeDegrees), null);
  assert.equal(display.sample(0, 0), null);
  assert.equal(display.sample(142, 0), null);
  const focus = fixtureRecord(await json(`${source}/preparation/presentation.json`), 'lensFocus', 'elevation');
  assert.ok(Number.isFinite(display.sample(Number(focus.longitudeDegrees), Number(focus.latitudeDegrees))));
  assert.equal(lens.valueTransform, undefined, 'No arbitrary offset or global radius conversion');
  assert.equal(lens.additionalGrids, undefined, 'Independent local datums are not combined');
});

test('duplicated Europa confidence assets remain excluded from the scientific source recipe', async () => {
  const source = `${planets}europa/source`, lens = await scienceLens(source, 'elevation');
  const directory = `${source}/science/controlled-dtms/Agenor`;
  const fom = await readFile(`${directory}/Agenor_FOM.tif`), confidence = await readFile(`${directory}/Agenor_ClrConf.tif`);
  assert.deepEqual(fom, confidence, 'Pinned public release duplicates the files');
  const provenance = await readFile(`${directory}/provenance.txt`, 'utf8');
  assert.match(provenance, /gdal_translate Agenor_FOM\.vrt Agenor_ClrConf\.tif/);
  assert.doesNotMatch(JSON.stringify(lens), /FOM|ClrConf/);
  assert.equal(lens.coverage, undefined, 'No inferred quality mask');
});
