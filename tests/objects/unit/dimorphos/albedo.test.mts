import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('dimorphos');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadObjShape, createShapeSurfaceSampler } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { decodeFitsFacetField } from '../../../../tools/objects/terrestrial-layers/fits-facet-field.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/dimorphos/source');
const config = JSON.parse((await readFile(resolve(root, 'preparation/terrestrial.json'))).toString('utf8'));
const lens = config.raster.scientific.find((lens: { id: string; }) => lens.id === 'albedo');
const mesh = await loadObjShape(resolve(root, lens.path), lens.grid);
const bytes = await readFile(resolve(root, lens.facetField.path));
const decode = (input: Buffer<ArrayBufferLike>, shape = mesh, recipe = lens.facetField) => decodeFitsFacetField(input, shape, recipe, lens.path);

test('Dimorphos albedo matches independent source centroids despite the archived triangle permutation', () => {
  const field = decode(bytes);
  // Astropy decoding and scipy cKDTree on the original OBJ independently find
  // a complete bijection: every second-nearest centroid is at least 0.289 m away.
  assert.equal(field.report.reorderedRows, 131072);
  assert.equal(field.report.acceptedFaces, 60464);
  assert.equal(field.report.withheldFaces, 136144);
  assert.ok(field.report.maximumCentroidResidualMeters < .000024);
  assert.ok(Math.abs(field.report.acceptedSourceAreaFraction - .3121381113225181) < 1e-12);
  assert.equal(field.values[177162], .9606354236602783); // FITS row 177160
  assert.equal(field.values[177160], .9725905060768127); // FITS row 177162
  assert.equal(field.values[196420], 1.0000020265579224); // FITS row 196422
  assert.ok(Number.isNaN(field.values[0]));
  const sampler = createShapeSurfaceSampler(mesh, lens, undefined, field.values);
  assert.equal(required(sampler.samplePoint([-8.179999887943268, -50.2233331402143, -45.42666673660276])).value, field.values[177162]);
  assert.equal(sampler.samplePoint([-46.1466672519843, 45.66666732231781, 37.716666857401535]), null);
  assert.throws(() => decode(bytes, mesh, { ...lens.facetField, facetOrder: 'index' }), /source centroid/);
});

test('centroid correspondence rejects duplicate, ambiguous and displaced records instead of guessing', () => {
  const duplicate = Buffer.from(bytes);
  bytes.copy(duplicate, 8640 + 24 + 4, 8640 + 4, 8640 + 16);
  assert.throws(() => decode(duplicate), /uniquely cover/);
  const displaced = Buffer.from(bytes); displaced.writeFloatBE(.9, 8640 + 12);
  assert.throws(() => decode(displaced), /uniquely cover/);
  const ambiguous = { ...mesh, indices: mesh.indices.map(face => [...face]) };
  ambiguous.indices[1] = [...ambiguous.indices[0]];
  assert.throws(() => decode(bytes, ambiguous), /uniquely cover/);
});
