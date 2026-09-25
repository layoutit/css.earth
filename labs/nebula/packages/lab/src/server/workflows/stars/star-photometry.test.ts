import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareStarPhotometry } from '@cssearth/bake/volume';

// Independent display-light accounting; do not reproduce the preparer's split into size/opacity.
const light = (magnitude: number, color: string) => {
  const point = prepareStarPhotometry(magnitude, color);
  const channels = color.slice(1).match(/../g)!.map(value => parseInt(value, 16));
  return point.sizePx ** 2 * point.opacity *
    (.2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]) / 255;
};
test('five magnitudes carry 100 times less point light without an opacity floor', () => {
  assert.ok(Math.abs(light(10, '#ffffff') / light(15, '#ffffff') - 100) < 1e-10);
  const faint = prepareStarPhotometry(16, '#ffffff'), bright = prepareStarPhotometry(10, '#ffffff');
  assert.ok(faint.opacity < .1 && faint.sizePx < 1);
  assert.ok(bright.opacity > .9 && bright.sizePx <= 4);
  assert.ok(light(25, '#ffffff') < light(20, '#ffffff') / 99);
});
test('the same magnitude carries the same light across display colors within the available range', () => {
  for (const magnitude of [10.157, 12, 16]) {
    const reference = light(magnitude, '#ffffff');
    for (const color of ['#ffc89c', '#bbccff'])
      assert.ok(Math.abs(light(magnitude, color) / reference - 1) < 1e-12);
  }
});
test('invalid inputs reject and out-of-range bright points stay bounded', () => {
  for (const magnitude of [NaN, Infinity, -Infinity]) assert.throws(() => prepareStarPhotometry(magnitude, '#ffffff'));
  for (const color of ['red', '#000000', '#fff']) assert.throws(() => prepareStarPhotometry(10, color));
  assert.deepEqual(prepareStarPhotometry(-1, '#ffffff'), { sizePx: 4, opacity: 1 });
});
