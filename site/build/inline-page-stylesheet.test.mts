import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inlinePageStylesheets } from './inline-page-stylesheet.mts';

test('pages carry their stylesheet inline and flight fragments keep the link', async () => {
  const dist = await mkdtemp(join(tmpdir(), 'inline-stylesheet-'));
  const link = '<link rel="stylesheet" href="/_astro/ObjectPage.abc.css">', page = `<head>${link}</head>`;
  for (const directory of ['_astro', 'earth', 'navigation/earth']) await mkdir(join(dist, directory), { recursive: true });
  await writeFile(join(dist, '_astro/ObjectPage.abc.css'), '.a{content:"$&"}');
  for (const file of ['index.html', 'earth/index.html', 'navigation/earth/index.html']) await writeFile(join(dist, file), page);
  assert.equal(await inlinePageStylesheets(dist), 2);
  for (const file of ['index.html', 'earth/index.html']) assert.equal(await readFile(join(dist, file), 'utf8'), '<head><style>.a{content:"$&"}</style></head>');
  for (const file of ['navigation/earth/index.html']) assert.equal(await readFile(join(dist, file), 'utf8'), page);
});
