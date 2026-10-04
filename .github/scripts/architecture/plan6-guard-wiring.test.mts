import assert from 'node:assert/strict';
import test from 'node:test';
import { LAYER_RULES, evaluateRules } from './rules.mts';
import { REPOSITORY_RULES } from './repository-rules.mts';
import { checkSiteBuildFormatReaders } from './site-build-format-readers.mts';
import { checkPreparationWithoutRenderer } from './preparation-without-renderer.mts';
import type { ImportGraph } from './graph.mts';

test('Plan 6 format reader and preparation renderer checks remain mandatory repository gates', () => {
  for (const [id, check] of [
    ['site-build-format-readers', checkSiteBuildFormatReaders],
    ['preparation-without-renderer', checkPreparationWithoutRenderer],
  ] as const) {
    const rules = REPOSITORY_RULES.filter(rule => rule.id === id);
    assert.equal(rules.length, 1, `${id} must be registered exactly once`);
    assert.equal(rules[0]!.check, check, `${id} must execute its checker`);
  }
});

test('both authoring trees remain leaves for production, type imports and outside tests', () => {
  const rules = LAYER_RULES.filter(rule => rule.id === 'authoring-is-leaf');
  assert.equal(rules.length, 1);
  for (const owner of ['packages/bake', 'packages/telescope-cli']) {
    const target = `${owner}/authoring/body/author.mts`;
    const graph: ImportGraph = { files: new Map(), edges: [
      { from: `${owner}/src/consumer.ts`, to: target, test: false, typeOnly: false, symbols: [] },
      { from: `${owner}/src/consumer.test.ts`, to: target, test: true, typeOnly: true, symbols: [] },
      { from: `${owner}/authoring/body/author.test.mts`, to: target, test: true, typeOnly: false, symbols: [] },
    ] };
    assert.deepEqual(evaluateRules(graph, rules).get('authoring-is-leaf'), [
      { from: `${owner}/src/consumer.test.ts`, to: target },
      { from: `${owner}/src/consumer.ts`, to: target },
    ], `${owner}: only authoring-owned tests may import the leaf`);
  }
});

import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('system orbit preparation imports its parser from the objects owner', () => {
  const path = 'packages/bake/src/objects/charts/system-orbits.ts';
  const source = readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const imports = tree.statements.filter(ts.isImportDeclaration).flatMap(declaration => {
    const bindings = declaration.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) return [];
    return bindings.elements.filter(binding => binding.name.text === 'parseSystemOrbits')
      .map(binding => ({ owner: declaration.moduleSpecifier.getText(tree), original: (binding.propertyName ?? binding.name).text,
        typeOnly: !!binding.isTypeOnly || !!declaration.importClause?.isTypeOnly }));
  });
  assert.deepEqual(imports, [{ owner: "'@cssearth/objects'", original: 'parseSystemOrbits', typeOnly: false }]);
});

import { globSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';

test('the real reader ledger protects generated map-sphere data without tracked JSON', () => {
  const repository = resolve(import.meta.dirname, '../../..');
  const root = mkdtempSync(resolve(tmpdir(), 'real-reader-ledger-'));
  const constants: string[] = [];
  for (const path of globSync('packages/objects/src/**/*.ts', { cwd: repository })) {
    if (path.includes('.test.')) continue;
    const source = readFileSync(resolve(repository, path), 'utf8');
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
        && ts.isStringLiteralLike(node.initializer) && /^cssearth-[a-z0-9-]+@[0-9]+$/u.test(node.initializer.text))
        constants.push(`export const ${node.name.text} = ${JSON.stringify(node.initializer.text)};`);
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  const files = ['packages/objects/src/constant-fixture.ts',
    'packages/objects/src/prepared-data/format-reader-ledger.ts', 'site/build/read.mts'];
  try {
    for (const file of files) mkdirSync(dirname(resolve(root, file)), { recursive: true });
    writeFileSync(resolve(root, files[0]!), constants.join('\n'));
    writeFileSync(resolve(root, files[1]!), readFileSync(resolve(repository, files[1]!), 'utf8'));
    const expression = "JSON.parse(await readFile('prepared/datasets.json', 'utf8'))";
    writeFileSync(resolve(root, files[2]!), `const value = ${expression};`);
    assert.equal(checkSiteBuildFormatReaders(root, files).length, 1, 'unadmitted generated datasets must fail');
    writeFileSync(resolve(root, files[2]!), `import { readMapSphereDatasetPreviews } from '@cssearth/objects'; readMapSphereDatasetPreviews(${expression});`);
    assert.deepEqual(checkSiteBuildFormatReaders(root, files), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
