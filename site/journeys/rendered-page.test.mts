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

test('the settings panel carries the shell switches that act on the page\'s body', async () => {
  // Rotation where the body spins, light curves on a pulsating star, surface labels on a body with named features; the
  // heliosphere and the illustration models are on the map of every page (ObjectShell.astro).
  const pages: Record<string, string[]> = { earth: ['motion', 'surfaceLabels'], 'navigation/earth': ['motion', 'surfaceLabels'], titan: ['motion', 'surfaceLabels'],
    dione: ['surfaceLabels'], 'cv-mon': ['lightCurves'], m87: [] };
  for (const [route, expected] of Object.entries(pages)) {
    const document = await page(route);
    assert.ok(document, `${route} has no dist build`);
    const names = [...document.querySelectorAll('.object-settings-panel input[class$="-setting"][type="checkbox"]')].map(input => input.getAttribute('name'));
    assert.deepEqual(names.sort(), [...expected, 'heliosphere', 'illustrationModels'].sort(), route);
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
    // Plain rules, one a line, gated on marks only the page's scripts write: they also hold where a blocker refuses
    // scripts and leaves `<noscript>` unread (ObjectLayout.astro).
    const gate = 'html:not([data-body-pending]) body:not([data-sheet])';
    const noscript = (html.match(/<style>(html:not\(\[data-body-pending\]\)[^<]*)<\/style>/u)?.[1] ?? '').split('\n');
    assert.ok(noscript.includes(`${gate} > .startup-loading { display: none; }`), `${route}: the loading mark hides without JavaScript`);
    // The phone sheet is hidden until its controller publishes a snap state (shell-layout.css); no script ever does.
    assert.ok(noscript.some(rule => rule.startsWith('html:not([data-body-pending]):not([data-scene-presented="false"]) body[data-object-shell]:not([data-sheet]) :is(.object-sidebar, .object-search-toolbar, .object-search-categories) { visibility: visible')),
      `${route}: the phone sheet shows without JavaScript`);
    // A gate does not stop the engine reading a `:has()`, so the handle's and the gear's rules keep their `<noscript>`.
    assert.match(html, /<noscript><style>\.object-ui-layer:has\(/u, `${route}: the rules that read with :has() stay in a noscript`);
    const rules = noscript.filter(rule => rule.includes('data-startup-billboard'));
    assert.equal(rules.length, 1, `${route}: one noscript billboard rule`);
    // A native dataset, settings or saved-view response marks the stage it draws (dataset-response.mts).
    assert.ok(rules[0]!.startsWith(`${gate} .object-stage:not([data-prepared-object]) ~ img[data-startup-billboard]`), `${route}: ${rules[0]!.slice(0, 140)}`);
    // Sized by the share of the viewport width a native response frames the body at, and kept within the share of the
    // height the live camera allows (default-width-share.mts); the drawn body takes the same limit.
    assert.match(rules[0]!, /width: min\([0-9.]+vw, [0-9.]+cqh\);/u, `${route}: ${rules[0]!.slice(0, 160)}`);
    assert.ok(noscript.some(rule => rule.startsWith(`${gate} `) && /^\.object-stage\[data-prepared-object\]:not\(\[data-prepared-view\]\) \{ --native-stage-height: 100cqh; --native-stage-width: 100vw; --native-fit: min\(1, calc\([0-9.]+ \* tan\(atan2\(var\(--native-stage-height\), var\(--native-stage-width\)\)\)\)\); scale: var\(--native-fit\); overflow: visible; \}$/u.test(rule.slice(gate.length + 1))),
      `${route}: the drawn body keeps within the viewport's height without JavaScript`);
    const { document } = parseHTML(html);
    const stage = document.querySelector('.object-stage');
    assert.ok(stage && !stage.hasAttribute('data-prepared-object'), `${route}: the default page ships an unmarked stage`);
    assert.ok(stage.parentElement?.querySelector(':scope > img[data-startup-billboard]'), `${route}: the photograph is the stage's sibling`);
  }
});
