import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRaDecCatalogueMatcher, type CatalogueMatchComparison } from './catalogue-matcher.js';

for (const comparison of ['degrees', 'arcseconds'] satisfies CatalogueMatchComparison[]) {
  test(`${comparison}: same position, nearby, distant, and RA seam`, () => {
    const matches = createRaDecCatalogueMatcher([[12, 0], [359.999, 0]], 10, comparison);
    assert.equal(matches(12, 0), true);
    assert.equal(matches(12.001, 0.001), true);
    assert.equal(matches(12.01, 0), false);
    // 7.2 arcseconds across RA zero, from either side, and RA given outside 0-360.
    assert.equal(matches(0.001, 0), true);
    assert.equal(matches(360.001, 0), true);
    assert.equal(createRaDecCatalogueMatcher([[0.001, 0]], 10, comparison)(359.999, 0), true);
    assert.equal(createRaDecCatalogueMatcher([[0.001, 0]], 10, comparison)(-0.001, 0), true);
    assert.equal(matches(0.004, 0), false);
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

  test(`${comparison}: uses query declination and finds close pairs at any RA and declination`, () => {
    const matches = createRaDecCatalogueMatcher([[0, 60]], 3600, comparison);
    assert.equal(matches(1.99, 60.1), true);
    // 7.2 arcseconds apart in declination only, far from the seam and the equator.
    assert.equal(createRaDecCatalogueMatcher([[300, 60]], 10, comparison)(300, 60.002), true);
    assert.equal(createRaDecCatalogueMatcher([[195, -28]], 10, comparison)(195.002, -28.002), true);
    assert.equal(createRaDecCatalogueMatcher([[300, 60]], 10, comparison)(300, 60.003), false);
    // At the pole every RA is the same place.
    assert.equal(createRaDecCatalogueMatcher([[10, 89.9999]], 10, comparison)(190, 89.9999), true);
  });
}

test('agrees with a scan of every position, at the seam, the poles and between', () => {
  let seed = 1;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const radiusDeg = 10 / 3600;
  for (const centreDecDeg of [0, 28, -64, 89.999, -90]) for (const centreRaDeg of [0, 195, 359.999]) {
    const raSpreadDeg = 12 * radiusDeg / Math.max(1e-6, Math.cos(centreDecDeg * Math.PI / 180));
    const position = (): [number, number] => [
      ((centreRaDeg + (random() - 0.5) * raSpreadDeg) % 360 + 360) % 360,
      Math.max(-90, Math.min(90, centreDecDeg + (random() - 0.5) * 12 * radiusDeg)),
    ];
    const field = Array.from({ length: 12 }, position);
    const matches = createRaDecCatalogueMatcher(field, 10);
    for (let index = 0; index < 200; index++) {
      const [raDeg, decDeg] = position();
      const scanned = field.some(([fieldRaDeg, fieldDecDeg]) => {
        const raDifferenceDeg = Math.abs(raDeg - fieldRaDeg), wrappedDeg = Math.min(raDifferenceDeg, 360 - raDifferenceDeg);
        return Math.hypot(wrappedDeg * Math.cos(decDeg * Math.PI / 180), decDeg - fieldDecDeg) <= radiusDeg;
      });
      assert.equal(matches(raDeg, decDeg), scanned, `RA ${raDeg}, Dec ${decDeg}`);
    }
  }
});

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
