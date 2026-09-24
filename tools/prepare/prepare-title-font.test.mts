import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
import { hasErrorCode, requireRecord, requireString } from '../sources/source-values.mts';
import { OBJECT_TITLE_RECIPE as recipe } from '../../src/platform/object-title-recipe.mts';
import { prepareTitleFont, titleFontCharacters } from './prepare-title-font.mts';

const test = sourceTest();
const root = resolve(import.meta.dirname, '../..');

test('the title font covers every character of every object display name', async () => {
  const kept = new Set(titleFontCharacters());
  const missing: string[] = [];
  for (const entry of await readdir(resolve(root, 'src/objects'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const id = entry.name;
    let content: unknown;
    try { content = JSON.parse(await readFile(resolve(root, 'src/objects', id, 'source/content/object.json'), 'utf8')); }
    catch (error) { if (hasErrorCode(error, 'ENOENT')) continue; throw error; }
    const name = requireString(requireRecord(content, `${id} content`).displayName, `${id} displayName`);
    for (const character of name) if (!kept.has(character)) missing.push(`${id}: "${character}" U+${character.codePointAt(0)!.toString(16).toUpperCase()} in "${name}"`);
  }
  assert.deepEqual(missing, [], `Add these to OBJECT_TITLE_RECIPE.webFontUnicodeRanges in src/platform/object-title-recipe.mts`);
});

test('writes one WOFF2 instance of the checked font, the same bytes each run', async t => {
  const projectRoot = await mkdtemp(resolve(tmpdir(), 'cssearth-title-web-font-'));
  t.after(() => rm(projectRoot, { recursive: true, force: true }));
  await mkdir(dirname(resolve(projectRoot, recipe.checkedFontPath)), { recursive: true });
  await copyFile(resolve(root, recipe.checkedFontPath), resolve(projectRoot, recipe.checkedFontPath));
  const first = await prepareTitleFont({ projectRoot });
  const bytes = await readFile(first.destination);
  assert.equal(bytes.subarray(0, 4).toString('latin1'), 'wOF2');
  assert.ok(first.bytes < 64 * 1024, `the title font is ${first.bytes} bytes; the page loads it on first view`);
  await prepareTitleFont({ projectRoot });
  assert.deepEqual(await readFile(first.destination), bytes);
});
