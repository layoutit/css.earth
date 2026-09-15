import assert from 'node:assert/strict';
import test from 'node:test';
import { labView, labViewUrl } from './lab-routing.js';

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
