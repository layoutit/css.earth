import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import type { SceneFramePresenter } from './scene-frame-presenter.mts';
import type { SceneFramePresenter as LegacySceneFramePresenter } from './scene-world.mts';
import type { SceneSession } from './scene-session.mts';

const source = (name: string) => ts.createSourceFile(name,
  readFileSync(new URL(name, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const imports = (name: string) => source(name).statements.filter(ts.isImportDeclaration);
const specifier = (declaration: ts.ImportDeclaration | ts.ExportDeclaration) =>
  declaration.moduleSpecifier && ts.isStringLiteral(declaration.moduleSpecifier) ? declaration.moduleSpecifier.text : null;

test('the production session reads its presenter contract without importing the world coordinator', () => {
  const declarations = imports('./scene-session.mts');
  assert.equal(declarations.some(declaration => specifier(declaration) === './scene-world.mts'), false);
  const contract = declarations.find(declaration => specifier(declaration) === './scene-frame-presenter.mts');
  assert.ok(contract?.importClause?.isTypeOnly);
  const names = contract.importClause.namedBindings;
  assert.ok(names && ts.isNamedImports(names));
  assert.ok(names.elements.some(element => element.name.text === 'SceneFramePresenter'));
});

test('the coordinator preserves the erased presenter export and both consumers share its exact type', () => {
  const declaration = source('./scene-world.mts').statements.filter(ts.isExportDeclaration)
    .find(entry => specifier(entry) === './scene-frame-presenter.mts');
  assert.ok(declaration?.isTypeOnly);
  assert.ok(declaration.exportClause && ts.isNamedExports(declaration.exportClause));
  assert.ok(declaration.exportClause.elements.some(element => element.name.text === 'SceneFramePresenter'));
  // These assignments are checked by typecheck:tests; they emit no runtime imports.
  const agrees: [SceneFramePresenter] extends [LegacySceneFramePresenter]
    ? [LegacySceneFramePresenter] extends [SceneFramePresenter]
      ? [NonNullable<SceneSession['framePresenter']>] extends [SceneFramePresenter] ? true : false
      : false : false = true;
  assert.equal(agrees, true);
});

test('the extracted contract contains only erased imports and type declarations', () => {
  for (const statement of source('./scene-frame-presenter.mts').statements) {
    assert.ok(ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)
      || (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly));
  }
});
