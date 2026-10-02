import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
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

test('Enter in the search field submits the typed query, never a browse pill', async () => {
  for (const route of ['earth', 'saturn', 'navigation/earth']) {
    const document = await page(route);
    assert.ok(document, `${route} has no dist build`);
    const form = document.querySelector('.object-sidebar-search-card');
    assert.ok(form?.id, `${route}: search form`);
    // The browser presses the first submit button the form owns, in document order.
    const submits = [...document.querySelectorAll('button[type="submit"]')]
      .filter(button => button.getAttribute('form') === form.id || !button.hasAttribute('form') && button.closest('form') === form);
    assert.ok(submits.some(button => button.getAttribute('name') === 'browse'), `${route}: browse pills submit the search form`);
    assert.equal(submits[0]?.getAttribute('name'), null, `${route}: the default submit button carries no browse value`);
  }
});

test('without JavaScript the phone sheet shows, and the arrival photograph only over the empty default stage', async () => {
  for (const route of ['earth', 'saturn']) {
    const html = await readFile(resolve(DIST, route, 'index.html'), 'utf8').catch(() => null);
    assert.ok(html, `${route} has no dist build`);
    const noscript = [...html.matchAll(/<noscript><style>([^<]*)<\/style><\/noscript>/gu)].map(match => match[1]!.trim());
    // The phone sheet is hidden until its controller publishes a snap state (shell-layout.css); no script ever does.
    assert.ok(noscript.some(rule => rule.startsWith('body[data-object-shell]:not([data-sheet]) :is(.object-sidebar, .object-search-toolbar, .object-search-categories) { visibility: visible')),
      `${route}: the phone sheet shows without JavaScript`);
    const rules = noscript.filter(rule => rule.includes('data-startup-billboard'));
    assert.equal(rules.length, 1, `${route}: one noscript billboard rule`);
    // A native dataset, settings or saved-view response marks the stage it draws (dataset-response.mts).
    assert.ok(rules[0]!.startsWith('.object-stage:not([data-prepared-object]) ~ img[data-startup-billboard]'), `${route}: ${rules[0]!.slice(0, 80)}`);
    // Sized by the share of the viewport width a native response frames the body at (default-width-share.mts).
    assert.match(rules[0]!, /width: [0-9.]+vw;/u, `${route}: ${rules[0]!.slice(0, 160)}`);
    const { document } = parseHTML(html);
    const stage = document.querySelector('.object-stage');
    assert.ok(stage && !stage.hasAttribute('data-prepared-object'), `${route}: the default page ships an unmarked stage`);
    assert.ok(stage.parentElement?.querySelector(':scope > img[data-startup-billboard]'), `${route}: the photograph is the stage's sibling`);
  }
});
