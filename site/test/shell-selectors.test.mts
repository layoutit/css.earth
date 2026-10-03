import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';

const site = new URL('../', import.meta.url);
const sources = async () => {
  const files = (await readdir(site, { recursive: true })).filter(file => /\.(astro|mts)$/u.test(file) && !/(^|\/)(test|node_modules)\//u.test(file) && !/\.test\.mts$/u.test(file));
  return Promise.all(files.map(async file => ({ file, text: await readFile(new URL(file, site), 'utf8') })));
};

test('every observation control is a result row with a leading thumbnail: its rules read no detail with :has()', async () => {
  // The row's grid and its hidden leader come from the result row's own rule (maps-shell.css). A control written without
  // those classes would fall back to the plain two-column row, with no room for a detail.
  const written: string[] = [];
  for (const { file, text } of await sources()) {
    for (const match of text.matchAll(/(["'`])([^"'`\n]*\bobject-observation-control\b(?![-\w])[^"'`\n]*)\1/gu)) {
      const classes = match[2]!;
      if (classes.includes('.object-observation-control')) continue;
      written.push(`${file}: ${classes}`);
      assert.match(classes, /\bobject-thumbnail-leading\b/u, `${file}: ${classes}`);
      assert.match(classes, /\bobject-result-row\b/u, `${file}: ${classes}`);
    }
  }
  assert.ok(written.length >= 4, `the rows' producers were found: ${written.join(' | ')}`);
});

test('the datasets panel is the one tree disclosure, so its summary is its direct child', async () => {
  const users = (await sources()).filter(({ file, text }) => /<TreeDisclosure\b/u.test(text) && !file.endsWith('TreeDisclosure.astro')).map(({ file }) => file);
  assert.deepEqual(users, ['components/ObjectInformationPanel.astro']);
});

test("the body's card always opens on breadcrumbs, and its tabs come before its datasets panel", async () => {
  // `.object-card.object-information-panel` takes the padding of a card with breadcrumbs, and the datasets panel reads
  // the card's tabs as an earlier sibling.
  const card = await readFile(new URL('components/ObjectInformationPanel.astro', site), 'utf8');
  const header = card.slice(card.indexOf('<ObjectCardHeader'), card.indexOf('</ObjectCardHeader>'));
  assert.match(header, /<ObjectBreadcrumbs\b/u, 'the header renders breadcrumbs with no condition');
  assert.doesNotMatch(header, /&&\s*<ObjectBreadcrumbs/u);
  const crumbs = await readFile(new URL('components/ObjectBreadcrumbs.astro', site), 'utf8');
  assert.match(crumbs.slice(crumbs.lastIndexOf('---')), /^---\s*<nav [^>]*class="object-breadcrumbs"/u, 'the trail is always an element, even when empty');
  const panel = card.indexOf('<TreeDisclosure');
  for (const earlier of ['<SystemCard', '<InformationTabs']) assert.ok(card.indexOf(earlier) >= 0 && card.indexOf(earlier) < panel, `${earlier} comes before the datasets panel`);
});

test('the drawer carries the search results state its ground reads', async () => {
  const { parseHTML } = await import('linkedom');
  const { createSearchPresentation } = await import('../search/search-results-presentation.mts');
  const { document } = parseHTML(`<html><body><div class="object-drawer-content"><nav class="object-browser">
    <div id="object-category-results"><p data-search-empty></p></div></nav><div class="object-selected-content"></div></div></body></html>`);
  const presentation = createSearchPresentation(document), drawer = document.querySelector('.object-drawer-content')!;
  presentation.present(true, true); assert.equal(drawer.hasAttribute('data-search-results'), true);
  presentation.present(true, false); assert.equal(drawer.hasAttribute('data-search-results'), false, 'the browser open on its tree is not a result list');
  presentation.present(true, true); presentation.present(false, false); assert.equal(drawer.hasAttribute('data-search-results'), false);
});
