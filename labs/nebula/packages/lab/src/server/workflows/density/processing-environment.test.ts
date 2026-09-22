import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { readProcessingEnvironmentRecipe } from './processing-environment.ts';

const source = { schema: 'cssearth-nebula-bake@1', environment: { pythonVersions: ['3.11'], packages: ['numpy==1.26.4'] },
  removal: { model: { path: '.local/open-star-removal/model.pb', url: 'https://example.org/model.pb' } } };
test('processing setup reads the canonical package and NOX pins without object asset dependencies', async () => {
  const recipe = readProcessingEnvironmentRecipe(JSON.parse(await readFile('labs/nebula/models/lmc/bake.json', 'utf8')));
  assert.deepEqual(recipe.environment.pythonVersions, ['3.9', '3.10', '3.11', '3.12']);
  assert.ok(recipe.environment.packages.includes('tensorflow==2.16.2'));
  assert.deepEqual(readProcessingEnvironmentRecipe(source), { environment: source.environment, removal: source.removal });
});
test('processing setup rejects missing pins, unsupported Python and unpinned package specifications', () => {
  for (const model of [null, { ...source.removal.model, path: '.local/open-star-removal/../outside.pb' },
    { ...source.removal.model, url: 'http://example.org/model.pb' }])
    assert.throws(() => readProcessingEnvironmentRecipe({ ...source, removal: { model } }));
  for (const environment of [{ ...source.environment, pythonVersions: ['3.13'] }, { ...source.environment, packages: ['numpy>=1'] },
    { ...source.environment, packages: ['numpy==1.26.4', 'NumPy==1.26.3'] }, { ...source.environment, packages: ['--extra-index-url=https://example.org'] }])
    assert.throws(() => readProcessingEnvironmentRecipe({ ...source, environment }));
});
