import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { SHELL_SETTING_NAMES } from '@cssearth/renderer/runtime/shell-settings.ts';

test('the shell-owned setting names are exactly the setting inputs the shared shell renders', () => {
  const shell = readFileSync(new URL('../components/ObjectShell.astro', import.meta.url), 'utf8');
  const rendered = [...shell.matchAll(/<input class="object-[a-z-]+-setting"[^>]*\bname="([A-Za-z]+)"/gu)].map(match => match[1]);
  assert.ok(rendered.length > 0, 'the shell renders its setting inputs');
  assert.deepEqual(new Set(rendered), SHELL_SETTING_NAMES);
});
