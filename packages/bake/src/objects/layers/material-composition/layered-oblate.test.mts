import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, textureTintFactors } from '@layoutit/polycss';
import { leafRasterScale, requireOutwardCap } from '@cssearth/bake/scene';
import { floodDiscMean, loadLimbLaw } from '@cssearth/bake/photometry';
import { displayBandRatios, loadWholeDiscColor } from '@cssearth/bake/objects/raster';
import { prepareSurfaceColor, widestPublishedImage, polarQuad } from '@cssearth/bake/objects/layers/material-composition';
import { assertCapFacesOut } from './fixtures/polar-caps.mts';

const image = (path: string, width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).webp({ lossless: true }).toFile(path);

test('a dataset-swapped leaf family is sized by the widest image any dataset publishes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'layered-oblate-images-'));
  try {
    // A 1x default surface beside @2x dataset surfaces, as Saturn publishes them (2,080 and 4,160 px wide there).
    const paths = [join(directory, 'surface-body.webp'), join(directory, 'surface-dataset@2x.webp'), join(directory, 'surface-other@2x.webp')];
    await Promise.all([image(paths[0]!, 26, 8), image(paths[1]!, 52, 16), image(paths[2]!, 52, 16)]);
    const widest = await widestPublishedImage(paths, 'hypothetical surface leaves');
    assert.equal(widest, 52);
    // The default image alone would leave the leaf at scale one; the datasets keep the recipe's scale two.
    assert.equal(leafRasterScale(widest, 13, 2), 2);
    assert.equal(leafRasterScale(await widestPublishedImage(paths.slice(0, 1), 'hypothetical surface leaves'), 13, 2), 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an image that cannot be measured is refused with its owner and path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'layered-oblate-images-'));
  try {
    const missing = join(directory, 'rings-dataset@2x.webp'), broken = join(directory, 'poles.webp');
    await writeFile(broken, 'not an image');
    await assert.rejects(widestPublishedImage([missing], 'hypothetical ring plane leaves'), (error: unknown) =>
      error instanceof Error && error.message.startsWith(`hypothetical ring plane leaves: ${missing} is not a readable image`));
    await assert.rejects(widestPublishedImage([broken], 'hypothetical polar cap leaves'), /hypothetical polar cap leaves: .*poles\.webp is not a readable image/u);
    await assert.rejects(widestPublishedImage([], 'hypothetical polar cap leaves'), /hypothetical polar cap leaves: no published image to measure/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("Saturn's tinted OPAL map is tied to Karkoschka's whole-disc color and keeps its luminance, with the numbers its README reports", async () => {
  const source = resolve(findProjectRoot(import.meta.url), 'src/objects/saturn/source');
  const recipe = JSON.parse(await readFile(join(source, 'preparation/geometry.json'), 'utf8')), parameters = recipe.parameters;
  const tint = textureTintFactors(Math.PI, parameters.objectSolarAlbedoMultiplier, parameters.objectSolarAlbedoMultiplier, 0), peak = Math.max(tint.r, tint.g, tint.b);
  const tie = displayBandRatios(await loadWholeDiscColor(source, recipe.colorTie), floodDiscMean(await loadLimbLaw(source, recipe.limb.models)));
  const { tie: report } = await prepareSurfaceColor({ sourcePath: join(source, recipe.sources.surface), unobservedRows: recipe.surfaceUnobservedRows,
    width: parameters.planetSourceTextureWidth, height: parameters.planetSourceTextureHeight, equatorialToPolar: parameters.objectEquatorialRadiusKm / parameters.objectPolarRadiusKm,
    channelFactors: [tint.r / peak, tint.g / peak, tint.b / peak], tie });
  assert.deepEqual(report, { reference: 'red', source: 'karkoschka-1998-whole-disc-color', measured: { green: 0.9272, blue: 0.6953 }, published: { green: 0.6759, blue: 0.5057 }, gains: [1, 0.729, 0.7273],
    luminance: { factor: 1.264, knee: 0.8, shoulderedTexels: 180204, shoulderedShare: 0.0435 } });
});

test("Saturn's caps sit on the oblate polar carrier, which faces out of the body at the lane's own tile size", async () => {
  // All four cap families of the lane (surface, inner, cutaway outer poles and interior shells) are polarQuad plates, and the
  // lane refuses one that faces in (requireOutwardCap) while it bakes; the lane itself only runs inside that bake. Facing
  // depends on the carrier's winding and on the side of the equator a plate stands on, not on its size. The samples are
  // close to the published caps' half-widths and heights, as fractions of the equatorial radius: the surface and inner caps,
  // then the metallic-hydrogen and core shells' caps.
  const recipe = JSON.parse(await readFile(resolve(findProjectRoot(import.meta.url), 'src/objects/saturn/source/preparation/geometry.json'), 'utf8'));
  const { tileSize, equatorialRadius } = recipe.parameters as { tileSize: number; equatorialRadius: number };
  for (const pole of ['north', 'south'] as const) for (const [radius, height] of [[0.2, 0.885], [0.205, 0.875], [0.267, 0.567], [0.173, 0.367]]) {
    const z = (pole === 'north' ? 1 : -1) * height! * equatorialRadius, plate = polarQuad({ pole, radius: radius! * equatorialRadius, z });
    const plan = computeTextureAtlasPlanPublic({ ...plate, texture: '/poles.webp', color: '#ffffff',
      textureImageSource: { url: '/poles.webp', width: 512, height: 256, sourceRect: { x: pole === 'north' ? 0 : 256, y: 0, width: 256, height: 256 } },
      texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' } }, 0, { tileSize, layerElevation: tileSize, seamBleed: 0 });
    const geometry = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
    assert.ok(geometry, `${pole} plate at ${radius}, ${height} prepares`);
    requireOutwardCap('saturn', pole, geometry.matrix);
    assertCapFacesOut(`saturn ${pole} plate at ${radius}, ${height}`, pole,
      `transform:matrix3d(${geometry.matrix});--polycss-atlas-width:${geometry.leafWidth}px;--polycss-atlas-height:${geometry.leafHeight}px`);
  }
});
