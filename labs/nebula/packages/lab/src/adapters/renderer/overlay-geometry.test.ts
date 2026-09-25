import { parseLabModelJson, resolveLabModelPath } from '../../resources/model-paths.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, type Polygon } from '@layoutit/polycss';
import { prepareOverlayGeometry } from './overlay-geometry.js';
import { overlayCorners, rayToOverlayPlane, type OverlayFrame } from '@cssearth/bake/volume';

const project = (matrix: string, x: number, y: number) => {
  const m = matrix.split(',').map(Number), w = m[3] * x + m[7] * y + m[15];
  return [0, 1, 2].map(axis => (m[axis] * x + m[axis + 4] * y + m[axis + 12]) / w);
};
const css = (point: readonly number[]) => [point[1] * 50, point[0] * 50, 0];
const close = (a: readonly number[], b: readonly number[], message: string) =>
  a.forEach((value, i) => assert.ok(Math.abs(value - b[i]) < 1e-9, `${message} axis ${i}: ${value} != ${b[i]}`));

async function prepared() {
  return JSON.parse(await readFile('labs/nebula/packages/lab/src/features/alignment/fixtures/legacy-sky-geometry.json', 'utf8')) as
    { target: { directory: string }; provenance: any; frame: OverlayFrame }[];
}
test('every prepared image maps its full raster edges to the calibrated provenance corners without bleed', async () => {
  let images = 0;
  for (const { provenance } of await prepared()) for (const item of provenance.images) {
    images++; const { width, height } = item.output;
    const geometry = prepareOverlayGeometry(item.verticesUnits, width, height);
    assert.equal(geometry.leafWidth, width); assert.equal(geometry.leafHeight, height);
    assert.deepEqual(geometry.backgroundSize, [width, height]); assert.deepEqual(geometry.backgroundPosition, [0, 0]);
    [[0, 0], [width, 0], [width, height], [0, height]].forEach(([x, y], corner) =>
      close(project(geometry.matrix, x, y), css(item.verticesUnits[corner]), `${item.input.id} corner ${corner}`));
  }
  assert.ok(images >= 7, 'check the real prepared reference bank');
});
test('full-precision TAN projective interior maps independently calculated Astropy ICRS rays', async () => {
  const oracle = parseLabModelJson(await readFile('labs/nebula/packages/lab/src/features/alignment/fixtures/astropy-wcs.json', 'utf8'));
  const records = await prepared(); let checked = 0;
  for (const fixture of oracle.fixtures) {
    // A tangent-plane image admits an exact projective quad. Ordinary SIN is
    // nonlinear; its independent ray oracle belongs to overlay-wcs.test.ts.
    if (fixture.wcs.projection !== 'TAN') continue;
    const record = records.find(item => fixture.id.startsWith(`${basename(item.target.directory)}-`));
    assert.ok(record, fixture.id); const { frame } = record;
    const [width, height] = fixture.wcs.referenceDimension;
    const geometry = prepareOverlayGeometry(overlayCorners(fixture.wcs, frame), width, height);
    for (let i = 0; i < fixture.pixels.length; i++) {
      const [fx, fy] = fixture.pixels[i];
      const expected = rayToOverlayPlane(fixture.expectedIcrsRays[i], frame);
      close(project(geometry.matrix, fx - .5, height + .5 - fy), css(expected), `${fixture.id} independent pixel ${i}`); checked++;
    }
  }
  assert.ok(checked >= 30, 'retain every legacy TAN corner and interior sample');
});
test('old real Tarantula leaf fails calibrated edges even with atlas seamBleed zero', async () => {
  const item = (await prepared()).flatMap(record => record.provenance.images).find(item => /tarantula/.test(item.input.id));
  assert.ok(item, 'actual prepared Tarantula source required');
  const { width, height, texturePath } = item.output;
  const polygon: Polygon = { vertices: item.verticesUnits, uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], texture: texturePath,
    textureImageSource: { url: texturePath, width, height }, doubleSided: true,
    texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' } };
  const plan = computeTextureAtlasPlanPublic(polygon, 0, { tileSize: 50, layerElevation: 50, seamBleed: 0 });
  assert.ok(plan);
  const legacy = resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
  assert.ok(legacy);
  const before = project(legacy.matrix, 0, 0), exact = css(item.verticesUnits[0]);
  assert.ok(Math.hypot(...before.map((value, i) => value - exact[i])) > .01, 'old bleed must demonstrably violate the sky edge');
  close(project(prepareOverlayGeometry(item.verticesUnits, width, height).matrix, 0, 0), exact, 'corrected Tarantula');
});
test('sky compiler rejects invalid dimensions, non-coplanar, degenerate and crossed quads', () => {
  const quad: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [1.1, 1, 0], [0, 1, 0]];
  for (const dimensions of [[0, 1], [1.5, 2], [1, Infinity]]) assert.throws(() => prepareOverlayGeometry(quad, dimensions[0], dimensions[1]), TypeError);
  assert.throws(() => prepareOverlayGeometry([[0, 0, 1], ...quad.slice(1)], 10, 10), TypeError);
  assert.throws(() => prepareOverlayGeometry([quad[0], quad[2], quad[1], quad[3]], 10, 10), TypeError);
  assert.throws(() => prepareOverlayGeometry([[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]], 10, 10), TypeError);
});
