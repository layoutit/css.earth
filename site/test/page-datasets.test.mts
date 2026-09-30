import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { presentPageDatasets, readPageDatasets, selectedPageDataset } from '../page-datasets.mts';
import { parsePageDatasets } from '../page-dataset-cards.mts';

const test = sourceTest();

// The Observable Universe card as OverviewCard.astro renders it: two datasets, cut open by default.
const card = () => parseHTML(`<html><body><div data-page-datasets="observable-universe" data-default-dataset="cutaway"
  data-dataset-views='{"cutaway":"cutaway","full":"full"}'>
  <button name="dataset" value="cutaway" aria-pressed="true"></button><button name="dataset" value="full" aria-pressed="false"></button>
  <div data-focus-dataset-details="cutaway"></div><div data-focus-dataset-details="full" hidden></div></div></body></html>`).document;

test("a page's dataset is its own dataset while the address is that page, and its default elsewhere", () => {
  const [datasets] = readPageDatasets(card());
  assert.equal(selectedPageDataset('https://css.earth/observable-universe/?dataset=full', datasets!), 'full');
  assert.equal(selectedPageDataset('https://css.earth/observable-universe/', datasets!), 'cutaway');
  assert.equal(selectedPageDataset('https://css.earth/observable-universe/?dataset=unknown', datasets!), 'cutaway');
  assert.equal(selectedPageDataset('https://css.earth/sun/?dataset=full', datasets!), 'cutaway', "another page's dataset is not this page's");
});

test('the card marks the chosen dataset on its host scene and hides its datasets on any other', () => {
  const document = card(), root = document.querySelector<HTMLElement>('[data-page-datasets]')!;
  presentPageDatasets(document, 'https://css.earth/observable-universe/?dataset=full', 'sun');
  assert.equal(root.hidden, false);
  assert.deepEqual([...document.querySelectorAll('button')].map(button => button.getAttribute('aria-pressed')), ['false', 'true']);
  assert.deepEqual([...document.querySelectorAll<HTMLElement>('[data-focus-dataset-details]')].map(detail => detail.hidden), [true, false]);
  // Another star zoomed out to the same level shows the level's card without them: choosing one would leave that star.
  presentPageDatasets(document, 'https://css.earth/trappist-1/?overview=system', 'trappist-1');
  assert.equal(root.hidden, true);
});

test("the prepared cards of the Observable Universe resolve to its published pictures, and a bad one names the package", async () => {
  const raw: unknown = JSON.parse(await readFile(new URL('../../src/objects/observable-universe/prepared/datasets.json', import.meta.url), 'utf8'));
  const cards = parsePageDatasets('observable-universe', raw, path => `https://assets.example/${path}`);
  // It opens with the sphere off: the galaxies and quasars alone, with no legend for a map it does not show.
  assert.equal(cards.defaultDataset, 'off');
  assert.deepEqual(cards.views, { off: 'hidden', cutaway: 'cutaway', full: 'full' });
  assert.deepEqual(cards.controls.map(dataset => dataset.thumbnailUrl),
    ['https://assets.example/cmb/cmb-hidden.webp', 'https://assets.example/cmb/cmb-cutaway.webp', 'https://assets.example/cmb/cmb-full.webp']);
  assert.equal(cards.controls[0]!.legend, undefined);
  assert.equal(cards.controls[1]!.legend?.labels?.join(' '), '−300 µK 0 µK +300 µK');
  assert.throws(() => parsePageDatasets('observable-universe', raw, () => undefined), /observable-universe prepared\/datasets\.json: cmb\/cmb-hidden\.webp is not a published file/);
  assert.throws(() => parsePageDatasets('nearby-universe', raw, path => path), /nearby-universe prepared\/datasets\.json/);
});
