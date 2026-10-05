import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { deferInitialShellContext, initialShellContextBootstrap } from '../startup/initial-shell-context.mts';

test('query-specific views withhold static object facts until the requested context is ready', () => {
  for (const query of ['dataset=spectral-slope', 'v=saved', 'feature=12']) {
    const { document } = parseHTML('<html><body></body></html>');
    deferInitialShellContext(document, `http://localhost/sun/?${query}`, '/sun/');
    assert.equal(document.documentElement.dataset.shellContext, 'pending');
  }
  // A catalogue focus's or an overview's page draws the Sun's scene under its own path.
  for (const page of ['m31', 'local-group']) {
    const drawn = parseHTML('<html><body></body></html>').document;
    deferInitialShellContext(drawn, `http://localhost/${page}/`, '/sun/');
    assert.equal(drawn.documentElement.dataset.shellContext, 'pending', page);
  }
  const { document } = parseHTML('<html><body></body></html>');
  deferInitialShellContext(document, 'http://localhost/saturn/', '/saturn/');
  assert.equal(document.documentElement.dataset.shellContext, undefined);
  deferInitialShellContext(document, 'http://localhost/', '/earth/');
  assert.equal(document.documentElement.dataset.shellContext, undefined);
  // The head bootstrap is executable JavaScript produced from its typed owner.
  new Function('document', 'location', initialShellContextBootstrap('sun'))(document, { href: 'http://localhost/local-group/' });
  assert.equal(document.documentElement.dataset.shellContext, 'pending');
});
