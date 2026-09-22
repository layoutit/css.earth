import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadObjShape } from '../terrestrial-layers/obj-shape.mts';
import { apparitionLinks, bodyDirection, coveredShare, meshFaces, seenFaces, type FrameView } from './apparitions.mts';

/** A 100 km sphere of 5,040 triangles, in kilometres like the survey releases. */
async function sphere() {
  const rows = 36, columns = 72, vertices: string[] = [], faces: string[] = [], index = (r: number, c: number) => 2 + (r - 1) * columns + (c % columns);
  const point = (latitude: number, longitude: number) => `v ${100 * Math.cos(latitude) * Math.cos(longitude)} ${100 * Math.cos(latitude) * Math.sin(longitude)} ${100 * Math.sin(latitude)}`;
  vertices.push(point(Math.PI / 2, 0), point(-Math.PI / 2, 0));
  for (let r = 1; r < rows; r++) for (let c = 0; c < columns; c++) vertices.push(point(Math.PI / 2 - r * Math.PI / rows, c * 2 * Math.PI / columns));
  for (let c = 0; c < columns; c++) { faces.push(`f 1 ${index(1, c)} ${index(1, c + 1)}`); faces.push(`f 2 ${index(rows - 1, c + 1)} ${index(rows - 1, c)}`); }
  for (let r = 1; r < rows - 1; r++) for (let c = 0; c < columns; c++) faces.push(`f ${index(r, c)} ${index(r + 1, c)} ${index(r + 1, c + 1)}`, `f ${index(r, c)} ${index(r + 1, c + 1)} ${index(r, c + 1)}`);
  const path = `${mkdtempSync(`${tmpdir()}/apparitions-`)}/sphere.obj`;
  writeFileSync(path, [...vertices, ...faces].join('\n') + '\n');
  return loadObjShape(path, { metersPerUnit: 1000, expectedVertices: vertices.length, expectedFaces: faces.length });
}
/** Seen from a latitude at opposition: the Sun behind the observer. */
const view = (latitude: number, westLongitude = 0): FrameView => ({ observer: bodyDirection(latitude, westLongitude), sun: bodyDirection(latitude, westLongitude), latitude, rangeKm: 2e8 });
const RULE = { gateDegrees: 60, minimumPairs: 128, displaySamples: 800 * 24 };

test('a view sees the faces that face it and the Sun within the limit', async () => {
  const mesh = await sphere(), faces = meshFaces(mesh);
  // A cap within 70° of the sub-observer point is (1 - cos 70°) / 2 of a sphere, to the 5° facets' edge.
  assert.ok(Math.abs(coveredShare(faces, [seenFaces(faces, mesh, view(20), 70)]) - (1 - Math.cos(70 * Math.PI / 180)) / 2) < .03);
  // Two views from opposite poles see the two caps, and nothing twice.
  const both = coveredShare(faces, [seenFaces(faces, mesh, view(90), 70), seenFaces(faces, mesh, view(-90), 70)]);
  assert.ok(Math.abs(both - (1 - Math.cos(70 * Math.PI / 180))) < .03);
  // The Sun limits it as the camera does: lit from 90° away, only the band both reach counts.
  const side = { ...view(0), sun: bodyDirection(0, 90) };
  assert.ok(coveredShare(faces, [seenFaces(faces, mesh, side, 70)]) < coveredShare(faces, [seenFaces(faces, mesh, view(0), 70)]) / 2);
});

test('an apparition joins only through surface a cast frame shares within the fit\'s angle limit', async () => {
  const mesh = await sphere(), faces = meshFaces(mesh);
  // Pallas: views 67° south and 72° north share nothing within 60°.
  const pallas = apparitionLinks(faces, mesh, [{ apparition: 0, view: view(-67) }, { apparition: 1, view: view(72) }], 0, RULE);
  assert.deepEqual(pallas.map(link => [link.cast, link.sharedSamples]), [[true, null], [false, 0]]);
  // Kleopatra: 28° north and 35° south, 63° apart, share a band.
  const kleopatra = apparitionLinks(faces, mesh, [{ apparition: 0, view: view(28) }, { apparition: 1, view: view(-35) }], 0, RULE);
  assert.equal(kleopatra[1].cast, true);
  assert.ok((kleopatra[1].sharedSamples ?? 0) > RULE.minimumPairs);
  // Joining is transitive: an equatorial apparition carries the far pole's to the anchor.
  const chain = apparitionLinks(faces, mesh, [{ apparition: 0, view: view(-60) }, { apparition: 1, view: view(0) }, { apparition: 2, view: view(60) }], 0, RULE);
  assert.deepEqual(chain.map(link => link.cast), [true, true, true]);
  const broken = apparitionLinks(faces, mesh, [{ apparition: 0, view: view(-70) }, { apparition: 1, view: view(70) }, { apparition: 2, view: view(75) }], 0, RULE);
  assert.deepEqual(broken.map(link => link.cast), [true, false, false], 'two apparitions that reach each other but not the anchor stay out');
});
