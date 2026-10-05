import assert from 'node:assert/strict';
import test from 'node:test';
import { objectLinkIsCurrent } from '../navigation/navigation-content.mts';

const origin = 'https://site.test';
function link(href: string) {
  const url = new URL(href, origin);
  return { origin: url.origin, pathname: url.pathname, search: url.search };
}

test('object navigation leaves overview links to the same scene unselected', () => {
  assert.equal(objectLinkIsCurrent(link('/sun/'), origin, '/sun/'), true);
  assert.equal(objectLinkIsCurrent(link('/sun/?dataset=corona'), origin, '/sun/'), true);
  assert.equal(objectLinkIsCurrent(link('/solar-system/'), origin, '/sun/'), false);
  assert.equal(objectLinkIsCurrent(link('/m42/'), origin, '/sun/'), false);
  assert.equal(objectLinkIsCurrent(link('https://elsewhere.test/sun/'), origin, '/sun/'), false);
});
