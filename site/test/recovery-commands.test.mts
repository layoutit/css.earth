import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');

/** The recovery messages the shell shows a reader must name commands that exist. */
for (const owner of ['site/object-text.mts', 'site/components/ObjectNavigationMarker.astro']) {
  test(`${owner} tells the reader to run a command that exists`, async () => {
    const named = [...(await readFile(resolve(root, owner), 'utf8')).matchAll(/node ((?:packages|site|\.github)\/[A-Za-z0-9_./-]+\.mts)/g)].map(match => match[1]!);
    assert.ok(named.length > 0, `${owner} names no command, so this guard reads nothing`);
    for (const path of named) assert.ok(existsSync(resolve(root, path)), `${owner} names ${path}, which does not exist`);
  });
}
