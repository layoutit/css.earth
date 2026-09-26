import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { textureTintFactors } from '@layoutit/polycss';
import { leafRasterScale } from '../../../src/platform/projective-surface-raster.mts';
import { floodDiscMean, loadLimbLaw } from '../../photometry/limb.mts';
import { displayBandRatios, loadWholeDiscColour } from '../../photometry/whole-disc-colour.mts';
import { prepareSurfaceColour, widestPublishedImage } from './layered-oblate.mts';

const image = (path: string, width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).webp({ lossless: true }).toFile(path);

test('a lens-swapped leaf family is sized by the widest image any lens publishes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'layered-oblate-images-'));
  try {
    // A 1x default surface beside @2x lens surfaces, as Saturn publishes them (2,080 and 4,160 px wide there).
    const paths = [join(directory, 'surface-body.webp'), join(directory, 'surface-lens@2x.webp'), join(directory, 'surface-other@2x.webp')];
    await Promise.all([image(paths[0]!, 26, 8), image(paths[1]!, 52, 16), image(paths[2]!, 52, 16)]);
    const widest = await widestPublishedImage(paths, 'hypothetical surface leaves');
    assert.equal(widest, 52);
    // The default image alone would leave the leaf at scale one; the lenses keep the recipe's scale two.
    assert.equal(leafRasterScale(widest, 13, 2), 2);
    assert.equal(leafRasterScale(await widestPublishedImage(paths.slice(0, 1), 'hypothetical surface leaves'), 13, 2), 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an image that cannot be measured is refused with its owner and path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'layered-oblate-images-'));
  try {
    const missing = join(directory, 'rings-lens@2x.webp'), broken = join(directory, 'poles.webp');
    await writeFile(broken, 'not an image');
    await assert.rejects(widestPublishedImage([missing], 'hypothetical ring plane leaves'), (error: unknown) =>
      error instanceof Error && error.message.startsWith(`hypothetical ring plane leaves: ${missing} is not a readable image`));
    await assert.rejects(widestPublishedImage([broken], 'hypothetical polar cap leaves'), /hypothetical polar cap leaves: .*poles\.webp is not a readable image/u);
    await assert.rejects(widestPublishedImage([], 'hypothetical polar cap leaves'), /hypothetical polar cap leaves: no published image to measure/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("Saturn's tinted OPAL map is tied to Karkoschka's whole-disc colour and keeps its luminance, with the numbers its README reports", async () => {
  const source = resolve(import.meta.dirname, '../../../src/objects/saturn/source');
  const recipe = JSON.parse(await readFile(join(source, 'preparation/geometry.json'), 'utf8')), parameters = recipe.parameters;
  const tint = textureTintFactors(Math.PI, parameters.objectSolarAlbedoMultiplier, parameters.objectSolarAlbedoMultiplier, 0), peak = Math.max(tint.r, tint.g, tint.b);
  const tie = displayBandRatios(await loadWholeDiscColour(source, recipe.colourTie), floodDiscMean(await loadLimbLaw(source, recipe.limb.models)));
  const { tie: report } = await prepareSurfaceColour({ sourcePath: join(source, recipe.sources.surface), unobservedRows: recipe.surfaceUnobservedRows,
    width: parameters.planetSourceTextureWidth, height: parameters.planetSourceTextureHeight, equatorialToPolar: parameters.objectEquatorialRadiusKm / parameters.objectPolarRadiusKm,
    channelFactors: [tint.r / peak, tint.g / peak, tint.b / peak], tie });
  assert.deepEqual(report, { reference: 'red', source: 'karkoschka-1998-whole-disc-colour', measured: { green: 0.9272, blue: 0.6953 }, published: { green: 0.6759, blue: 0.5057 }, gains: [1, 0.729, 0.7273],
    luminance: { factor: 1.264, knee: 0.8, shoulderedTexels: 180204, shoulderedShare: 0.0435 } });
});
