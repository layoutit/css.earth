import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(import.meta.dirname, '../..');
const OWNERS = ['packages/bake/src/objects/sphere-survey/survey-install.ts', 'packages/bake/cli/sphere-horizons.mts'];

/** Every script the survey install and the Horizons command spawn or tell the reader to run must exist. */
for (const owner of OWNERS) {
  test(`${owner} names only commands that exist`, async () => {
    const text = await readFile(resolve(ROOT, owner), 'utf8');
    const named = [...text.matchAll(/(?:node |resolve\(root, ')((?:tools|packages|site|src|\.github)\/[A-Za-z0-9_./-]+\.mts)/g)].map(match => match[1]!);
    assert.ok(named.length > 0, `${owner} names no commands, so this guard reads nothing`);
    for (const path of named) assert.ok(existsSync(resolve(ROOT, path)), `${owner} names ${path}, which does not exist`);
  });
}
