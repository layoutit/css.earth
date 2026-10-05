import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { mountLayoutSections } from './layout-sections.mts';
import { NARROW_LAYOUT } from './narrow-layout.mts';
import type { BrowserWindow } from './browser/browser-types.mts';
test('layout swaps footer and sheet sources on startup and media change', () => {
  const { document, window } = parseHTML('<html><body><footer class="object-footer">Footer</footer><a class="object-sheet-sources">Sources</a></body></html>');
  let matches = false;
  let change = () => {};
  const controller = new AbortController();
  Object.assign(window, {
    matchMedia(query: string) {
      assert.equal(query, NARROW_LAYOUT);
      return {
        get matches() { return matches; },
        addEventListener(type: string, listener: () => void, options: { signal: AbortSignal }) {
          assert.equal(type, 'change');
          assert.equal(options.signal, controller.signal);
          change = listener;
        },
      };
    },
  });
  const footer = document.querySelector('footer'), sources = document.querySelector('a');
  mountLayoutSections(document, window as unknown as BrowserWindow, controller.signal);
  assert.equal(document.body.querySelector('footer') === footer, true);
  assert.equal(Boolean(document.body.querySelector('a')), false);
  matches = true; change();
  assert.equal(Boolean(document.body.querySelector('footer')), false);
  assert.equal(document.body.querySelector('a') === sources, true);
  matches = false; change();
  assert.equal(document.body.querySelector('footer') === footer, true);
  assert.equal(Boolean(document.body.querySelector('a')), false);
});
