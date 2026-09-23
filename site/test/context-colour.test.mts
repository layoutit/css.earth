import assert from 'node:assert/strict';
import test from 'node:test';
import { composited, contextColour, contrastRatio, readableOnSky } from '../context-colour.mts';

const onSky = (hex: string, opacity: number) => contrastRatio(composited(hex, opacity), '#000000');

test('a context colour is the swatch, else a tinted catalogue colour, never the neutral gray of an unmeasured body', () => {
  assert.equal(contextColour('#ffb965', '#a95e47', .65), '#ffb965');
  assert.equal(contextColour(undefined, '#e4efff', .65), '#e4efff');
  for (const gray of ['#9a9a9a', '#aaaaaa', '#A0A0A0']) assert.equal(contextColour(undefined, gray, .65), undefined, gray);
  assert.equal(contextColour(undefined, undefined, .65), undefined);
  assert.throws(() => contextColour(undefined, 'orange', .65), /#rrggbb, not orange/u);
});

test('every label colour meets WCAG 4.5:1 on the black sky as rendered, keeping its hue', () => {
  // HR 8799 b's measured #6e75aa at the 0.65 label opacity reaches the screen at 2.54:1; it is lightened only to the minimum.
  assert.ok(onSky('#6e75aa', .65) < 4.5);
  for (const [hex, opacity] of [['#6e75aa', .65], ['#c6427c', .65], ['#8b8177', .65], ['#e97a54', .65], ['#b8b6b2', .5]] as const) {
    const out = readableOnSky(hex, opacity), ratio = onSky(out, opacity);
    assert.ok(ratio >= 4.5 && ratio < 4.6, `${hex} -> ${out} at ${ratio}`);
  }
  assert.equal(readableOnSky('#6e75aa', .65), '#a7afe8');
  assert.equal(readableOnSky('#e4efff', .65), '#e4efff');
  assert.throws(() => readableOnSky('#6e75aa', 0), /label opacity/u);
});
