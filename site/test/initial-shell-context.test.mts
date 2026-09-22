import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { deferInitialShellContext, initialShellContextBootstrap } from '../initial-shell-context.mts';

test('query-specific views withhold static object facts until the requested context is ready', () => {
  for (const query of ['overview=local-group', 'focus=m_031', 'dataset=spectral-slope', 'v=saved', 'feature=12']) {
    const { document } = parseHTML('<html><body></body></html>');
    deferInitialShellContext(document, `http://localhost/sun/?${query}`);
    assert.equal(document.documentElement.dataset.shellContext, 'pending');
  }
  const { document } = parseHTML('<html><body></body></html>');
  deferInitialShellContext(document, 'http://localhost/saturn/');
  assert.equal(document.documentElement.dataset.shellContext, undefined);
  // The head bootstrap is executable JavaScript produced from its typed owner.
  new Function('document', 'location', initialShellContextBootstrap)(document, { href: 'http://localhost/sun/?overview=local-group' });
  assert.equal(document.documentElement.dataset.shellContext, 'pending');
});
