import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseHTML } from 'linkedom';
import { renderSourceLink, sourceDocuments } from '../source-link.mts';

test('one source link follows selection, independent of search, dataset and accordion state', () => {
  const { document } = parseHTML(`<html><body>
    <input class="object-sidebar-search" value="Itokawa">
    <nav class="object-browser"><a data-source-subject="object:Bennu" data-source-document="https://example.test/bennu/README.md" data-source-label="Sources and methods for Bennu"></a>
      <a data-source-subject="overview:milky-way" data-source-document="https://example.test/milky-way/README.md" data-source-label="Sources and methods for Milky Way"></a>
      <a data-source-subject="focus:andromeda_01" data-source-document="https://example.test/local-group/README.md" data-source-label="Sources and methods for Andromeda I"></a>
    </nav><footer><a data-source-link data-source-document="https://example.test/bennu/README.md" data-source-label="Sources and methods for Bennu"><span data-source-link-label></span></a></footer>
    </body></html>`);
  const documents = sourceDocuments(document), link = document.querySelector('[data-source-link]')!;
  for (const [subject, owner, label] of [
    ['object:Bennu', 'bennu', 'Bennu'], ['overview:milky-way', 'milky-way', 'Milky Way'],
    ['focus:andromeda_01', 'local-group', 'Andromeda I'], ['object:Bennu', 'bennu', 'Bennu'],
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
  assert.doesNotThrow(() => renderSourceLink(parseHTML('<html></html>').document, 'object:Bennu'));
});
