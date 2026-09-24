import { isRecord } from '@cssearth/core';
import assert from 'node:assert/strict';
import { readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { parse } from '@typescript-eslint/parser';
import type { PathLike } from 'node:fs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });
const packageNames = ['astronomy', 'catalog', 'engine', 'objects'];

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
  if (specifier.startsWith('node:')) return !file.endsWith('.test.ts');
  if (owner === 'engine' && specifier.startsWith('@cssearth/objects')) return true;
  if (!specifier.startsWith('.')) return false;
  const packageRoot = path.join(root, 'packages', owner, 'src') + path.sep;
  return !path.resolve(path.dirname(file), specifier).startsWith(packageRoot);
}

test('600 physical lines pass and adding the 601st fails in every package', async () => {
  for (const name of packageNames) {
    const filePath = `packages/${name}/src/line-limit-probe.ts`;
    const source = Array.from({ length: 600 }, () => '// physical line').join('\n');
    const [allowed] = await eslint.lintText(source, { filePath });
    assert.equal(allowed.errorCount, 0, name);
    const [rejected] = await eslint.lintText(`${source}\n// mutation: line 601`, { filePath });
    assert.ok(rejected.messages.some(message => message.ruleId === 'max-lines'), name);
  }
});

test('package guides exist and CLAUDE follows AGENTS', async () => {
  for (const name of packageNames) {
    const directory = path.join(root, 'packages', name);
    for (const file of ['README.md', 'AGENTS.md']) assert.ok((await readFile(path.join(directory, file), 'utf8')).trim().length > 0);
    assert.equal(await realpath(path.join(directory, 'CLAUDE.md')), await realpath(path.join(directory, 'AGENTS.md')));
  }
});

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
});


test('generic runtime package compiler and lint reject native renderer APIs', async () => {
  for (const name of ['engine', 'objects']) {
    const config = JSON.parse(await readFile(path.join(root, 'packages', name, 'tsconfig.json'), 'utf8'));
    assert.deepEqual(config.compilerOptions.lib, ['ES2022']);
    const [result] = await eslint.lintText('export const surface = document.createElement("div");', {
      filePath: `packages/${name}/src/renderer-leak.ts`,
    });
    assert.ok(result.messages.some(message => message.ruleId === 'no-restricted-globals'), name);
  }
});
