import {parseSurfaceGeometry,parseBandLenses,parseEmissiveLenses} from '../../../../tools/objects/static-surface/source-contract.mts';
import {parseBandReplayScene} from '../../../../tools/prepared-replay-source.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectRoot, readPreparedFixture } from '../../fixtures.mts';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';
import { prepareBandSurfaceScene } from '../../../../tools/objects/static-surface/band-scene.mts';
import { prepareSegmentedSurfaceScene } from '../../../../tools/objects/static-surface/segmented-scene.mts';
import { prepareBandSurfacePresentation, prepareEmissiveSurfacePresentation } from '../../../../tools/objects/static-surface/presentation.mts';
import { scientificFalseColor, prepareFitsMap, readFitsPrimary } from '../../../../tools/objects/static-surface/fits-map.mts';
import { readPhysicalFacts } from '../../../../tools/objects/static-surface/physical.mts';
import { contextualizeStaticSurfaceScene } from '../../../../tools/objects/static-surface/index.mts';
import { prepareWorldNavigationDefinition } from '../../../../tools/objects/dist/prepare-world-navigation.js';

const read = async (path: string) => JSON.parse(await readFile(resolve(projectRoot, path), 'utf8'));
for (const id of ['sun']) {
  test(`${id}: authored inputs regenerate the exact retained geometry and runtime`, async () => {
    const descriptor = parseAuthoredObjectDescriptor(await read(`src/planets/${id}/object.json`));
    for (const reference of descriptor.recipe.sources) {
      const bytes = await readFile(resolve(projectRoot, 'src/planets', id, reference.path));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), reference.sha256, reference.path);
    }
    const profile = parseSurfaceGeometry(await read(`src/planets/${id}/source/preparation/geometry.json`));
    assert.equal(Object.hasOwn(profile.metadata.body, 'leaves'), false);
    assert.equal(Object.hasOwn(profile.metadata.body, 'bands'), false);
    const expected = await readPreparedFixture(id, 'runtime');
    const lenses = await readPreparedFixture(id, 'lenses'), sky = expected.sky, sun = expected.sun;
    const contextReference = descriptor.recipe.sources.find(source => source.id === 'world-context');
    const context = contextReference ? await readPreparedFixture(id, 'world-context') : undefined;
    const {scene,presentation}=await(async()=>{
      if(profile.kind==='disc-poles'){
        const scene=contextualizeStaticSurfaceScene(prepareBandSurfaceScene(profile).scene,context,id);
        return {scene,presentation:await prepareBandSurfacePresentation({namespace:id,plan:parseBandReplayScene(scene),lenses:parseBandLenses(lenses),sky,sun})};
      }
      const scene=contextualizeStaticSurfaceScene(prepareSegmentedSurfaceScene(profile,sky),context,id);
      return {scene,presentation:await prepareEmissiveSurfacePresentation({namespace:id,plan:scene,lenses:parseEmissiveLenses(lenses)})};
    })();
    assert.deepEqual(scene,await readPreparedFixture(id,'scene'));
    const finalized = await prepareWorldNavigationDefinition({ objectDirectory: resolve(projectRoot, 'src/planets', id),
      definition: { ...presentation, schema: expected.schema, id, controls: expected.controls }, projectRoot });
    assert.deepEqual(finalized.definition, expected);
    const physical = await readPhysicalFacts({ sourceDirectory: resolve(projectRoot, 'src/planets', id, 'source'), config: await read(`src/planets/${id}/source/preparation/physical.json`) });
    assert.equal(physical.meanRadiusKm, descriptor.recipe.shape.radiusKm);
  });
}

test('scientific FITS colors preserve signed polarity and authored log intensity endpoints', async () => {
  const recipe = await read('src/planets/sun/source/preparation/raster.json');
  const signed = recipe.variants.find((variant: { fits: { color: { kind: string; }; }; }) => variant.fits?.color.kind === 'signed-asinh').fits.color;
  assert.deepEqual(scientificFalseColor(-250, signed), [28, 95, 190]);
  assert.deepEqual(scientificFalseColor(0, signed), [95, 32, 11]);
  assert.deepEqual(scientificFalseColor(250, signed), [255, 224, 110]);
  for (const variant of recipe.variants.filter((variant: { fits: { color: { kind: string; }; }; }) => variant.fits?.color.kind === 'positive-log')) {
    const color = variant.fits.color;
    assert.deepEqual(scientificFalseColor(color.range[0], color), color.palette[0]);
    assert.deepEqual(scientificFalseColor(color.range[1], color), color.palette.at(-1));
  }
});

test('FITS decoding rejects incomplete data and preserves signed floating observations', () => {
  const cards = ['SIMPLE  = T', 'BITPIX  = -32', 'NAXIS   = 2', 'NAXIS1  = 2', 'NAXIS2  = 2', 'END'].map(card => card.padEnd(80)).join('');
  const bytes = Buffer.alloc(2880 + 16, 0); bytes.write(cards, 'ascii');
  [-250, 250, 0, NaN].forEach((value, index) => bytes.writeFloatBE(value, 2880 + index * 4));
  assert.deepEqual([...readFitsPrimary(bytes).values], [-250, 250, 0, NaN]);
  assert.throws(() => readFitsPrimary(bytes.subarray(0, 2884)), /truncated/);
  const recipe: Parameters<typeof prepareFitsMap>[3] = { bitpix: -32, width: 2, height: 2, latitude: 'sine-latitude', reverseLongitude: true, nearestLatitudeLimit: 1, positiveOnly: false, color: { kind: 'signed-asinh', softening: 8, maximum: 250, palette: [[28,95,190],[95,32,11],[255,224,110]] } };
  const raster = prepareFitsMap(bytes, 2, 2, recipe);
  assert.equal(raster.length, 16);
  assert.deepEqual([raster[3], raster[7], raster[11], raster[15]], [255,255,255,255]);
  assert.throws(() => prepareFitsMap(bytes, 2, 2, { ...recipe, width: 4 }), /geometry/);
});
