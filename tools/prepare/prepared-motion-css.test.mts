import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { preprocessCSS, resolveConfig } from 'vite';
import { isRecord } from '@cssearth/core';
import { preparedMotionCss } from './prepared-motion-css.mts';

const root = resolve(import.meta.dirname, '../..');
const config = await resolveConfig({ root, configFile: false, css: { postcss: { plugins: [preparedMotionCss(root)] } } }, 'build');
const compile = async (source: string, path: string) => (await preprocessCSS(source, resolve(root, path), config)).code;

test('runtime scene CSS omits baked motion, including nested and prefixed keyframes', async () => {
  const source = '@media (min-width: 1px) { @keyframes turn { from { transform: rotate(0deg) } to { transform: rotate(360deg) } } .body { animation: turn 2s linear infinite; transform: translateX(1px); } } @-webkit-keyframes turn { to { transform: rotate(360deg) } } .other { -webkit-animation-name: turn; color: red; }';
  const delivered = await compile(source, 'src/objects/fixture/scene.css');
  assert.doesNotMatch(delivered, /keyframes|animation/iu);
  assert.match(delivered, /@media/u);
  assert.match(delivered, /transform: translateX\(1px\)/u);
  assert.match(delivered, /color: red/u);
  assert.match(await compile(source, 'site/shell.css'), /@keyframes/u, 'shell motion has another owner');
  assert.match(await compile(source, '../other/src/scene.css'), /@keyframes/u, 'only this repository scene sources are compiled');
});

test('every declared body stylesheet passes through the motion-free delivery path', async () => {
  const sheets = new Set<string>();
  for (const id of await readdir(resolve(root, 'src/objects'))) {
    const descriptor: unknown = await readFile(resolve(root, 'src/objects', id, 'object.json'), 'utf8').then(JSON.parse, () => null);
    if (!isRecord(descriptor) || !isRecord(descriptor.properties) || !isRecord(descriptor.properties.page)) continue;
    const paths = descriptor.properties.page.stylesheets;
    assert.ok(Array.isArray(paths), `${id}: declared stylesheets`);
    for (const path of paths) { assert.equal(typeof path, 'string'); sheets.add(path); }
  }
  assert.ok(sheets.size > 0);
  let authoredMotion = 0;
  for (const path of sheets) {
    const source = await readFile(resolve(root, path), 'utf8');
    if (/@(?:-webkit-)?keyframes\b/iu.test(source)) authoredMotion++;
    const delivered = await compile(source, path);
    assert.doesNotMatch(delivered, /@(?:-webkit-)?keyframes\b|(?:^|[;{])\s*(?:-webkit-)?animation(?:-[\w-]+)?\s*:/iu, path);
  }
  assert.ok(authoredMotion > 0, 'the audit exercises authored motion, not only static sheets');
});
