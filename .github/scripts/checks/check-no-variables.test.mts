import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceVariables, stylesheetVariables } from './check-no-variables.mts';

test('a stylesheet that sets or reads a custom property is refused with its file and line', () => {
  assert.deepEqual(stylesheetVariables('src/renderers/css/styles/vega-surfaces.css', '.a {\n  --vega-shell-scale: 1;\n  width: var(--polycss-atlas-width, 64px);\n}'),
    ['src/renderers/css/styles/vega-surfaces.css:2: --vega-shell-scale: 1;', 'src/renderers/css/styles/vega-surfaces.css:3: width: var(--polycss-atlas-width, 64px);']);
  assert.equal(stylesheetVariables('src/styles/comet-2p-surfaces.css', '.a { z-index: 3; --comet-2p-billboard-opacity: 0; }').length, 1);
});

test('literal values, comments and the shell label font are left alone', () => {
  assert.deepEqual(stylesheetVariables('src/renderers/css/styles/vega-surfaces.css', '/* was width: var(--polycss-atlas-width) */\n.a { width: 64px; translate: -50% -50%; }'), []);
  assert.deepEqual(stylesheetVariables('packages/renderer/src/styles/world-context.css', '.label { font: var(--shell-font-label, 400 14px/18px sans-serif); }'), []);
  assert.equal(stylesheetVariables('packages/renderer/src/styles/world-context.css', '.label { color: var(--shell-text); }').length, 1);
});

test('a renderer source that names a custom property in a string is refused; a comment or a prefix test is not', () => {
  assert.deepEqual(sourceVariables('packages/renderer/src/volume/a.ts', "host.style.setProperty('--native-volume-mix', fade);"),
    ["packages/renderer/src/volume/a.ts:1: host.style.setProperty('--native-volume-mix', fade);"]);
  assert.equal(sourceVariables('packages/renderer/src/volume/a.ts', 'const length = `calc(var(--prepared-view-focal) * 2)`;').length, 1);
  assert.deepEqual(sourceVariables('packages/renderer/src/rendering/a.ts', "// the bake names it `--silhouette-step`\nif (name.startsWith('--')) throw new TypeError('no');"), []);
  assert.deepEqual(sourceVariables('packages/renderer/src/rendering/object-control-binding.ts', "player.style.setProperty('--sequence-hold', hold);"), []);
});
