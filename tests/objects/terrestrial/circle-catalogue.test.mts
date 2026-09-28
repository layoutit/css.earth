import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePdsVertexFacetShape } from '@cssearth/bake/objects/geometry';
import { checkDelimitedLabel, createCircleCatalogue, parseCircleCatalogueLens, parseCircleRows, validateCircleCatalogue } from '@cssearth/bake/objects/raster';

// A 1 km sphere as a subdivided cube, written as a PDS vertex-facet table in km.
function sphereTable(n = 24) {
  const vertices: number[][] = [], faces: number[][] = [], key = new Map<string, number>();
  const vertex = (p: number[]) => { const l = Math.hypot(...p), q = p.map(v => v / l), k = q.map(v => v.toFixed(9)).join(); if (!key.has(k)) { key.set(k, vertices.length); vertices.push(q); } return key.get(k)!; };
  for (const [a, s] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]] as const) {
    const u = (a + 1) % 3, v = (a + 2) % 3;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const at = (x: number, y: number) => { const p = [0, 0, 0]; p[a] = s; p[u] = -1 + 2 * x / n; p[v] = -1 + 2 * y / n; return vertex(p); };
      const q = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      if (s > 0) faces.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]); else faces.push([q[0], q[2], q[1]], [q[0], q[3], q[2]]);
    }
  }
  const text = [`${vertices.length} ${faces.length}`, ...vertices.map((p, i) => `${i + 1} ${p.join(' ')}`), ...faces.map((f, i) => `${i + 1} ${f.map(x => x + 1).join(' ')}`)].join('\n');
  return { text, grid: { metersPerUnit: 1000, expectedVertices: vertices.length, expectedFaces: faces.length } };
}
const fields = ['Pond Number', 'X', 'Y', 'Z', 'Latitude', 'Longitude', 'Distance', 'Diameter'].map((name, i) => ({ name, unit: i === 0 ? 'none' : i === 4 || i === 5 ? 'degree' : 'km' }));
const lens = (records: number) => ({ format: 'circle-catalogue', path: 'ponds/table.csv', labelPath: 'ponds/table.xml', meshPath: 'shape/sphere.tab',
  sampling: 'nearest', displaySampling: 'nearest', categories: [{ value: 'outside', label: 'No catalogued pond', color: '#808080' }, { value: 'pond', label: 'Pond', color: '#00ffff' }],
  table: { expectedRecords: records, metersPerUnit: 1000, fields, idField: 'Pond Number', centerFields: ['X', 'Y', 'Z'], diameterField: 'Diameter',
    latitudeField: 'Latitude', longitudeField: 'Longitude', distanceField: 'Distance', consistency: { angleDegrees: 0.01, distanceMeters: 2 } },
  registration: { maximumDistanceMeters: 60 }, surfaceSampling: { method: 'closest-source-point', maximumDistanceMeters: 300 } });
const row = (id: number, lat: number, lon: number, radiusKm: number, diameterKm: number) => {
  const a = lat * Math.PI / 180, b = lon * Math.PI / 180, p = [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)].map(v => (v * radiusKm).toFixed(6));
  return [id, ...p, lat.toFixed(2), lon.toFixed(2), radiusKm.toFixed(3), diameterKm].join(',');
};
const label = (records: number, file = 'table.csv') => `<File><file_name>${file}</file_name></File><records>${records}</records><record_delimiter>Carriage-Return Line-Feed</record_delimiter>`
  + `<field_delimiter>Comma</field_delimiter><fields>${fields.length}</fields>` + fields.map(f => `<Field_Delimited><name>${f.name}</name><unit>${f.unit}</unit></Field_Delimited>`).join('');
const sphere = sphereTable(), mesh = parsePdsVertexFacetShape(sphere.text, sphere.grid);

test('a circle covers source-surface points within half its published diameter and nothing beyond', () => {
  const profile = parseCircleCatalogueLens(lens(2));
  const rows = parseCircleRows([row(1, 0, 0, 1, 0.2), row(2, 30, 90, 1.5, 0.05)].join('\r\n') + '\r\n', profile);
  const catalogue = createCircleCatalogue(rows, profile, mesh);
  assert.deepEqual(catalogue.report.withheldCircles, [2], 'a centre 500 m off the surface is withheld, not moved');
  assert.equal(catalogue.report.acceptedCircles, 1);
  const at = (degrees: number) => { const a = degrees * Math.PI / 180; return [Math.cos(a) * 1000, Math.sin(a) * 1000, 0]; };
  assert.equal(catalogue.samplePoint(at(5))?.value, 1, '87 m from the centre lies inside a 200 m circle');
  assert.equal(catalogue.samplePoint(at(5))?.sourceCell, 1, 'the texel keeps the catalogue id');
  assert.equal(catalogue.samplePoint(at(7))?.value, 0, '122 m from the centre lies outside');
  assert.equal(catalogue.sample(0, 0), 1);
  assert.equal(catalogue.sample(180, 0), 0);
});

test('rows must reproduce their printed coordinates, and the label must describe the recipe', () => {
  const profile = parseCircleCatalogueLens(lens(1));
  const bad = row(1, 0, 0, 1, 0.1).replace(',0.00,0.00,', ',0.50,0.00,');
  assert.throws(() => parseCircleRows(bad + '\r\n', profile), /record 1 centre disagrees/);
  assert.throws(() => parseCircleRows(row(1, 0, 0, 1, 0.1) + '\n', profile), /CRLF/);
  assert.doesNotThrow(() => checkDelimitedLabel(label(1), profile));
  assert.throws(() => checkDelimitedLabel(label(2), profile), /label differs/);
  assert.throws(() => checkDelimitedLabel(label(1).replace('<unit>km</unit>', '<unit>m</unit>'), profile), /label differs/);
});

test('the recipe is bound to the rendered mesh and its simplification allowance', () => {
  const terrain = { path: 'shape/sphere.tab', simplification: { maximumErrorMeters: 300 } };
  assert.doesNotThrow(() => validateCircleCatalogue(lens(1), terrain));
  assert.throws(() => validateCircleCatalogue({ ...lens(1), meshPath: 'shape/other.tab' }, terrain), /surface circle catalogue needs/);
  assert.throws(() => validateCircleCatalogue({ ...lens(1), surfaceSampling: { method: 'closest-source-point', maximumDistanceMeters: 400 } }, terrain), /surface circle catalogue needs/);
  assert.throws(() => validateCircleCatalogue({ ...lens(1), displaySampling: 'bilinear' }, terrain), /surface circle catalogue needs/);
});

test('over an underlay, one category marks the circles and surface outside them is missing', () => {
  const recipe = { ...lens(1), categories: [{ value: 'pond', label: 'Pond', color: '#00ffff' }], underlay: { surface: 'normal', brightness: 0.35, grayscale: true, bits: 6 } };
  const terrain = { path: 'shape/sphere.tab', simplification: { maximumErrorMeters: 300 } };
  assert.doesNotThrow(() => validateCircleCatalogue(recipe, terrain));
  assert.throws(() => validateCircleCatalogue({ ...recipe, underlay: undefined }, terrain), /two categories/);
  assert.throws(() => validateCircleCatalogue({ ...lens(1), underlay: recipe.underlay }, terrain), /one category over its underlay/);
  const profile = parseCircleCatalogueLens(recipe);
  const catalogue = createCircleCatalogue(parseCircleRows(row(1, 0, 0, 1, 0.2) + '\r\n', profile), profile, mesh);
  const at = (degrees: number) => { const a = degrees * Math.PI / 180; return [Math.cos(a) * 1000, Math.sin(a) * 1000, 0]; };
  assert.equal(catalogue.samplePoint(at(5))?.value, 0, 'inside is the one category');
  assert.equal(catalogue.samplePoint(at(5))?.sourceCell, 1);
  assert.equal(catalogue.samplePoint(at(7)), null, 'outside is missing, for the underlay to fill');
  assert.equal(catalogue.sample(0, 0), 0);
  assert.equal(catalogue.sample(180, 0), null);
});
