import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';
import { runInNewContext } from 'node:vm';
import { requireRecord } from '@cssearth/core';
import { readObjectDescriptorRecord, parsePreparedObjectRuntime } from '@cssearth/objects';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { loadObjectTestDefinition } from '@cssearth/objects/node/contract';
import { prepareWorldNavigationDefinition } from './prepare-world-navigation.ts';
const test = sourceTest();
const root = process.cwd();
const ids = ['mercury', 'earth', 'moon', 'mars', 'jupiter', 'io', 'sun', 'ceres'];

// Writer audit: catalog writes catalogue modules, not source descriptors; interior fills
// delegates descriptor writes to repinObjectJson. Pinning receives the untouched source.
const sourceReaders = [
  ['site/build/prepare/authored/prepare-text.mts', 'readObjectDescriptorRecord'],
  ['site/build/prepare/authored/prepare-world-navigation.ts', 'readObjectDescriptorRecord'],
  ['site/build/prepare/authored/prepare-object-json.mts', 'readObjectDescriptorRecord'],
  ['site/build/prepare/authored/prepare-authored.ts', 'readObjectDescriptorRecord'],
  ['site/build/prepare/system-packages.mts', 'readObjectDescriptorRecord'],
  ['packages/bake/src/contract/prepared-object-pin.ts', 'requireRecord'],
] as const;

test('every descriptor rewrite preserves real source bytes at its writeback admission boundary', async () => {
  for (const [path, reader] of sourceReaders) {
    const source = await readFile(resolve(root, path), 'utf8');
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const admissions: ts.CallExpression[] = [], serializations: string[] = [];
    let descriptionExpression: string | undefined;
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === reader &&
          /readFile|readJson/u.test(node.getText(tree)) && /object\.json|descriptorPath/u.test(node.getText(tree))) admissions.push(node);
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'described' && node.initializer)
        descriptionExpression = node.initializer.getText(tree);
      if (ts.isCallExpression(node) && node.expression.getText(tree) === 'JSON.stringify' && node.arguments[0]) {
        const expression = node.arguments[0].getText(tree);
        if (expression === 'described' || /\.\.\.(?:descriptor(?:Data)?|originalDescriptor|host|inside)\b/u.test(expression)) serializations.push(expression);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
    assert.ok(admissions.length, `${path}: writeback must read the source record, not the normalized descriptor`);
    if (path.endsWith('prepare-object-json.mts')) assert.match(source, /pinPreparedObject\(id, originalDescriptor,/u);
    else assert.ok(serializations.length, `${path}: audit the actual descriptor serialization`);
    for (const id of ids) {
      const bytes = await readFile(resolve(root, 'src/objects', id, 'object.json'), 'utf8');
      const record = readObjectDescriptorRecord(JSON.parse(bytes));
      const properties = requireRecord(record.properties), catalog = requireRecord(properties.catalog);
      const context = { descriptor: record, descriptorData: record, originalDescriptor: record, host: record, inside: record,
        properties: path.includes('prepared-object-pin') ? {} : properties, originalProperties: properties,
        catalog, body: { text: { card: { text: catalog.description } } },
        scene: { worldFrame: properties.worldFrame }, result: { frame: properties.worldFrame },
        id: record.parent, prepared: record.prepared, page: { reference: requireRecord(properties.page).metadata }, requireRecord };
      const described: unknown = descriptionExpression ? runInNewContext(`(${descriptionExpression})`, context) : undefined;
      for (const expression of serializations) {
        // Execute the writer's own expression, with each intended replacement set to its current real value.
        const rewritten: unknown = runInNewContext(`(${expression})`, { ...context, described });
        assert.equal(`${JSON.stringify(rewritten, null, 2)}\n`, bytes, `${path}: ${id}`);
      }
    }
  }
  const catalog = await readFile(resolve(root, 'site/build/prepare/catalog/prepare-catalog.mts'), 'utf8');
  assert.doesNotMatch(catalog, /write(?:File|Generated)\([^\n]*['"]object\.json/u);
  const interiors = await readFile(resolve(root, 'site/build/prepare/authored/prepare-interior-fills.mts'), 'utf8');
  assert.match(interiors, /await repinObjectJson\(id, root\)/u);
});

test('world navigation changes only its intended frame and preserves real descriptor bytes when unchanged', async () => {
  for (const id of ids) {
    const objectDirectory = resolve(root, 'src/objects', id);
    const bytes = await readFile(resolve(objectDirectory, 'object.json'), 'utf8');
    const descriptor = readObjectDescriptorRecord(JSON.parse(bytes));
    const definition = parsePreparedObjectRuntime(await loadObjectTestDefinition(id, root));
    const result = await prepareWorldNavigationDefinition({ objectDirectory, definition });
    const properties = readObjectDescriptorRecord(JSON.parse(bytes)).properties;
    assert.ok(properties && typeof properties === 'object' && !Array.isArray(properties));
    const rewritten = { ...descriptor, properties: { ...properties, worldFrame: result.frame } };
    assert.equal(`${JSON.stringify(rewritten, null, 2)}\n`, bytes, id);
  }
});
