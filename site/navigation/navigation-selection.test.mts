import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { readNavigationSelection } from './navigation-request.mts';
import { selectionTargetFromUrl } from '../selection/scene-selection.mts';

/** Every module a file names by import, re-export or inline `import()` type, resolved against that file. */
function modulesNamedBy(file: URL): string[] {
  const named: string[] = [];
  const visit = (node: ts.Node): void => {
    const literal = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
      : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
    if (literal && ts.isStringLiteral(literal)) named.push(literal.text.startsWith('.') ? new URL(literal.text, file).pathname : literal.text);
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true));
  return named;
}

test('a navigation request reads the same selection as the registry for every kind of address, without importing the selection owner', () => {
  const addresses: [string, string][] = [
    ['https://css.earth/earth/', 'earth'], ['https://css.earth/earth-system/', 'earth'], ['https://css.earth/earth-system/?dataset=x', 'earth'],
    ['https://css.earth/jupiter-system/', 'jupiter'], ['https://css.earth/jupiter-system/?v=near', 'io'], ['https://css.earth/sun-system/', 'sun'], ['https://css.earth/mars/', 'mars'],
  ];
  assert.ok(addresses.some(([url, id]) => selectionTargetFromUrl(new URL(url), id).objectId !== id), 'a system address names the system, not the body');
  for (const [url, id] of addresses) assert.deepEqual(readNavigationSelection(new URL(url), id).subject, selectionTargetFromUrl(new URL(url), id), url);
  const named = modulesNamedBy(new URL('./navigation-request.mts', import.meta.url));
  assert.ok(!named.some(module => /\/scene\/scene-selection(?:\.mts)?$/u.test(module)), 'navigation requests must not import the selection owner');
});
