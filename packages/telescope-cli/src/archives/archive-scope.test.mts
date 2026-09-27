/** The archive clients, reducers and ledger builders are generic: which shipped bodies a ledger names or searches by name is data
 * beside that archive's programs in the checkout (`tools/objects/<archive>/`), never a string in this package's code. */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WORKSPACE } from '@cssearth/telescope/node';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();

/** Every string literal in a module's code, with comments left out. */
const stringLiterals = (text: string): string[] =>
  [...text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/[^\n]*/gu, '$1').matchAll(/['"]([a-z0-9-]+)['"]/gu)].map(match => match[1]!);

test('no archive module names a shipped body; the bodies a ledger is about are data beside its programs', async () => {
  const bodies = new Set((await readdir(resolve(WORKSPACE, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name));
  const offenders: string[] = [];
  for (const entry of await readdir(import.meta.dirname, { recursive: true })) {
    if (!entry.endsWith('.mts') || entry.endsWith('.test.mts')) continue;
    for (const literal of stringLiterals(await readFile(resolve(import.meta.dirname, entry), 'utf8'))) if (bodies.has(literal)) offenders.push(`${entry}: '${literal}'`);
  }
  assert.deepEqual(offenders, []);
  assert.deepEqual(stringLiterals("const scope = ['io', 'europa']; // 'callisto'\n/* 'ganymede' */"), ['io', 'europa'], 'the scan reads code and skips comments');
});
