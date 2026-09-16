import assert from 'node:assert/strict';
import test from 'node:test';
import { labView, labViewUrl, labPageUrl, labObjectId } from './lab-routing.js';

test('legacy view links retain object and saved reconstruction state', () => {
  const legacy = new URL('http://localhost:4331/?tab=render&subject=lmc-clouds&reconstruction=saved#camera');
  assert.equal(labView(legacy), 'reconstruction');
  assert.equal(labViewUrl(legacy, labView(legacy)).href, 'http://localhost:4331/reconstruction?subject=lmc-clouds&reconstruction=saved#camera');
  assert.equal(legacy.pathname, '/');
});

test('explicit paths take precedence and switching changes only the view', () => {
  const value = new URL('http://localhost:4331/alignment/?tab=render&subject=smc-particles');
  assert.equal(labView(value), 'alignment');
  assert.equal(labViewUrl(value, 'reconstruction').href, 'http://localhost:4331/reconstruction?subject=smc-particles');
  assert.equal(labView(new URL('http://localhost:4331/reconstruction/')), 'reconstruction');
  assert.equal(labView(new URL('http://localhost:4331/')), 'alignment');
});


test('all pages share object context while old catalogue bookmarks remain readable', () => {
  const old = new URL('http://localhost:4331/catalogue?object=m42&view=papers');
  assert.equal(labObjectId(old), 'm42');
  const alignment = labPageUrl(old, 'alignment', 'm42');
  assert.equal(alignment.pathname, '/alignment');
  assert.equal(alignment.searchParams.get('subject'), 'm42');
  assert.equal(alignment.searchParams.has('object'), false);
  const reconstruction = labPageUrl(alignment, 'reconstruction', 'm42');
  const catalogue = labPageUrl(reconstruction, 'catalogue', 'm42');
  assert.equal(labObjectId(catalogue), 'm42');
  assert.equal(catalogue.searchParams.get('view'), 'papers');
  assert.equal(labObjectId(new URL('http://localhost/?subject=lmc-clouds&object=m42')), 'lmc-clouds');
});
