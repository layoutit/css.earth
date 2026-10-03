import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { parseHTML } from 'linkedom';
import { renderSourceLink, sourceDocuments } from '../source-link.mts';

test('one source link follows selection, independent of search, dataset and accordion state', () => {
  const { document } = parseHTML(`<html><body>
    <input class="object-sidebar-search" value="Itokawa">
    <nav class="object-browser"><a data-source-subject="object:bennu" data-source-document="https://example.test/bennu/README.md" data-source-label="Sources and methods for Bennu"></a>
      <a data-source-subject="object:bennu-2" data-source-document="https://example.test/bennu-2/README.md" data-source-label="Sources and methods for another Bennu"></a>
      <a data-source-subject="overview:milky-way" data-source-document="https://example.test/milky-way/README.md" data-source-label="Sources and methods for Milky Way"></a>
      <a data-source-subject="focus:andromeda_01" data-source-document="https://example.test/local-group/README.md" data-source-label="Sources and methods for Andromeda I"></a>
    </nav><footer><a data-source-link data-source-document="https://example.test/bennu/README.md" data-source-label="Sources and methods for Bennu"><span data-source-link-label></span></a></footer>
    </body></html>`);
  const documents = sourceDocuments(document), link = document.querySelector('[data-source-link]')!;
  for (const [subject, owner, label] of [
    ['object:bennu', 'bennu', 'Bennu'], ['object:bennu-2', 'bennu-2', 'another Bennu'],
    ['overview:milky-way', 'milky-way', 'Milky Way'],
    ['focus:andromeda_01', 'local-group', 'Andromeda I'], ['object:bennu', 'bennu', 'Bennu'],
  ]) {
    renderSourceLink(document, subject, documents);
    assert.equal(link.getAttribute('href'), `https://example.test/${owner}/README.md`);
    assert.equal(link.getAttribute('aria-label'), `Sources and methods for ${label}`);
    assert.equal(link.textContent, `Sources and methods for ${label}`);
    assert.equal(document.querySelector('[data-source-link]'), link);
  }
  assert.equal(document.querySelector('input')?.value, 'Itokawa');
});

test('a native body request retains its prepared default link', () => {
  const { document } = parseHTML('<a data-source-link data-source-document="https://example.test/bennu/README.md" data-source-label="Sources and methods for Bennu"><span data-source-link-label></span></a>');
  renderSourceLink(document, 'overview:');
  assert.equal(document.querySelector('a')?.getAttribute('href'), 'https://example.test/bennu/README.md');
  assert.doesNotThrow(() => renderSourceLink(parseHTML('<html></html>').document, 'object:bennu'));
});

test('a card that arrived after the rows were read supplies its own subject', () => {
  const { document } = parseHTML(`<html><body><nav class="object-browser"></nav>
    <aside class="object-information-panel"><header data-source-subject="satellite-system:earth" data-source-document="https://example.test/earth/README.md" data-source-label="Sources: NASA"></header></aside>
    <a data-source-link data-source-document="https://example.test/mars/README.md" data-source-label="Sources: USGS"><span data-source-link-label></span></a></body></html>`);
  // The rows read on the first page (Mars) know nothing of Earth's moons.
  renderSourceLink(document, 'satellite-system:earth', new Map());
  assert.equal(document.querySelector('[data-source-link]')?.getAttribute('href'), 'https://example.test/earth/README.md');
  assert.equal(document.querySelector('[data-source-link]')?.textContent, 'Sources: NASA');
});

test('a body reached by a map marker is named by its own card', () => {
  const { document } = parseHTML(`<html><body><nav class="object-browser"></nav>
    <aside class="object-information-panel"><section data-source-subject="object:m49" data-source-document="https://example.test/m49/README.md" data-source-label="Sources: Legacy Surveys"></section></aside>
    <a data-source-link data-source-document="https://example.test/virgo-cluster/README.md" data-source-label="Sources: CDS"><span data-source-link-label></span></a></body></html>`);
  // The rows read on the first page (the Virgo cluster) do not list M49.
  renderSourceLink(document, 'object:m49', new Map());
  assert.equal(document.querySelector('[data-source-link]')?.getAttribute('href'), 'https://example.test/m49/README.md');
  assert.equal(document.querySelector('[data-source-link]')?.textContent, 'Sources: Legacy Surveys');
});

test('a card part that waits off the page still names its subject', () => {
  const { document } = parseHTML(`<html><body><nav class="object-browser"></nav>
    <aside class="object-information-panel"><template data-detached-section><section data-source-subject="object:eps-eridani-system" data-source-document="https://example.test/eps-eridani/README.md" data-source-label="Sources: NASA"></section></template></aside>
    <a data-source-link data-source-document="https://example.test/eps-eridani-b/README.md" data-source-label="Sources"><span data-source-link-label></span></a></body></html>`);
  // A star's card carries its system's header while the body is its subject; the planet's page it came from named neither.
  renderSourceLink(document, 'object:eps-eridani-system', new Map());
  assert.equal(document.querySelector('[data-source-link]')?.getAttribute('href'), 'https://example.test/eps-eridani/README.md');
});
