import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';
import * as core from '@cssearth/core';
import { legacyPolicies } from './fixtures/legacy-validation.fixture.ts';

class Box { value = 1; }
const corpus: unknown[] = [undefined, null, false, true, NaN, Infinity, -Infinity, -0, 0, -1, 0.5, 1,
  Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e100, '', ' ', '\t\n', '0', '12', ' x ',
  {}, new Box(), Object.create(null), [], [1, 2], [1, 2, 3], [1, 2, 3, 4], [1, NaN, 3],
  new Array(3), { 0: 1, 1: 2, 2: 3, length: 3 }, new Float32Array([1, 2, 3])];
type Reader = (value: unknown, label: string) => unknown;
function evaluate(code: string, name: string, bindings: Record<string, unknown>): Reader {
  const js = ts.transpile(code, { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.None });
  const value: unknown = new Function(...Object.keys(bindings), `return (() => { ${js}\nreturn ${name}; })();`)(...Object.values(bindings));
  if (typeof value !== 'function') throw new TypeError(`Missing helper ${name}`);
  return (input, label) => value(input, label);
}
function outcome(reader: Reader, value: unknown): unknown {
  try { return { accepted: true, value: reader(value, 'D3 value') }; }
  catch (error) {
    if (!(error instanceof Error)) throw error;
    return { accepted: false, errorClass: error.name };
  }
}
const declaration = (code: string) => /^(?:export\s+)?function\b/.test(code)
  ? code.replace(/^export\s+/, '') : `const ${code};`;

for (const path of new Set(legacyPolicies.map(row => row.path))) {
  const originals = legacyPolicies.filter(row => row.path === path);
  const source = readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const bindings: Record<string, unknown> = { ...core, assert, finite: core.requireFiniteNumber };
  const current = new Map<string, string>();
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === '@cssearth/core') {
      const named = node.importClause?.namedBindings;
      if (named && ts.isNamedImports(named)) for (const entry of named.elements) {
        const key = (entry.propertyName ?? entry.name).text;
        if (!(key in core)) throw new TypeError(`Missing core export ${key}`);
        bindings[entry.name.text] = Reflect.get(core, key);
      }
    }
    if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name)) {
      if (!current.has(node.name.text) && originals.some(row => row.name === node.name!.getText(tree))) current.set(node.name.text, declaration(node.getText(tree)));
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  for (const row of originals) test(`${path}: ${row.name} preserves acceptance, returned values and error class`, () => {
    const old = evaluate(originals.map(item => declaration(item.code)).join('\n'), row.name, bindings);
    assert.equal(current.size, originals.length, 'Every migrated helper must remain present');
    const next = evaluate([...current.values()].join('\n'), row.name, bindings);
    for (const value of corpus) assert.deepEqual(outcome(next, value), outcome(old, value));
  });
}
