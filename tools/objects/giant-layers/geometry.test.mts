import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { TEXELS_PER_CSS_PIXEL, leafRasterScale } from '../../../src/platform/projective-surface-raster.mts';
import { prepareBandedEllipsoid, domeRingWarp, latitudeRasterBands, type BandedImagePixels } from './geometry.mts';
import { publishedLeafImages } from './object.mts';
import { readFile } from 'node:fs/promises';
import { assertPolarCaps, poleOfClass } from '../../../tests/objects/polar-caps.mts';
import { polarImageProjection } from '../giant-observations/index.mts';
import { writeDomeRings } from '../giant-observations/polar-dome.mts';
import { packProjectiveSurfaceRaster } from '../../../src/platform/projective-surface-raster.mts';
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
const capsOf = (leaves: readonly Leaf[], owner: string, perPole = 2) => {
  const caps = leaves.filter(leaf => /\bpole-(inner|outer)\b/u.test(leaf.className ?? ''));
  assert.equal(caps.length, perPole * 2, `${owner}: ${perPole} caps at each pole`);
  assert.ok(leaves.filter(leaf => !caps.includes(leaf)).every(leaf => !leaf.style.includes('border-radius')), `${owner}: bands keep their own shape`);
  return caps.map(leaf => ({ pole: poleOfClass(leaf.className ?? ''), style: leaf.style, label: leaf.className }));
};

test('latitude-bound caps, Jupiter\'s dome caps among them, follow the one cap rule', async () => {
  assertPolarCaps('fixture', capsOf(latitudeBound(prepareBandedEllipsoid(recipe(), images(2048, 2048))).leaves, 'fixture'));
  const { leaves } = await jupiterDome();
  assertPolarCaps('jupiter', capsOf(leaves, 'jupiter', 1));
});

// Jupiter's own recipes: the geometry, and the observation recipe that declares its pole tiles' projection.
const jupiterJson = async (name: string): Promise<unknown> => JSON.parse(await readFile(new URL(`../../../src/objects/jupiter/source/preparation/${name}.json`, import.meta.url), 'utf8'));
async function jupiterDome() {
  const recipe = await jupiterJson('geometry'), poles = polarImageProjection(await jupiterJson('observations'));
  const geometry = latitudeBound(prepareBandedEllipsoid(recipe, { surface: 4160, image: () => 2048, poles }));
  const config = recipe as { shape: { equatorialRadius: number; polarRadius: number }; latitudeBoundsDegrees: number[]; longitudeSegments: number;
    surface: { width: number; height: number; gutter: number }; polar: { dome: { edgeLatitudeDegrees: number; longitudeSegments: number } } };
  return { ...geometry, config, poles, warp: domeRingWarp(recipe) };
}
const matrixOf = (style: string) => (/matrix3d\(([^)]+)\)/u.exec(style)?.[1] ?? '').split(',').map(Number);
const lengthOf = (style: string, name: string) => Number(new RegExp(`(?:^|;)${name}:([\\d.]+)px`, 'u').exec(style)?.[1]);
/** World position (x, y, z) of a point of a leaf's box: its matrix3d, homogeneous, back from CSS axes (PolyCSS draws world x
 * along CSS y and world y along CSS x, at 50 CSS px per unit). */
const boxPoint = (style: string, bx: number, by: number) => {
  const m = matrixOf(style), w = m[3]! * bx + m[7]! * by + m[15]!, css = [0, 1, 2].map(k => (m[k]! * bx + m[4 + k]! * by + m[12 + k]!) / w);
  return [css[1]! / 50, css[0]! / 50, css[2]! / 50] as const;
};

test('Jupiter\'s dome: bands stop at 64°, two rings of 64 quads close each side to a cap at 80°, and 770 leaves in all', async () => {
  const { leaves, config } = await jupiterDome();
  const bounds = config.latitudeBoundsDegrees, dome = (index: number) => Math.min(Math.abs(bounds[index - 1]!), Math.abs(bounds[index]!)) >= 64;
  const body = leaves.filter(leaf => !('pole' in leaf));
  for (const [index] of bounds.slice(1).entries()) {
    const latitudeIndex = index + 1, count = body.filter(leaf => 'latitudeIndex' in leaf && leaf.latitudeIndex === latitudeIndex).length;
    assert.equal(count, dome(latitudeIndex) ? 64 : 32, `band ${bounds[index]}..${bounds[index + 1]}`);
  }
  assert.deepEqual(bounds.filter(bound => Math.abs(bound) > 64), [-80, -72, 72, 80]);
  assert.equal(leaves.length, 16 * 32 + 4 * 64 + 2);
});

test('nothing of Jupiter\'s dome stands outside the body: every band corner is on it (within 0.01%), and each cap disc stays within 0.2% of its radius', async () => {
  const { leaves, config } = await jupiterDome(), { equatorialRadius: a, polarRadius: c } = config.shape;
  const scaled = ([x, y, z]: readonly number[]) => Math.hypot(x! / a, y! / a, z! / c);
  let capRim = 0;
  for (const leaf of leaves) {
    const width = lengthOf(leaf.style, 'width'), height = lengthOf(leaf.style, 'height');
    if ('pole' in leaf) {
      for (let k = 0; k < 360; k++) capRim = Math.max(capRim, scaled(boxPoint(leaf.style, width / 2 * (1 + Math.cos(k * Math.PI / 180)), height / 2 * (1 + Math.sin(k * Math.PI / 180)))));
    } else for (const [bx, by] of [[0, 0], [width, 0], [width, height], [0, height]] as const)
      assert.ok(scaled(boxPoint(leaf.style, bx, by)) < 1 + 1e-4, `${leaf.style.slice(0, 60)}: corner outside the body`);
  }
  assert.ok(capRim > 1 && capRim < 1.002, `the cap discs' rims stand ${((capRim - 1) * 100).toFixed(3)}% of the radius out`);
});

test('every dome ring texel lands within one pole-image texel of its latitude, through the rows the observation lane writes and the band packer', async () => {
  const { leaves, config, warp, poles } = await jupiterDome(), { equatorialRadius: a, polarRadius: c } = config.shape;
  const { width, height, gutter } = config.surface, bounds = config.latitudeBoundsDegrees;
  // A map whose four channels are linear ramps in latitude over each ring (running 2° past it), which the row warp's linear
  // interpolation and the leaves' bilinear sampling carry exactly. The real packer then lays it out as the atlas.
  const rings = warp.map(ring => ({ ...ring, low: ring.southDegrees - 2, span: ring.northDegrees - ring.southDegrees + 4 }));
  const map = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) { const latitude = 90 - (y + 0.5) / height * 180;
    rings.forEach((ring, channel) => { const value = Math.round(Math.max(0, Math.min(1, (latitude - ring.low) / ring.span)) * 255);
      for (let x = 0; x < width; x++) map[(y * width + x) * 4 + channel] = value; }); }
  const packed = writeDomeRings(packProjectiveSurfaceRaster(map, { width, height, channels: 4, bands: latitudeRasterBands(bounds, height), gutter }),
    { data: map, info: { width, height, channels: 4 } }, warp, bounds);
  const texelDegrees = (90 - poles.edgeLatitudeDegrees) / (256 * poles.scale);
  const sample = (x: number, y: number, channel: number) => {
    const x0 = Math.floor(x - 0.5), y0 = Math.floor(y - 0.5), fx = x - 0.5 - x0, fy = y - 0.5 - y0;
    const at = (px: number, py: number) => packed.data[(py * packed.packedWidth + px) * 4 + channel]!;
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  };
  let worst = 0, checked = 0;
  for (const leaf of leaves) {
    if ('pole' in leaf || !('latitudeIndex' in leaf)) continue;
    const channel = rings.findIndex(ring => ring.southDegrees === bounds[leaf.latitudeIndex - 1] && ring.northDegrees === bounds[leaf.latitudeIndex]);
    if (channel < 0) continue;
    const ring = rings[channel]!, width = lengthOf(leaf.style, 'width'), height = lengthOf(leaf.style, 'height');
    const [px, py] = (/background-position:([^;]+)/u.exec(leaf.style)?.[1] ?? '').split(' ').map(parseFloat), [sx, sy] = (/background-size:([^;]+)/u.exec(leaf.style)?.[1] ?? '').split(' ').map(parseFloat);
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
      const bx = i / 10 * width, by = j / 10 * height, [x, y, z] = boxPoint(leaf.style, bx, by);
      const latitude = Math.atan2(z / c, Math.hypot(x, y) / a) * 180 / Math.PI;
      const shown = ring.low + sample((bx - px!) / sx! * packed.packedWidth, (by - py!) / sy! * packed.packedHeight, channel) / 255 * ring.span;
      worst = Math.max(worst, Math.abs(shown - latitude) / texelDegrees); checked++;
    }
  }
  assert.equal(checked, 4 * 64 * 121);
  assert.ok(worst < 1, `a ring texel lands ${worst.toFixed(2)} pole-image texels from its latitude`);
});

test('a dome cap shows its tile at the tile\'s own projection, within one pole-image texel', async () => {
  const { leaves, config, poles } = await jupiterDome(), { equatorialRadius: a, polarRadius: c } = config.shape;
  const texelDegrees = (90 - poles.edgeLatitudeDegrees) / (256 * poles.scale), tile = 256;
  for (const leaf of leaves.filter(leaf => 'pole' in leaf)) {
    const pole = 'pole' in leaf ? leaf.pole : '', sign = pole === 'north' ? 1 : -1, tileIndex = pole === 'north' ? 1 : 0;
    const width = lengthOf(leaf.style, 'width'), height = lengthOf(leaf.style, 'height');
    const [px, py] = (/background-position:([^;]+)/u.exec(leaf.style)?.[1] ?? '').split(' ').map(parseFloat), [sx, sy] = (/background-size:([^;]+)/u.exec(leaf.style)?.[1] ?? '').split(' ').map(parseFloat);
    let worst = 0;
    for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) {
      const bx = i / 20 * width, by = j / 20 * height;
      if (Math.hypot(bx / width - 0.5, by / height - 0.5) > 0.5) continue;
      const [x, y, z] = boxPoint(leaf.style, bx, by), latitude = Math.atan2(z / c, Math.hypot(x, y) / a), longitude = Math.atan2(y, x);
      // Tiles are laid out for the caps: tile coordinates d hold the surface in direction (dx, ±dy) at radius |d| / scale.
      const dx = ((bx - px!) / sx! * 2 * tile - tileIndex * tile) / tile * 2 - 1, dy = (by - py!) / sy! * 2 - 1;
      const shownLatitude = sign * (90 - Math.hypot(dx, dy) / poles.scale * (90 - poles.edgeLatitudeDegrees)) * Math.PI / 180, shownLongitude = Math.atan2(sign * dy, dx);
      const along = (shownLatitude - latitude) * 180 / Math.PI, across = (((shownLongitude - longitude) * 180 / Math.PI + 540) % 360 - 180) * Math.cos(latitude);
      worst = Math.max(worst, Math.hypot(along, across) / texelDegrees);
    }
    assert.ok(worst < 1, `${pole} cap: a texel lands ${worst.toFixed(2)} pole-image texels from where it belongs`);
  }
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
