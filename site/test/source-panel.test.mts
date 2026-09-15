import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { renderSourcePanel } from '../source-panel-controller.mts';

function fixture() {
  const bank = (id: string, urls: string[]) => `<section data-source-bank="${id}" data-source-label="${id}" hidden><ul>${urls.map(url =>
    `<li class="planet-resource-row"><a href="https://example.com/${url}">${url}</a></li>`).join('')}</ul></section>`;
  return parseHTML(`<html><body>
    <nav class="planet-object-browser" data-source-scope="object"></nav>
    <div class="planet-information-panel"><button name="dataset" value="normal" aria-pressed="true"></button><button name="dataset" value="uv" aria-pressed="false"></button></div>
    <div data-focus-lens-bank="smc"><button name="focusLens" value="optical" aria-pressed="true"></button></div>
    <div data-source-panel><details><summary>Sources <span class="planet-panel-heading-count"></span></summary>
    <div data-source-owner="saturn" data-source-name="Saturn"><p data-source-view></p>
    ${bank('body:normal', ['surface', 'rings'])}${bank('body:uv', ['uv'])}${bank('object', ['surface/', 'orbits'])}
    ${bank('scope:sky', ['sky'])}${bank('scope:local-group', ['galaxies'])}${bank('scope:nearby-universe', ['clusters'])}
    ${bank('focus:smc:optical', ['smc-image'])}${bank('citation:smc-distance', ['smc-distance'])}
    <span data-source-record="smc" data-source-record-name="Small Magellanic Cloud" data-source-record-object="smc" data-source-citations="citation:smc-distance"></span>
    </div></details></div></body></html>`).document;
}
const links = (document: Document) => [...document.querySelectorAll('[data-source-bank]:not([hidden]) a:not([hidden])')].map(link => link.textContent);

test('the selected dataset and object references combine without duplicate pages', () => {
  const document = fixture();
  renderSourcePanel(document);
  assert.deepEqual(links(document), ['surface', 'rings', 'orbits', 'sky']);
  assert.equal(document.querySelector('.planet-panel-heading-count')?.textContent, '(4)');
  assert.equal(document.querySelector('details')?.hasAttribute('open'), false);
  document.querySelector('details')?.setAttribute('open', '');
  document.querySelector('[value="normal"]')?.setAttribute('aria-pressed', 'false');
  document.querySelector('[value="uv"]')?.setAttribute('aria-pressed', 'true');
  renderSourcePanel(document);
  assert.deepEqual(links(document), ['uv', 'surface/', 'orbits', 'sky']);
  assert.equal(document.querySelector('details')?.hasAttribute('open'), true, 'dataset changes retain the reader’s disclosure state');
});

test('outer selections replace body references with their own dataset and measurement citations', () => {
  const document = fixture(), browser = document.querySelector('.planet-object-browser')!;
  browser.setAttribute('data-source-scope', 'focus'); browser.setAttribute('data-source-focus', 'smc');
  renderSourcePanel(document);
  assert.deepEqual(links(document), ['smc-image', 'smc-distance']);
  assert.equal(document.querySelector('[data-source-view]')?.textContent, 'Small Magellanic Cloud');
  for (const [scope, expected] of [['local-group', 'galaxies'], ['nearby-universe', 'clusters']]) {
    browser.setAttribute('data-source-scope', scope); renderSourcePanel(document);
    assert.deepEqual(links(document), [expected]);
  }
  browser.setAttribute('data-source-scope', 'object'); renderSourcePanel(document);
  assert.deepEqual(links(document), ['surface', 'rings', 'orbits', 'sky']);
});

test('an unavailable source panel does not affect the shell', () => {
  assert.doesNotThrow(() => renderSourcePanel(parseHTML('<html><body></body></html>').document));
});
