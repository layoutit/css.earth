import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import type { WorldHandoff, NavigationHistory, NavigationIntent, SceneView, SelectionTarget } from './navigation-types.mts';
import type { WorldHandoff as OldWorldHandoff } from '../prepared-world-navigation.mts';
import type { NavigationHistory as OldNavigationHistory, NavigationIntent as OldNavigationIntent } from './navigation-request.mts';
import type { SceneView as OldSceneView, SelectionTarget as OldSelectionTarget } from '../scene/scene-selection.mts';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const compatibility: [Equal<WorldHandoff, OldWorldHandoff>, Equal<NavigationHistory, OldNavigationHistory>,
  Equal<NavigationIntent, OldNavigationIntent>, Equal<SceneView, OldSceneView>, Equal<SelectionTarget, OldSelectionTarget>] = [true, true, true, true, true];
const source = (path: string) => ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function typeImport(path: string, target: string, names: string[]) {
  const declarations = source(path).statements.filter(ts.isImportDeclaration);
  const imported = declarations.find(item => ts.isStringLiteral(item.moduleSpecifier) && item.moduleSpecifier.text === target);
  assert.ok(imported?.importClause?.isTypeOnly, `${path} imports ${target} only as types`);
  const bindings = imported.importClause.namedBindings;
  assert.ok(bindings && ts.isNamedImports(bindings));
  for (const name of names) assert.ok(bindings.elements.some(item => (item.propertyName ?? item.name).text === name), `${path} imports ${name}`);
}

function typeReexport(path: string, target: string, names: string[]) {
  const declarations = source(path).statements.filter(ts.isExportDeclaration);
  const exported = declarations.find(item => item.moduleSpecifier && ts.isStringLiteral(item.moduleSpecifier) && item.moduleSpecifier.text === target);
  assert.ok(exported?.isTypeOnly, `${path} keeps erased exports from ${target}`);
  assert.ok(exported.exportClause && ts.isNamedExports(exported.exportClause));
  for (const name of names) assert.ok(exported.exportClause.elements.some(item => item.name.text === name), `${path} re-exports ${name}`);
}

test('production history transport depends on navigation contracts, never request orchestration', () => {
  const declarations = source('./navigation-history.mts').statements.filter(ts.isImportDeclaration);
  assert.ok(declarations.every(item => !ts.isStringLiteral(item.moduleSpecifier) || !item.moduleSpecifier.text.includes('navigation-request')));
  typeImport('./navigation-history.mts', './navigation-types.mts', ['NavigationHistory', 'NavigationIntent']);
  typeImport('./prepared-arrival.mts', './navigation-types.mts', ['WorldHandoff']);
  typeImport('./navigation-request.mts', './navigation-types.mts', ['NavigationHistory', 'NavigationIntent', 'SelectionTarget']);
});

test('old contract exports remain compatible and type-only', () => {
  assert.deepEqual(compatibility, [true, true, true, true, true]);
  typeReexport('../prepared-world-navigation.mts', './navigation/navigation-types.mts', ['WorldHandoff']);
  typeReexport('./navigation-request.mts', './navigation-types.mts', ['NavigationHistory', 'NavigationIntent']);
});

test('navigation contracts erase without runtime dependencies', () => {
  const contract = source('./navigation-types.mts');
  assert.ok(contract.statements.every(item => ts.isTypeAliasDeclaration(item) || ts.isInterfaceDeclaration(item)
    || ts.isImportDeclaration(item) && item.importClause?.isTypeOnly));
  const emitted = ts.transpileModule(contract.text, { compilerOptions: { module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true } });
  assert.equal(emitted.outputText.trim(), 'export {};');
});
