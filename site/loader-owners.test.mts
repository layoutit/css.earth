import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import test, { mock } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { parseHTML } from 'linkedom';
import { queuedImport } from './import-queue.mts';

mock.module(new URL('./scene/scene-registry.mts', import.meta.url).href, { namedExports: { marker: 'registry' } });
mock.module(new URL('./packaged-object-runtime.mts', import.meta.url).href, { namedExports: { marker: 'runtime' } });
const scene = await import('./scene-imports.mts');
const world = await import('./world-imports.mts');
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const syntax = (path: string) => ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

test('scene and world loaders share the production queue and settle in declared request order', async () => {
  let release!: () => void;
  const gate = queuedImport(() => new Promise<void>(resolve => { release = resolve; }));
  const held = gate();
  const settled: string[] = [];
  const loads = [scene.importPackagedObjectRuntime, world.importApplicationWorld, scene.importSceneRegistry] as const;
  const pending = loads.map((load, index) => {
    const first = load();
    assert.equal(load(), first);
    return first.then(() => { settled.push(['runtime', 'world', 'registry'][index]!); });
  });
  await setImmediate();
  assert.deepEqual(settled, [], 'neither owner can bypass the shared chain');
  release();
  await Promise.all([held, ...pending]);
  assert.deepEqual(settled, ['runtime', 'world', 'registry']);
});

test('loader owners contain only literal import thunks through the same queue; startup exports only the router', () => {
  for (const [path, names] of [
    ['./scene-imports.mts', ['importSceneRegistry', 'importPackagedObjectRuntime']],
    ['./world-imports.mts', ['importApplicationWorld']],
    ['./shared-imports.mts', ['importSceneRouter']],
  ] as const) {
    const statements = syntax(path).statements;
    assert.equal(statements.length, names.length + 1);
    const dependency = statements[0];
    assert.ok(dependency && ts.isImportDeclaration(dependency));
    assert.equal(dependency.moduleSpecifier.getText(), "'./import-queue.mts'");
    assert.equal(dependency.importClause?.namedBindings?.getText(), '{ queuedImport }');
    assert.deepEqual(statements.slice(1).map(statement => {
      assert.ok(ts.isVariableStatement(statement));
      assert.equal(statement.modifiers?.map(modifier => modifier.getText()).join(' '), 'export');
      assert.equal(statement.declarationList.declarations.length, 1);
      const declaration = statement.declarationList.declarations[0]!;
      const initializer = declaration.initializer;
      assert.ok(initializer && ts.isCallExpression(initializer));
      assert.equal(initializer.expression.getText(), 'queuedImport');
      assert.equal(initializer.arguments.length, 1);
      const thunk = initializer.arguments[0]!;
      assert.ok(ts.isArrowFunction(thunk));
      assert.equal(thunk.parameters.length, 0);
      assert.equal(thunk.modifiers, undefined, 'no async initializer or nested queue wait');
      assert.ok(ts.isCallExpression(thunk.body));
      assert.equal(thunk.body.expression.kind, ts.SyntaxKind.ImportKeyword);
      assert.equal(thunk.body.arguments.length, 1);
      assert.ok(ts.isStringLiteral(thunk.body.arguments[0]!));
      return declaration.name.getText();
    }), names);
  }
  assert.equal(syntax('./import-queue.mts').statements.filter(ts.isImportDeclaration).length, 0);
});

test('router registers the runtime at module evaluation before its unchanged autostart', () => {
  const statements = syntax('./scene/scene-router.mts').statements;
  const registration = statements.findIndex(statement => ts.isExpressionStatement(statement) &&
    statement.expression.getText() === 'registerDirectoryRuntimeLoader(importPackagedObjectRuntime)');
  const autostart = statements.findIndex(statement => ts.isIfStatement(statement) &&
    statement.expression.getText() === 'typeof document !== "undefined"');
  assert.ok(registration >= 0 && registration < autostart);
  assert.match(statements[autostart]!.getText(), /createSceneRouter\(\{ stage, objectId, persistentWorldContext \}\)/u);
});

test('the default layout failure path clears pending presentation after a queued router evaluation failure', async () => {
  const layout = source('./layouts/ObjectLayout.astro');
  const script = layout.match(/<script>\s*(import \{ bindNativeViewForms \}[\s\S]*?)<\/script>/u)?.[1];
  assert.ok(script);
  const { document, window } = parseHTML('<html data-shell-context="" data-body-pending=""><body><div class="startup-loading"></div><div class="explorer-navigation-progress"></div></body></html>');
  const calls: string[] = [];
  let attempts = 0;
  const importSceneRouter = queuedImport(async () => { attempts++; calls.push('router'); throw new Error('module evaluation failed'); });
  const execute = () => runInNewContext(script.replace(/^\s*import [^;]+;/gmu, ''), {
    document, window, bindNativeViewForms() { calls.push('forms'); }, startBodyCode() { calls.push('body'); },
    startViewCode() { calls.push('view'); }, loadStartupWorld: async () => { calls.push('summary'); }, importSceneRouter,
    console: { error(message: string, error: Error) { calls.push(message); assert.match(error.message, /module evaluation failed/u); } },
  });
  execute();
  await setImmediate();
  assert.equal(document.documentElement.dataset.ready, 'error');
  assert.equal(document.querySelector('.startup-loading'), null);
  assert.equal(document.querySelector('.explorer-navigation-progress')?.getAttribute('aria-hidden'), 'true');
  assert.equal('shellContext' in document.documentElement.dataset, false);
  assert.equal('bodyPending' in document.documentElement.dataset, false);
  assert.deepEqual(calls, ['forms', 'body', 'summary', 'router', 'The interactive scene could not load.']);
  execute(); await setImmediate();
  assert.equal(attempts, 2, 'a rejection clears pending sharing for the next router request');
});
