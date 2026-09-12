import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { loadPublishedCompiler, readPublishedCompiler } from './compiler-published';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const recipePath = 'labs/nebula/models/example/compiler.json';
const recipe = { schema: 'cssearth-nebula-compiler@1', id: 'example', label: 'Example',
  observationRecipe: 'labs/nebula/models/example/observations.json',
  observationCatalogue: '.local/nebula-lab/observations/example/observations.json',
  structureRecipe: 'labs/nebula/models/example/observation-structures.json',
  structureCatalogue: '.local/nebula-lab/observations/example/structures/catalogue.json',
  defaultSourceId: 'optical', maximumStars: 100, interpretation: 'Image-only depth.' };
const files = new Map([[recipePath, JSON.stringify(recipe)], ...[recipe.observationRecipe, recipe.observationCatalogue,
  recipe.structureRecipe, recipe.structureCatalogue].map(path => [path, '{}'] as [string, string])]);
const publication = { schema: 'cssearth-nebula-compiler-published@1', recipePath,
  inputs: [...files].map(([path, bytes]) => ({ path, sha256: digest(bytes) })),
  result: { path: `.local/nebula-lab/compiler/${'1'.repeat(64)}/result.json`, sha256: digest('{}') } };
const pointer = '.local/nebula-lab/compiler-published/example.json';

test('published compiler receipt requires a unique complete configured input set', async () => {
  assert.equal(readPublishedCompiler(publication, recipePath).inputs.length, 5);
  assert.throws(() => readPublishedCompiler(publication, 'labs/nebula/models/other/compiler.json'), /publication/);
  assert.throws(() => readPublishedCompiler({ ...publication, inputs: [...publication.inputs, publication.inputs[0]] }, recipePath), /ownership/);
  const missing = { ...publication, inputs: publication.inputs.map(item => item.path === recipe.structureRecipe ? { ...item, path: 'labs/nebula/models/example/unrelated.json' } : item) };
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, async path => new Response(path === pointer ? JSON.stringify(missing) : files.get(path) ?? '{}')), /every configured source/);
});

test('changed current input bytes prevent displaying the old cloud', async () => {
  let resultFetched = false;
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, async path => {
    if (path === pointer) return Response.json(publication);
    if (path === publication.result.path) resultFetched = true;
    return new Response(path === recipe.observationCatalogue ? '{"changed":true}' : files.get(path) ?? '{}');
  }), /sources changed/);
  assert.equal(resultFetched, false);
});

test('absent CLI publication is an empty workspace, not an implicit processing request', async () => {
  let reads = 0;
  assert.equal(await loadPublishedCompiler(pointer, recipePath, async () => { reads++; return new Response(null, { status: 404 }); }), null);
  assert.equal(reads, 1);
});
