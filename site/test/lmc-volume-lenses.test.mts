import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';
import { parseObjectDescriptor } from '@cssearth/objects';
import { validatePreparedVolumeLenses } from '../../src/renderers/css/dist/universe.js';
import { parse, object, array, dictionary, number, string, tuple, json as jsonValue } from '../../tools/objects/material-composition/data-schema.mts';
const pin = object({ sha256: string, bytes: number });
const brightness = object({ overall: number, x: number, y: number, z: number });
const recipeSchema = object({ defaultLens: string, settingsReceiptSha256: string,
  lenses: array(object({ imageId: string, resultId: string, brightness })) });
const starSchema = object({ stars: array(object({ id: string, positionUnits: tuple(number, number, number) })) });

const root = new URL('../../src/objects/lmc/', import.meta.url);
const bytes = (path: string) => readFile(new URL(path, root));
const json = async (path: string): Promise<unknown> => JSON.parse((await bytes(path)).toString('utf8'));
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

test('promoted LMC lenses close over pinned pixels, one density geometry and one catalogue', async () => {
  const descriptor = parseObjectDescriptor(await json('object.json'));
  assert.ok(descriptor.prepared);
  const preparation = parse(descriptor.properties.preparation, object({ source: string, sha256: string }));
  assert.equal(descriptor.type, 'volume-lens-bank');
  const manifest = parse(await json('source/lens-manifest.json'), object({ outputs: dictionary(pin) }));
  for (const [path, pin] of Object.entries(manifest.outputs)) {
    const content = await bytes(path);
    assert.equal(hash(content), pin.sha256, path);
    assert.equal(content.length, pin.bytes, path);
  }
  assert.equal(hash(await bytes(descriptor.prepared.url)), descriptor.prepared.sha256);
  assert.equal(hash(await bytes(preparation.source)), preparation.sha256);
  const envelope = parse(await json(descriptor.prepared.url), object({ data: jsonValue }));
  const bank = validatePreparedVolumeLenses(envelope.data);
  const recipe = parse(await json(preparation.source), recipeSchema);
  assert.deepEqual(bank.lenses.map(lens => lens.id), recipe.lenses.map(lens => lens.imageId));
  assert.equal(bank.defaultLens, recipe.defaultLens);
  const evidence = parse(await json('source/lens-settings-evidence.json'), object({ receiptSha256: string }));
  assert.equal(recipe.settingsReceiptSha256, evidence.receiptSha256);
  const density = parseObjectDescriptor(JSON.parse(await readFile(new URL('../../labs/nebula/models/lmc/full-density/object.json', import.meta.url), 'utf8')));
  assert.deepEqual(descriptor.properties.frame, density.properties.volume);
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
    assert.equal(lens.stars.points.length, 943);
    assert.deepEqual(lens.stars.points.map(point => [point.id, point.positionUnits]), sourceStars.stars.map(point => [point.id, point.positionUnits]));
    const nextGeometry = lens.volume.stacks.map(stack => ({ ...stack, leaves: stack.leaves.map(({ texturePath, ...leaf }) => leaf) }));
    assert.equal(nextGeometry.reduce((n, stack) => n + stack.leaves.length, 0), 144);
    const nextAlphas: string[] = [], colors: string[] = [];
    for (const resource of lens.volume.resources) {
      const image = await sharp(await bytes(`prepared/${resource.path}`)).ensureAlpha().raw().toBuffer();
      const alpha = Buffer.alloc(image.length / 4);
      for (let index = 0; index < alpha.length; index++) alpha[index] = image[index * 4 + 3];
      nextAlphas.push(hash(alpha)); colors.push(hash(image));
    }
    if (geometry) {
      assert.deepEqual(nextGeometry, geometry, 'Image choice must not change the density geometry');
      assert.deepEqual(nextAlphas, alphas, 'Image choice must not change the density alpha');
      assert.deepEqual(lens.stars, stars, 'Image choice must not move or recolor catalogue stars');
    } else { geometry = nextGeometry; alphas = nextAlphas; stars = lens.stars; }
    materials.push(hash(JSON.stringify(colors)));
  }
  assert.equal(new Set(materials).size, 3, 'Each candidate must use its own image material');
});
