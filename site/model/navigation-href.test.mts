import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { navigationHref, registerNavigationHref } from './navigation-href.mts';

test('registration defers reads until the getter runs and disposal restores the browser address', () => {
  const windowTarget = { location: { href: 'https://css.earth/earth/' } } as Window;
  let href = 'https://css.earth/mars/', reads = 0;
  const dispose = registerNavigationHref(windowTarget, { href() { reads++; return href; } });
  assert.equal(reads, 0);
  assert.equal(navigationHref(windowTarget), href);
  href = 'https://css.earth/moon/';
  assert.equal(navigationHref(windowTarget), href);
  assert.equal(reads, 2);
  dispose();
  assert.equal(navigationHref(windowTarget), windowTarget.location.href);
  assert.equal(reads, 2, 'disposed readers are never evaluated');
});

test('disposing a replaced registration preserves the current reader', () => {
  const windowTarget = { location: { href: 'https://css.earth/earth/' } } as Window;
  const disposeFirst = registerNavigationHref(windowTarget, { href: () => 'https://css.earth/mars/' });
  const disposeSecond = registerNavigationHref(windowTarget, { href: () => 'https://css.earth/moon/' });
  disposeFirst();
  assert.equal(navigationHref(windowTarget), 'https://css.earth/moon/');
  disposeSecond();
  assert.equal(navigationHref(windowTarget), windowTarget.location.href);
});

test('world resources import the lower held-address reader without depending on history', () => {
  const world = readFileSync(new URL('../world/application-world-resources.mts', import.meta.url), 'utf8');
  assert.match(world, /import \{ navigationHref \} from '\.\.\/model\/navigation-href\.mts';/u);
  assert.doesNotMatch(world, /from '\.\.\/navigation\/navigation-history\.mts'/u);
});
