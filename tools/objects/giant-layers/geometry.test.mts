import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { TEXELS_PER_CSS_PIXEL, leafRasterScale } from '../../../src/platform/projective-surface-raster.mts';
import { prepareBandedEllipsoid, type BandedImagePixels } from './geometry.mts';
import { publishedLeafImages } from './object.mts';
import { readFile } from 'node:fs/promises';
import { assertPolarCaps, poleOfClass } from '../../../tests/objects/polar-caps.mts';
const test = sourceTest();

const ringUrl = '/scenes/hypothetical/rings@2x.webp';
const recipe = () => ({
  schema: 'cssearth-banded-ellipsoid@1', coordinateArithmetic: 'bounds', leafRecord: 'explicit', verifyWrapSeams: true,
  shape: { equatorialRadius: 230, polarRadius: 215 }, latitudeSegments: 4, longitudeSegments: 8, latitudeBoundsDegrees: [-60, -30, 0, 30, 60],
  surface: { url: '/scenes/hypothetical/surface.webp', width: 512, height: 256, gutter: 4, overscan: 0, overlap: 0.008, seamBleed: 0, rasterScale: 4,
    color: '#806040', polarOverlapLatitudeDegrees: 50, polarOverlap: 0.02 },
  polar: { url: '/scenes/hypothetical/poles.webp', tileSize: 64, boundaryLatitudeDegrees: 60, overlayLatitudeDegrees: 50, southFirst: true,
    separateInnerTiles: false, fitToTile: false, surfaceOverlap: 1.035, innerOverlap: 1.05, surfaceOffset: 0.1, innerInset: 2.4, innerOffsetBeforeSubtract: true },
  classes: { surface: '', polarInner: 'pole-inner pole-{pole}', polarSurface: 'pole-outer pole-{pole}' },
  planOptions: { tileSize: 50, layerElevation: 50, textureLighting: 'source', seamBleed: 0 },
  planes: [],
  tiledPlanes: [{ id: 'system', radius: 100, worldScale: 50, grid: 4, overlap: 50, url: ringUrl, className: 'ring-leaf' }],
});
const images = (surface: number, ring: number): BandedImagePixels => ({ surface, image: url => { if (url !== ringUrl) throw new Error(`unexpected ${url}`); return ring; } });
const latitudeBound = (geometry: ReturnType<typeof prepareBandedEllipsoid>) => { if (!('leaves' in geometry)) throw new Error('Expected latitude-bound geometry'); return geometry; };
const declarations = (style: string) => new Map(style.split(';').map(part => { const at = part.indexOf(':'); return [part.slice(0, at), part.slice(at + 1)] as const; }));
const px = (value: string | undefined) => { const match = /^(-?[\d.]+)px$/u.exec(value ?? ''); if (!match) throw new Error(`not a length: ${value}`); return Number(match[1]); };

test('ring tiles hold their image at two texels per CSS pixel and keep the plane they drew before', () => {
  const { ringLeaves } = latitudeBound(prepareBandedEllipsoid(recipe(), images(2048, 2048)));
  // The plane is 10,000 CSS px across (radius 100 × world scale 50) in a 4 × 4 grid of 2,500 px steps with 50 px overlaps.
  const diameter = 10000, step = 2500, k = 2048 / diameter / TEXELS_PER_CSS_PIXEL;
  assert.equal(ringLeaves.length, 16);
  for (const leaf of ringLeaves) {
    const style = declarations(leaf.style), matrix = /^matrix3d\(([^()]+)\)$/u.exec(style.get('transform') ?? '')?.[1]?.split(',').map(Number);
    assert.ok(matrix && matrix.length === 16, leaf.style);
    const [scale, , , , , scaleY] = matrix, [tx, ty] = [matrix[12]!, matrix[13]!];
    assert.equal(scale, scaleY);
    assert.deepEqual(matrix.filter((_, index) => ![0, 5, 12, 13].includes(index)), [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1]);
    const [width, height] = [px(style.get('width')), px(style.get('height'))];
    const [positionX, positionY] = (style.get('background-position') ?? '').split(' ').map(px), [sizeX, sizeY] = (style.get('background-size') ?? '').split(' ').map(px);
    // Two image texels per box pixel: the 2,048 px image spans a 1,024 px background.
    assert.equal(sizeX, 1024); assert.equal(sizeY, 1024);
    // Every box point lands where the unscaled tile put it, and samples the same texel.
    const overlapX = leaf.tileColumn === 3 ? 0 : 50, overlapY = leaf.tileRow === 3 ? 0 : 50;
    assert.ok(Math.abs(tx - (-diameter / 2 + leaf.tileColumn * step)) < 1e-6 && Math.abs(ty - (-diameter / 2 + leaf.tileRow * step)) < 1e-6);
    assert.ok(Math.abs(scale! * width - (step + overlapX)) < 1e-4 && Math.abs(scale! * height - (step + overlapY)) < 1e-4, leaf.style);
    assert.ok(Math.abs(positionX! / k + leaf.tileColumn * step) < 1e-4 && Math.abs(positionY! / k + leaf.tileRow * step) < 1e-4, leaf.style);
    const texel = (x: number, position: number) => (x - position) / sizeX! * 2048, world = (x: number, column: number) => (x + column * step) / diameter * 2048;
    for (const u of [0, 0.37, 1]) assert.ok(Math.abs(texel(u * width, positionX!) - world(u * scale! * width, leaf.tileColumn)) < 1e-6);
  }
});

test('a tile never grows its box when its image holds fewer than two texels per CSS pixel', () => {
  const [leaf] = latitudeBound(prepareBandedEllipsoid(recipe(), images(2048, 40000))).ringLeaves;
  assert.ok(leaf);
  assert.match(leaf.style, /^width:2550\.000000px;height:2550\.000000px;transform:matrix3d\(1,0,0,0,0,1,0,0,0,0,1,0,-5000\.000000,-5000\.000000,0,1\)/u);
  assert.match(leaf.style, /background-size:10000\.000000px 10000\.000000px$/u);
});

test('surface faces take the raster scale that shows their widest image at two texels per CSS pixel, under the recipe ceiling', () => {
  const faces = (surface: number) => latitudeBound(prepareBandedEllipsoid(recipe(), images(surface, 2048))).leaves.filter(leaf => 'projectiveTextureLayer' in leaf);
  const background = (leaf: { style: string }) => px(declarations(leaf.style).get('background-size')?.split(' ')[0]);
  const at = (surface: number) => faces(surface).map(leaf => 'projectiveTextureLayer' in leaf ? leaf.projectiveTextureLayer?.rasterScale : undefined);
  const [first] = faces(1024);
  assert.ok(first);
  const width = background(first);
  // An image four times as wide as the face's background at scale one lands at two texels per CSS pixel at scale two.
  assert.deepEqual(new Set(at(width * 4)), new Set([2]));
  assert.deepEqual(new Set(at(width * 2)), new Set([1]));
  assert.deepEqual(new Set(at(width)), new Set([0.5]));
  // The recipe's scale stays the ceiling.
  assert.deepEqual(new Set(at(width * 100)), new Set([4]));
  for (const leaf of faces(width * 3)) assert.equal('projectiveTextureLayer' in leaf && leaf.projectiveTextureLayer?.rasterScale, leafRasterScale(width * 3, background(leaf), 4));
  // Poles are not raster layers and carry no scale.
  assert.equal(latitudeBound(prepareBandedEllipsoid(recipe(), images(width * 4, 2048))).leaves.filter(leaf => 'pole' in leaf && 'projectiveTextureLayer' in leaf).length, 0);
});

test('a leaf image the preparation did not publish is refused by name', () => {
  const observations = { schema: 'cssearth-observed-polar-surfaces@1' as const, lenses: [
    { files: { surface: 'surface.webp', surface2x: 'surface@2x.webp' } }, { files: { surface: 'lens.webp', surface2x: 'lens@2x.webp' } }] };
  const assets = [{ filename: 'surface.webp', width: 2080 }, { filename: 'surface@2x.webp', width: 4160 }, { filename: 'lens.webp', width: 2080 }, { filename: 'lens@2x.webp', width: 4160 }, { filename: 'rings@2x.webp', width: 2048 }];
  const published = publishedLeafImages('hypothetical', observations, assets);
  assert.equal(published.surface, 4160);
  assert.equal(published.image(ringUrl), 2048);
  assert.throws(() => published.image('/scenes/hypothetical/missing.webp'), /hypothetical: leaf image missing\.webp was not published/u);
  assert.throws(() => published.image('/scenes/other/rings@2x.webp'), /is not under \/scenes\/hypothetical\//u);
  assert.throws(() => publishedLeafImages('hypothetical', observations, assets.slice(1)), /leaf image surface\.webp was not published/u);
  assert.throws(() => prepareBandedEllipsoid(recipe(), publishedLeafImages('hypothetical', observations, assets.slice(0, -1))), /hypothetical: leaf image rings@2x\.webp was not published/u);
});

type Leaf = { style: string; className?: string };
const capsOf = (leaves: readonly Leaf[], owner: string) => {
  const caps = leaves.filter(leaf => /\bpole-(inner|outer)\b/u.test(leaf.className ?? ''));
  assert.equal(caps.length, 4, `${owner}: an inner and an outer cap at each pole`);
  assert.ok(leaves.filter(leaf => !caps.includes(leaf)).every(leaf => !leaf.style.includes('border-radius')), `${owner}: bands keep their own shape`);
  return caps.map(leaf => ({ pole: poleOfClass(leaf.className ?? ''), style: leaf.style, label: leaf.className }));
};

test('latitude-bound caps, Jupiter\'s own among them, follow the one cap rule', async () => {
  assertPolarCaps('fixture', capsOf(latitudeBound(prepareBandedEllipsoid(recipe(), images(2048, 2048))).leaves, 'fixture'));
  const jupiter: unknown = JSON.parse(await readFile(new URL('../../../src/objects/jupiter/source/preparation/geometry.json', import.meta.url), 'utf8'));
  const leaves = latitudeBound(prepareBandedEllipsoid(jupiter, { surface: 4160, image: () => 2048 })).leaves;
  assertPolarCaps('jupiter', capsOf(leaves, 'jupiter'));
});

test('caps of the stepped and fractional tessellations follow the one cap rule in every leaf record', () => {
  for (const coordinateArithmetic of ['step', 'fraction'] as const) for (const leafRecord of ['compact', 'annotated'] as const) {
    const { latitudeBoundsDegrees: _bounds, ...bounded } = recipe(), owner = `${coordinateArithmetic} ${leafRecord}`;
    const geometry = prepareBandedEllipsoid({ ...bounded, coordinateArithmetic, leafRecord, latitudeSegments: 8, tiledPlanes: [],
      polar: { ...bounded.polar, boundaryLatitudeDegrees: undefined, overlayLatitudeDegrees: undefined } }, images(2048, 2048));
    if (!('bodyBands' in geometry)) throw new Error(`${owner}: expected banded geometry`);
    assertPolarCaps(owner, capsOf(geometry.bodyBands.flatMap(band => band.leaves), owner));
  }
});
