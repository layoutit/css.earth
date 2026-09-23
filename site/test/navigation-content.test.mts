import assert from 'node:assert/strict';
import test from 'node:test';
import { objectLinkIsCurrent } from '../navigation/navigation-content.mts';

const origin = 'https://site.test';
function link(href: string, preparedFocus = false) {
  const url = new URL(href, origin);
  return { origin: url.origin, pathname: url.pathname, search: url.search,
    hasAttribute(name: string) { return preparedFocus && name === 'data-prepared-focus-id'; } };
}

test('object navigation leaves focus and overview links to the same scene unselected', () => {
  assert.equal(objectLinkIsCurrent(link('/sun/'), origin, '/sun/'), true);
  assert.equal(objectLinkIsCurrent(link('/sun/?dataset=corona'), origin, '/sun/'), true);
  assert.equal(objectLinkIsCurrent(link('/sun/?overview=system'), origin, '/sun/'), false);
  assert.equal(objectLinkIsCurrent(link('/sun/?focus=m42'), origin, '/sun/'), false);
  assert.equal(objectLinkIsCurrent(link('/sun/', true), origin, '/sun/'), false);
  assert.equal(objectLinkIsCurrent(link('https://elsewhere.test/sun/'), origin, '/sun/'), false);
});
