import { isRecord } from '@cssearth/core';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { fileURLToPath } from 'node:url';
import { parse } from '@typescript-eslint/parser';

const root = fileURLToPath(new URL('../../../', import.meta.url));

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(location) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [location] : [];
  }));
  return files.flat();
}

function imports(node: unknown, result: string[] = []): string[] {
  if (!isRecord(node)) return result;
  if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(String(node.type))) {
    if (isRecord(node.source) && typeof node.source.value === 'string') result.push(node.source.value);
  }
  for (const [key, value] of Object.entries(node)) {
    if (['parent', 'tokens', 'comments', 'loc', 'range'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(child => imports(child, result));
    else if (value && typeof value === 'object') imports(value, result);
  }
  return result;
}

function forbiddenImport(owner: string, file: string, specifier: string) {
  if (specifier === '@layoutit/polycss') return true;
  // `@cssearth/objects/node` (source manifests) is the objects package's Node-only entry, as `/node` is for core and fits.
  const nodeEntry = owner === 'objects' && file.startsWith(path.join(root, 'packages/objects/src/node') + path.sep);
  if (specifier.startsWith('node:')) return !file.endsWith('.test.ts') && !nodeEntry;
  if (owner === 'engine' && specifier.startsWith('@cssearth/objects')) return true;
  if (!specifier.startsWith('.')) return false;
  const packageRoot = path.join(root, 'packages', owner, 'src') + path.sep;
  return !path.resolve(path.dirname(file), specifier).startsWith(packageRoot);
}

test('runtime packages cannot reach site, legacy sources, Node tooling, or reverse the object dependency', async () => {
  for (const name of ['engine', 'objects']) {
    for (const file of await sourceFiles(path.join(root, 'packages', name, 'src'))) {
      const source = await readFile(file, 'utf8');
      assert.doesNotMatch(source, /@ts-(?:ignore|nocheck)/, file);
      const tree = parse(source, { sourceType: 'module', ecmaVersion: 'latest' });
      for (const specifier of imports(tree)) assert.equal(forbiddenImport(name, file, specifier), false, `${file}: ${specifier}`);
    }
  }
  const fixture = path.join(root, 'packages/engine/src/runtime/probe.ts');
  for (const specifier of ['../../../../site/runtime-policy.mts', '../../../../src/platform/object-runtime.mts', '@cssearth/objects', 'node:fs']) {
    const tree = parse(`import data from ${JSON.stringify(specifier)}`, { sourceType: 'module' });
    assert.ok(imports(tree).some(value => forbiddenImport('engine', fixture, value)), specifier);
  }
  const nodeImport = parse('import { readFile } from "node:fs/promises"', { sourceType: 'module' });
  assert.ok(imports(nodeImport).some(value => forbiddenImport('objects', path.join(root, 'packages/objects/src/sources/probe.ts'), value)));
  assert.ok(!imports(nodeImport).some(value => forbiddenImport('objects', path.join(root, 'packages/objects/src/node/probe.ts'), value)));
});

test('host-neutral packages keep Node in node/: nothing else imports a Node built-in or a node/ module, or uses Buffer', async () => {
  const offenders: string[] = [];
  for (const name of ['core', 'fits', 'objects', 'spice', 'telescope']) {
    const source = path.join(root, 'packages', name, 'src');
    for (const file of await sourceFiles(source)) {
      const relative = path.relative(source, file).replaceAll('\\', '/');
      if (/^(?:node|test-support)\//u.test(relative) || /\.test\.m?ts$/u.test(relative)) continue;
      const text = await readFile(file, 'utf8');
      for (const specifier of imports(parse(text, { sourceType: 'module', ecmaVersion: 'latest' })))
        if (specifier.startsWith('node:') || /(^|\/)node(\/|$)/u.test(specifier)) offenders.push(`${name}/${relative} -> ${specifier}`);
      if (/\bBuffer\b/u.test(text)) offenders.push(`${name}/${relative} -> Buffer`);
    }
  }
  assert.deepEqual(offenders, []);
});
