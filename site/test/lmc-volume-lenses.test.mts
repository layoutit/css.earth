import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';
import { parseObjectDescriptor } from '@cssearth/objects';
import { validatePreparedVolumeLenses } from '../../src/renderers/css/dist/universe.js';
import { parse, object, array, dictionary, number, string, tuple, json as jsonValue } from '../../tools/objects/material-composition/data-schema.mts';
const pin = object({ sha256: string, bytes: number });
const path = object({ path: string, sha256: string });
const brightness = object({ overall: number, x: number, y: number, z: number });
const recipeSchema = object({ defaultLens: string, settingsReceiptSha256: string,
  lenses: array(object({ imageId: string, resultId: string, brightness })) });
const starSchema = object({ stars: array(object({ id: string, positionUnits: tuple(number, number, number) })) });
const receiptSchema = object({ lenses: array(object({ id: string, textures: array(object({ path: string, sha256: string, bytes: number })) })) });

const root = new URL('../../src/objects/lmc/', import.meta.url);
const bytes = (file: string) => readFile(new URL(file, root));
const json = async (file: string): Promise<unknown> => JSON.parse((await bytes(file)).toString('utf8'));
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

test('the LMC bank regenerates from its compact finite-emission inputs exactly as the promotion baked it', async () => {
  const descriptor = parseObjectDescriptor(await json('object.json'));
  assert.ok(descriptor.prepared);
  assert.equal(descriptor.type, 'volume-lens-bank');
  // The descriptor names the compact delivery.
  const preparation = parse(descriptor.properties.preparation, object({ source: string }));
  const delivery = parse(await json(preparation.source), object({ delivery: object({ method: string, compactInputs: path }) }));
  assert.equal(delivery.delivery.method, 'finite-emission');
  const inputsBytes = await readFile(new URL(`../../${delivery.delivery.compactInputs.path}`, import.meta.url));
  assert.ok(inputsBytes.length > 0);

  // Every regenerated slice is byte-identical to the slice the promotion wrote from the laboratory bake.
  const manifest = parse(await json('source/lens-manifest.json'), object({ outputs: dictionary(pin) }));
  const promoted = Object.entries(manifest.outputs).filter(([file]) => /^prepared\/[a-z-]+\/slices\//.test(file));
  const receipt = parse(await json('prepared/delivery.json'), receiptSchema);
  const restored = new Map<string, { sha256: string; bytes: number }>(receipt.lenses.flatMap(lens => lens.textures.map(texture => [`prepared/${texture.path}`, texture] as const)));
  assert.ok(promoted.length > 0);
  assert.equal(restored.size, promoted.length, 'The replay regenerates exactly the promoted slice set.');
  for (const [file, expected] of promoted) {
    assert.equal(restored.get(file)?.sha256, expected.sha256, file);
    assert.equal(restored.get(file)?.bytes, expected.bytes, file);
  }

  const envelope = parse(await json(descriptor.prepared.url), object({ data: jsonValue }));
  const bank = validatePreparedVolumeLenses(envelope.data);
  const recipe = parse(await json('source/lenses.json'), recipeSchema);
  assert.deepEqual(bank.lenses.map(lens => lens.id), recipe.lenses.map(lens => lens.imageId));
  assert.equal(bank.defaultLens, recipe.defaultLens);
  const evidence = parse(await json('source/lens-settings-evidence.json'), object({ receiptSha256: string, lenses: jsonValue }));
  assert.equal(recipe.settingsReceiptSha256, evidence.receiptSha256);
  assert.equal(hash(JSON.stringify(evidence.lenses, null, 2) + '\n'), evidence.receiptSha256, 'The settings receipt covers its own lens records.');
  // The simulation's observer frame, cut to the fitted model's own box.
  const inputs = parse(JSON.parse(inputsBytes.toString('utf8')), object({ geometry: object({ physicalBoundsKpc: jsonValue }),
    lenses: array(object({ imageId: string, toneCurve: jsonValue })) }));
  const density = parseObjectDescriptor(JSON.parse(await readFile(new URL('../../labs/nebula/models/lmc/full-density/object.json', import.meta.url), 'utf8')));
  const { boundsUnits, ...frame } = parse(descriptor.properties.frame, dictionary(jsonValue));
  const { boundsUnits: densityBounds, ...densityFrame } = parse(density.properties.volume, dictionary(jsonValue));
  assert.ok(densityBounds);
  assert.deepEqual(frame, densityFrame);
  assert.deepEqual(boundsUnits, inputs.geometry.physicalBoundsKpc);
  let geometry: unknown, stars: unknown, alphas: string[] | undefined;
  const materials: string[] = [];
  for (const lens of bank.lenses) {
    const selected = recipe.lenses.find(row => row.imageId === lens.id);
    assert.ok(selected);
    const result = parse(await json(`source/lenses/${lens.id}/result.json`), object({ resultId: string, subject: object({ sourcePageUrl: string }) }));
    const sourceStars = parse(await json(`source/lenses/${lens.id}/catalogue-stars.json`), starSchema);
    assert.equal(result.resultId, selected.resultId);
    assert.equal(lens.sourceUrl, result.subject.sourcePageUrl);
    assert.deepEqual(lens.brightness, selected.brightness);
    assert.equal(lens.stars.points.length, 1042);
    assert.deepEqual(lens.stars.points.map(point => [point.id, point.positionUnits]), sourceStars.stars.map(point => [point.id, point.positionUnits]));
    // The delivered tone curve is the one the accepted lens was baked with.
    const provenance = parse(await json(`source/lenses/${lens.id}/provenance.json`), object({ finiteMaterial: object({ toneCurve: jsonValue }) }));
    assert.deepEqual(inputs.lenses.find(row => row.imageId === lens.id)?.toneCurve, provenance.finiteMaterial.toneCurve);
    const nextGeometry = lens.volume.stacks.map(stack => ({ ...stack, leaves: stack.leaves.map(({ texturePath, style, ...leaf }) => leaf) }));
    assert.equal(nextGeometry.reduce((n, stack) => n + stack.leaves.length, 0), 242);
    assert.equal(lens.volume.resources.length, 3, 'A lens loads three axis atlases.');
    const nextAlphas: string[] = [], colors: string[] = [];
    for (const resource of lens.volume.resources) {
      const image = await sharp(await bytes(`prepared/${resource.path}`)).ensureAlpha().raw().toBuffer();
      const alpha = Buffer.alloc(image.length / 4);
      for (let index = 0; index < alpha.length; index++) alpha[index] = image[index * 4 + 3];
      nextAlphas.push(hash(alpha)); colors.push(hash(image));
    }
    if (geometry) {
      assert.deepEqual(nextGeometry, geometry, 'Image choice must not change the emission geometry');
      assert.deepEqual(nextAlphas, alphas, 'Image choice must not change the shared opacity');
      assert.deepEqual(lens.stars, stars, 'Image choice must not move or recolor catalogue stars');
    } else { geometry = nextGeometry; alphas = nextAlphas; stars = lens.stars; }
    materials.push(hash(JSON.stringify(colors)));
  }
  assert.equal(new Set(materials).size, 3, 'Each lens must use its own image material');
});
