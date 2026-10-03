import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRasterRecipe } from './validation.ts';
import { readBodyMapProduct } from '../objects/layers/observation/body-maps/body-map-product.ts';
import { requireRecord } from '@cssearth/core';
import { bodyMapFixture, rasterRecipeFixture } from '../../../objects/src/prepared-data/raster-body-fixtures.ts';
const root = resolve(import.meta.dirname, '../../../..');
const outcome = (parse: (value: unknown) => unknown, value: unknown): unknown => {
  const input = structuredClone(value);
  try { return { value: parse(input), mutatedInput: input }; }
  catch (error) { if (!(error instanceof Error)) throw error; return { name: error.name, message: error.message, mutatedInput: input }; }
};
async function historicalParser(file: string, name: string, directory: string): Promise<(value: unknown) => unknown> {
  let text = execFileSync('git', ['show', `origin/main:${file}`], { cwd: root, encoding: 'utf8' });
  // Point unchanged scientific operations at their owners; moved nested parsers have their own objects contract tests.
  text = text.replace(/^import \{ type LightingRecipe, type RasterRecipe \} from '.\/config.ts';\n/mu, '').replaceAll("'./lighting-banks.ts'", JSON.stringify(pathToFileURL(resolve(root, 'packages/bake/src/raster/lighting-banks.ts')).href))
    .replaceAll("'../photometry/index.ts'", "'@cssearth/objects'")
    .replaceAll("'./resolution-evidence.ts'", "'@cssearth/objects'")
    .replaceAll("'./body-map.ts'", JSON.stringify(pathToFileURL(resolve(root, 'packages/bake/src/objects/layers/observation/body-maps/body-map.ts')).href));
  const target = resolve(directory, `${name}.mts`);
  await writeFile(target, text);
  const module: unknown = await import(pathToFileURL(target).href);
  const parser = requireRecord(module)[name];
  if (typeof parser !== 'function') throw new TypeError(`Historical ${name} was not loaded.`);
  return value => parser(value);
}
test('raster and body readers retain origin/main admission and first diagnostics', async () => {
  await mkdir(resolve(root, 'output/untangle6-p4d'), { recursive: true });
  const directory = await mkdtemp(resolve(root, 'output/untangle6-p4d/origin-'));
  try {
    const raster = await historicalParser('packages/bake/src/raster/validation.ts', 'parseRasterRecipe', directory);
    const body = await historicalParser('packages/bake/src/objects/layers/observation/body-maps/body-map-product.ts', 'parseBodyMapProduct', directory);
    const paths = execFileSync('git', ['ls-files', '--', 'src/objects/*/source/preparation/raster.json'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    assert.ok(paths.length > 20, 'Compare a substantial set of authored raster recipes.');
    for (const file of paths) {
      const value: unknown = JSON.parse(await readFile(resolve(root, file), 'utf8'));
      assert.deepEqual(outcome(readRasterRecipe, value), outcome(raster, value), file);
    }
    const r = rasterRecipeFixture(), b = bodyMapFixture();
    const rasterCases: unknown[] = [null, [], {}, r, { ...r, schema: 'wrong' }, { ...r, sourceWidth: 0 }, { ...r, sourceWidth: 0, lighting: { bank: 'bad' } },
      { ...r, lighting: { bank: 'bad' } }, { ...r, lighting: { bank: 'sphere', frameSize: 512 } }, { ...r, surfaces: [] },
      { ...r, lighting: { bank: 'sphere', presentationSize: 512, defaultFrame: 0, bankSchema: 'bank', billboardSchema: 'bank', metadata: {} } },
      { ...r, thumbnail: { size: 8, quality: 1 } }, { ...r, surfaces: [{ ...r.surfaces[0], source: '../escape' }] }];
    const bodyCases: unknown[] = [null, [], {}, b, { ...b, observations: [] }, { ...b, grid: { ...b.grid, width: -1.5 } },
      { ...b, mask: { ...b.mask, missing: 'other' } }, { ...b, observations: [{ ...b.observations[0], rangeKm: -1 }] },
      { ...b, observations: [{ ...b.observations[0], startIso: '2000-01-01T00:00:00Z' }] },
      ...['time-invariant', 'same-epoch-only', 'mosaic-of-snapshots'].flatMap(rule => [0.5, 2].map(factor => ({ ...b,
        observations: [b.observations[0], { ...b.observations[0], midTimeJd: 2451547, rangeKm: 3000 }],
        combination: { time: { rule, withinDays: 1 }, resolution: { rule: 'within-factor', factor } } })))];
    for (const value of rasterCases) assert.deepEqual(outcome(readRasterRecipe, value), outcome(raster, value));
    for (const value of bodyCases) assert.deepEqual(outcome(readBodyMapProduct, value), outcome(body, value));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
