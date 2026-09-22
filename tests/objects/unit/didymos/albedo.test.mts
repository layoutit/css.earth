import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadObjShape, createShapeSurfaceSampler } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { decodeFitsFacetField } from '../../../../tools/objects/terrestrial-layers/fits-facet-field.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/didymos/source');
const config = JSON.parse(await readFile(resolve(root, 'preparation/terrestrial.json'), 'utf8'));
const lens = config.raster.scientific.find((lens: { id: string; }) => lens.id === 'albedo');
const mesh = await loadObjShape(resolve(root, lens.path), lens.grid);
const bytes = await readFile(resolve(root, lens.facetField.path));
const decode = (input: Buffer<ArrayBufferLike>) => decodeFitsFacetField(input, mesh, lens.facetField, lens.path);

test('DART facet values match independent binary-table and source-centroid anchors', () => {
  const field = decode(bytes);
  assert.equal(field.report.acceptedFaces, 25686);
  assert.equal(field.report.withheldFaces, 23466);
  assert.ok(Math.abs(field.report.acceptedSourceAreaFraction - .5820722721577206) < 1e-12);
  assert.ok(field.report.maximumCentroidResidualMeters < .000114);
  // Independently decoded with Python struct from the original FITS records.
  assert.equal(field.values[35000], 1.0044039487838745);
  assert.equal(field.values[49151], 1.0014300346374512);
  const sampler = createShapeSurfaceSampler(mesh, lens, undefined, field.values);
  assert.equal(required(sampler.samplePoint([33.4933331857125, -338.809996843338, 18.386666973431932])).value, field.values[35000]);
  assert.equal(sampler.samplePoint([53.223333011070906, 326.4099955558777, 177.906667192777]), null);
  assert.equal(sampler.samplePoint([10000, 0, 0]), null);
});

test('facet correspondence rejects reordered rows and displaced source geometry', () => {
  const reordered = Buffer.from(bytes); reordered.writeInt32BE(1, 8640);
  assert.throws(() => decode(reordered), /facet identities/);
  const displaced = Buffer.from(bytes); displaced.writeFloatBE(.9, 8640 + 12);
  assert.throws(() => decode(displaced), /source centroid/);
  assert.throws(() => decode(bytes.subarray(0, bytes.length - 2880)), /record layout|Truncated.*FITS/);
});

test('nominal albedo fill and invalid uncertainties stay missing before sampling', () => {
  const changed = Buffer.from(bytes); changed.writeFloatBE(0, 8640 + 35000 * 24 + 20);
  const field = decode(changed);
  assert.ok(Number.isNaN(field.values[0]));
  assert.ok(Number.isNaN(field.values[35000]));
  assert.equal(field.report.acceptedFaces, 25685);
});
