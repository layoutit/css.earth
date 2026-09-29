import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseHTML } from 'linkedom';

const DIST = resolve(process.cwd(), 'dist');

async function page(id: string) {
  const html = await readFile(resolve(DIST, id, 'index.html'), 'utf8').catch(() => null);
  if (html === null) return null;
  return parseHTML(html).document;
}

test('information tab rules belong to the prepared scene head, never the replaceable card', async () => {
  for (const route of ['earth', 'lutetia', 'bennu', 'ceres', 'navigation/earth', 'navigation/lutetia']) {
    const document = await page(route);
    assert.ok(document, `${route} has no dist build`);
    const card = document.querySelector('.object-information-panel');
    assert.ok(card);
    assert.equal(card.querySelectorAll('style').length, 0, `${route}: replacing a card must not remove stylesheets`);
    const sheets = [...document.head.querySelectorAll('style[data-object-style^="site/information-tabs/"]')];
    assert.ok(sheets.length > 0);
    const css = sheets.map(sheet => sheet.textContent).join('\n');
    assert.ok(!css.includes('--information-panel-display'));
    for (const tab of document.querySelectorAll('[data-information-tab]')) {
      assert.ok(css.includes('#' + tab.id + ')'), `${route}: prepared selection rule for ${tab.id}`);
      assert.ok(document.getElementById(tab.getAttribute('aria-controls')!));
    }
  }
});
