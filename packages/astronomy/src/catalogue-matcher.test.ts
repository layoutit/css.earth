import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRaDecCatalogueMatcher, type CatalogueMatchComparison } from './catalogue-matcher.js';

for (const comparison of ['degrees', 'arcseconds'] satisfies CatalogueMatchComparison[]) {
  test(`${comparison}: same position, nearby, distant, and RA seam`, () => {
    const matches = createRaDecCatalogueMatcher([[12, 0], [359.999, 0]], 10, comparison);
    assert.equal(matches(12, 0), true);
    assert.equal(matches(12.001, 0.001), true);
    assert.equal(matches(12.01, 0), false);
    // Known defect #1151: 7.2 arcseconds across RA zero still fails to match.
    assert.equal(matches(0.001, 0), false);
  });

  test(`${comparison}: inclusive boundary and adjacent cells`, () => {
    const radiusDeg = 10 / 3600;
    const matches = createRaDecCatalogueMatcher([[0, 0]], 10, comparison);
    assert.equal(matches(0, radiusDeg), true);
    assert.equal(matches(0, -radiusDeg), true);
    assert.equal(matches(0, radiusDeg * 1.001), false);
    // Field and query sit in neighbouring RA cells, so only the 3x3 traversal finds them.
    assert.equal(createRaDecCatalogueMatcher([[0.0027, 0]], 10, comparison)(0.0029, 0), true);
  });

  test(`${comparison}: numeric non-finite positions retain their non-matching behaviour`, () => {
    const matches = createRaDecCatalogueMatcher([[NaN, 0], [0, Infinity], [1, 1]], 10, comparison);
    assert.equal(matches(NaN, 0), false);
    assert.equal(matches(0, Infinity), false);
    assert.equal(matches(1, 1), true);
    assert.equal(createRaDecCatalogueMatcher([], 10, comparison)(0, 0), false);
  });

  test(`${comparison}: uses query declination and retains the unwrapped cell projection`, () => {
    const matches = createRaDecCatalogueMatcher([[0, 60]], 3600, comparison);
    assert.equal(matches(1.99, 60.1), true);
    // Close sky positions can also fall outside the 3x3 projected cells.
    assert.equal(createRaDecCatalogueMatcher([[300, 60]], 10, comparison)(300, 60.002), false);
  });
}

test('comparison modes preserve multiplication rounding at the radius', () => {
  const matchArcsec = 0.03;
  const decDeg = matchArcsec / 3600;
  assert.equal(createRaDecCatalogueMatcher([[0, 0]], matchArcsec, 'degrees')(0, decDeg), true);
  assert.equal(createRaDecCatalogueMatcher([[0, 0]], matchArcsec, 'arcseconds')(0, decDeg), false);
  assert.equal(createRaDecCatalogueMatcher([[0, 0]], matchArcsec)(0, decDeg), true);
});

test('validates external shapes, numbers, radius and comparison without coercion', () => {
  // Reflect.apply exercises the public runtime boundary without unchecked casts.
  for (const positions of [null, {}, [[0]], [[0, 0, 0]], [['0', 0]], [[0, undefined]], [null]]) {
    assert.throws(() => Reflect.apply(createRaDecCatalogueMatcher, undefined, [positions, 10]), TypeError);
  }
  for (const matchArcsec of [NaN, Infinity, 0, -1, '10', null]) {
    assert.throws(() => Reflect.apply(createRaDecCatalogueMatcher, undefined, [[], matchArcsec]), TypeError);
  }
  assert.throws(() => Reflect.apply(createRaDecCatalogueMatcher, undefined, [[], 10, 'other']), TypeError);
  const matches = createRaDecCatalogueMatcher([[0, 0]], 10);
  assert.equal(matches(0, 0), true);
  assert.throws(() => Reflect.apply(matches, undefined, ['0', 0]), TypeError);
  assert.throws(() => Reflect.apply(matches, undefined, [0, undefined]), TypeError);
});
