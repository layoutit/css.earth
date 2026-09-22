import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { loadObservationDiffuse, readObservationStructureRecipe } from './observation-structure-source.ts';
import type { ObservationRecipe } from '../../../features/observations/recipe.ts';
import type { Observation } from '../../../features/observations/models/model.ts';

test('structure input cannot silently rerun star removal when a native receipt is absent', async () => {
  const base = resolve('.local/nebula-lab/observations'); await mkdir(base, { recursive: true });
  const directory = await mkdtemp(resolve(base, 'structure-cache-test-'));
  const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  try {
    await mkdir(resolve(directory, 'sources'));
    const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#333333' } }).tiff().toBuffer();
    await writeFile(resolve(directory, 'sources/test.tif'), bytes);
    const model = Buffer.from('fake model: no inference is permitted'), modelPath = resolve(directory, 'model.pb'); await writeFile(modelPath, model);
    const source = { id: 'test', label: 'Test', width: 8, height: 8, url: 'https://example.test/image.tif', page: 'https://example.test/',
      sha256: sha(bytes), credit: 'Synthetic test', bands: 'RGB', termsUrl: 'https://example.test/', fieldArcminutes: [1, 1] as [number, number],
      centerIcrsDegrees: [20, 20] as [number, number], northRightDegrees: 0 };
    const recipe: ObservationRecipe = { schema: 'cssearth-nebula-observation-recipe@1', id: basename(directory), referenceId: 'test',
      frame: { width: 1024, height: 1024, fieldArcminutes: [60, 60], centerIcrsDegrees: [20, 20], northUp: true }, images: [source],
      nativeRemoval: { model: { path: modelPath } } };
    const image: Observation = { id: 'test', label: 'Test', source, layers: { original: { path: 'source.tif', width: 8, height: 8 } },
      imageToFrame: [1, 0, 0, 1, 0, 0], registration: { status: 'verified', matchedStars: 50, rmsPixels: .1, maxResidualPixels: .3, matches: [] } };
    await assert.rejects(loadObservationDiffuse(recipe, image, 64), /cannot start NOX/);
    await assert.rejects(stat(resolve(directory, 'test/native-nox/request.json')), { code: 'ENOENT' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('structure recipe bounds the analysis without changing source footprint', () => {
  const value = { schema: 'cssearth-observation-structure-recipe@1', observationRecipe: 'input.json', observationCatalogue: 'observations.json', workingWidth: 768,
    wavelets: { scales: 6, significanceSigma: 2, compactMaxScale: 1, elongatedAxisRatio: 2.5, minRegionPixels: 5, connectivity: 8 } };
  assert.equal(readObservationStructureRecipe(value).workingWidth, 768);
  assert.throws(() => readObservationStructureRecipe({ ...value, workingWidth: 5000 }), /unbounded/);
});
