import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRuntimeSource, resolveRuntimeSource } from './runtime-source-graph.mts';

test('runtime closure excludes type-only dependencies and retains executable imports', () => {
  const ast = parseRuntimeSource(`
    import type { Contract } from '../types.mts';
    import { type OnlyType } from '../only-type.mts';
    import { type Type, value } from '../runtime.mts';
    export { type Exported } from '../exported-type.mts';
    export interface Shape { value: number }
    declare const ambient: string;
    export const result = value;
  `, 'owner.mts');
  assert.deepEqual(ast.body.map(node => node.type), ['ImportDeclaration', 'ExportNamedDeclaration']);
  const [statement] = ast.body;
  assert.ok(statement && statement.type === 'ImportDeclaration');
  assert.equal(statement.source.value, './runtime.mts');
  assert.deepEqual(statement.specifiers.map(node => node.local.name), ['value']);
});

test('assertion wrappers retain executable calls and their original source offsets', () => {
  const source = 'export const value = (unsafeOwner() as unknown)! satisfies unknown;';
  const ast = parseRuntimeSource(source, 'owner.mts');
  const [statement] = ast.body;
  assert.ok(statement && statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'VariableDeclaration');
  const [declaration] = statement.declaration.declarations;
  assert.ok(declaration?.init);
  const init = declaration.init;
  assert.equal(init.type, 'CallExpression');
  assert.ok(init.callee.type === 'Identifier');
  assert.equal(init.callee.name, 'unsafeOwner');
  assert.ok(init.range);
  assert.equal(source.slice(...init.range), 'unsafeOwner()');
});

test('build source resolution follows typed entries and rejects unbound config calls', async () => {
  const configPath = '/project/renderer/tsup.config.ts';
  const entryPath = '/project/renderer/entry.mts';
  let config = "import { defineConfig } from 'tsup'; export default defineConfig({entry: {platform: 'entry.mts'}, outDir: 'dist'});";
  const source = async (path: string) => {
    if (path === configPath) return config;
    if (path === entryPath) return 'export const answer = 42;';
    throw new Error(`Unexpected source: ${path}`);
  };
  const context = {root: '/project', source};
  assert.equal(await resolveRuntimeSource('./renderer/dist/platform.js', '/project/app.mts', context), entryPath);
  config = "export default unbound.config({entry: {platform: 'entry.mts'}, outDir: 'dist'});";
  await assert.rejects(resolveRuntimeSource('./renderer/dist/platform.js', '/project/app.mts', context), /concrete source entry/);
});

test('nested published entries remain source-bound and cannot escape the output directory', async () => {
  let entry = 'platform/camera';
  const configPath = '/project/renderer/tsup.config.ts';
  const sourcePath = '/project/renderer/camera.ts';
  const context = {root: '/project', source: async (path: string) => {
    if (path === configPath) return `export default {entry: {${JSON.stringify(entry)}: './camera.ts'}};`;
    if (path === sourcePath) return 'export const camera = 1;';
    throw new Error(`Unexpected source: ${path}`);
  }};
  assert.equal(await resolveRuntimeSource('./renderer/dist/platform/camera.js', '/project/app.mts', context), sourcePath);
  for (entry of ['../camera', '/camera', 'platform//camera', 'platform/../camera', 'platform/']) {
    await assert.rejects(resolveRuntimeSource('./renderer/dist/platform/camera.js', '/project/app.mts', context), /not source-bound/);
  }
});
