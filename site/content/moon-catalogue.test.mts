import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import moonCatalogues from '../source/moon-catalogues.json' with { type: 'json' };
import { sourceArray, sourceId, sourceObject, sourceText, sourceUnique } from '@cssearth/objects/sources';
import { catalogueMoons, parseMoonCatalogue, readMoonCatalogue } from './moon-catalogue.mts';
import ts from 'typescript';

// The pre-extraction reader, retained only as an independent parity oracle.
function oldParseMoonCatalogue(input: unknown) {
  const catalogue = sourceObject(input);
  const moons = sourceArray(catalogue.moons, value => {
    const moon = sourceObject(value);
    return { id: sourceId(moon.id), name: sourceText(moon.name) };
  });
  sourceUnique(moons.map(moon => moon.id), 'moon identities');
  const count = catalogue.count;
  if (!Number.isInteger(count) || count !== moons.length) throw new TypeError('Moon catalogue count does not match its entries.');
  return { moons };
}

test('the whole source catalogue and validation errors match the old reader', () => {
  for (const system of moonCatalogues.systems) {
    assert.equal(JSON.stringify(parseMoonCatalogue(system)), JSON.stringify(oldParseMoonCatalogue(system)), system.id);
    assert.deepEqual(catalogueMoons(system.id), oldParseMoonCatalogue(system).moons);
    assert.strictEqual(catalogueMoons(system.id), readMoonCatalogue(system.id)?.moons);
    assert.strictEqual(readMoonCatalogue(system.id), readMoonCatalogue(system.id));
  }
  assert.equal(readMoonCatalogue('not-a-host'), undefined);
  assert.deepEqual(catalogueMoons('not-a-host'), []);
  for (const input of [null, {}, { count: 0, moons: [] }, { count: 1, moons: [] },
    { count: 1, moons: [{ id: 'Bad ID', name: 'Name' }] },
    { count: 2, moons: [{ id: 'moon', name: 'Moon' }, { id: 'moon', name: 'Moon' }] }]) {
    const outcome = (parse: typeof parseMoonCatalogue) => {
      try { return JSON.stringify(parse(input)); }
      catch (error) { assert.ok(error instanceof Error); return `${error.name}: ${error.message}`; }
    };
    assert.equal(outcome(parseMoonCatalogue), outcome(oldParseMoonCatalogue));
  }
});

/** Every module a file names, whether by import, re-export, dynamic import or inline import type, resolved against that file. */
function modulesNamedBy(file: URL): string[] {
  const named: string[] = [];
  const visit = (node: ts.Node): void => {
    const literal = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0]
      : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
    if (literal && ts.isStringLiteral(literal)) named.push(literal.text.startsWith('.') ? new URL(literal.text, file).pathname : literal.text);
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true));
  return named;
}

test('production children read the shared reader and never name preparation; preparation has one reader', () => {
  const children = modulesNamedBy(new URL('./object-children.mts', import.meta.url));
  const reader = new URL('./moon-catalogue.mts', import.meta.url).pathname;
  assert.ok(children.includes(reader), 'Children use the shared reader');
  assert.ok(!children.includes(new URL('../build/prepare/prepare-body-moons.mts', import.meta.url).pathname), 'Children never import preparation');
  const preparation = modulesNamedBy(new URL('../build/prepare/prepare-body-moons.mts', import.meta.url));
  assert.ok(preparation.includes(reader), 'Preparation reads the shared catalogue');
  assert.ok(!preparation.some(module => module.endsWith('/moon-catalogues.json') || module === '@cssearth/objects/sources'), 'Preparation must not re-parse a separate catalogue');
});
