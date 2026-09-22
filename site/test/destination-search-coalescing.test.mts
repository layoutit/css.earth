import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { createDestinationBrowser } from '../destination-browser.mts';

// Keystrokes that arrive faster than the page draws each started a scan of every city name (34,135 cities, 326,275
// names). The browser now waits for the next frame and scans once, for the newest text.
test('keystrokes queued before a frame run one city scan, for the newest text', async () => {
  const { document, window } = parseHTML(`<body>
    <section class="planet-destination-results" hidden><p class="planet-destination-hint"></p>
      <ul class="planet-destination-list">${'<li hidden><button><span class="planet-destination-result-name"></span><span class="planet-destination-result-context"></span></button></li>'.repeat(3)}</ul></section>
    <section class="planet-destination-panel" hidden><button class="planet-destination-back"></button><h2 class="planet-destination-name"></h2><p class="planet-destination-context"></p><p class="planet-destination-status"></p></section></body>`);
  const frames: (() => void)[] = [];
  Object.assign(window, { requestAnimationFrame: (callback: () => void) => frames.push(callback) });
  let scans = 0;
  const place = (name: string) => ({ name, context: 'France', searchContext: 'france', coverage: 'city',
    get names() { scans++; return [name.toLowerCase()]; } });
  const places = [place('Paris'), place('Pau'), place('Lyon')];
  const browser = createDestinationBrowser({ documentTarget: document, onSelected() {}, onReset() {}, onResults() {} });
  assert.ok(browser);
  browser.bind({ load: async () => ({ places }), select: async () => ({ status: '' }), reset() {} });
  const searches = ['p', 'pa', 'par'].map(value => browser.search(value));
  await new Promise(resolve => setTimeout(resolve, 0));
  const validation = scans;
  assert.equal(frames.length, 3, 'each keystroke waits for the frame');
  for (const frame of frames.splice(0)) frame();
  await Promise.all(searches);
  assert.equal(scans - validation, places.length, 'one scan of every place');
  const shown = [...document.querySelectorAll('li')].filter(row => !row.hidden).map(row => row.querySelector('.planet-destination-result-name')?.textContent);
  assert.deepEqual(shown, ['Paris']);
});

test('a city opens by its catalogue id, and the Back label names the bound body', async () => {
  const { document } = parseHTML(`<body><section class="planet-destination-results" hidden><p class="planet-destination-hint"></p><ul class="planet-destination-list"></ul></section>
    <section class="planet-destination-panel" hidden><button class="planet-destination-back">← Back to Mars</button><h2 class="planet-destination-name"></h2><p class="planet-destination-context"></p><p class="planet-destination-status"></p></section></body>`);
  const browser = createDestinationBrowser({ documentTarget: document, onSelected() {}, onReset() {}, onResults() {} })!;
  const selected: unknown[] = [];
  const rosario = { id: 1691490, name: 'Rosario', names: ['rosario'], context: 'Calabarzon, Philippines', searchContext: 'calabarzon philippines ph', coverage: 'overview' };
  browser.bind({ load: async () => ({ places: [rosario] }), select: async place => { selected.push(place); return { status: 'Earth overview at this location.' }; }, reset() {} }, 'Earth');
  await browser.selectById('1691490');
  assert.deepEqual(selected, [rosario]);
  assert.equal(document.querySelector('.planet-destination-name')?.textContent, 'Rosario');
  assert.equal(document.querySelector('.planet-destination-back')?.textContent, '← Back to Earth');
  await assert.rejects(browser.selectById('1'), /not in the prepared catalogue/);
});
