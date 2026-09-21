import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode, isRecord, requireArray, requireRecord, requireString } from './source-values.mts';

const root = resolve(import.meta.dirname, '..');
const tracked = new Set(execFileSync('git', ['ls-files', '-z', 'src/objects'], { cwd: root, maxBuffer: 1 << 28 }).toString().split('\0'));
const json = (path: string) => readFile(resolve(root, path), 'utf8').then(text => requireRecord(JSON.parse(text)),
  (error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });

// A pin identifies bytes git does not hold. A file this repository authors and tracks has git as its record, so a
// pin on it can only repeat git or go stale. Downloads, archive members and untracked products keep theirs.
test('a body manifest pins downloads, never the files this repository authors and tracks', async () => {
  const pinnedAuthoredFiles: string[] = [];
  for (const directory of await readdir(resolve(root, 'src/objects'), { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const base = `src/objects/${directory.name}/source`, manifest = await json(`${base}/manifest.json`);
    if (!manifest) continue;
    const plan = await json(`${base}/preparation/acquisition.json`);
    const acquired = new Set(requireArray(plan?.operations ?? []).flatMap(value => isRecord(value) ? [value.path, value.expectedPath].filter(path => typeof path === 'string') : []));
    for (const section of ['inputs', 'generatedIntermediates', 'documents']) for (const entry of requireArray(manifest[section] ?? []).map(value => requireRecord(value))) {
      const path = requireString(entry.path);
      // Volume and context packages name files from the repository root; their records are a separate contract.
      if (entry.expectedSha256 === undefined || path.startsWith('src/') || entry.range !== undefined || /^0{64}$/u.test(String(entry.expectedSha256))) continue;
      const authored = section !== 'inputs' || isRecord(entry.sourceBinding) && entry.sourceBinding.kind === 'local' || isRecord(entry.recipe) && typeof entry.recipe.generator === 'string';
      if (authored && !acquired.has(path) && tracked.has(`${base}/${path}`)) pinnedAuthoredFiles.push(`${directory.name}: ${path}`);
    }
  }
  assert.deepEqual(pinnedAuthoredFiles, [], 'Remove expectedBytes and expectedSha256 from these manifest entries; git already records the files.');
});
