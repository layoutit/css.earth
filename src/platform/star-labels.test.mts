import {requireRecord} from '@cssearth/core';
import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createExposure, screenFactor, starPresentation } from "./star-photometry.mts";
import { STAR_LABEL_POLICY, selectStarLabel } from "./star-labels.mts";

const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const view = {
  rotation: identity,
  focal: 100,
  principalOffset: [0, 0],
  visibleRect: { left: -100, top: -100, right: 100, bottom: 100 },
  exposure: createExposure({ fovDegrees: 60 }),
};
type LabelOptions = Parameters<typeof selectStarLabel>[0];
const star = (hip: number, name: string, magnitude = 1, direction: readonly number[] = [0, 0, -1]) => ({ hip, name, magnitude, direction });
const select = (stars: LabelOptions["stars"], overrides: Partial<LabelOptions> = {}) => selectStarLabel({ ...view, stars, ...overrides });
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-11, `${actual} != ${expected}`);

function requiredLabel(...args: Parameters<typeof select>) {
  const label = select(...args); assert.ok(label, 'Expected a visible star label'); return label;
}
function visibleStar(...args: Parameters<typeof starPresentation>) {
  const value = starPresentation(...args); assert.ok(value); return value;
}

test("the one ordinary caption names the brightest proper-named star regardless of input order", () => {
  const faint = star(1, "Faint", 3, [-0.6, 0, -1]);
  const bright = star(2, "Bright", -1, [0.6, 0, -1]);
  assert.equal(STAR_LABEL_POLICY.poolSize, 1);
  for (const stars of [[faint, bright], [bright, faint]]) {
    const label = requiredLabel(stars);
    assert.equal(label.id, "star:2");
    assert.equal(label.name, "Bright");
    assert.equal(label.priority, 1);
    assert.deepEqual(label.anchor, [60, 0]);
  }
  const unnamed = { ...star(2, '', -5), name: null };
  assert.equal(Reflect.apply(select, undefined, [[star(1, "", -4), unnamed]]), null);
  assert.equal(requireRecord(Reflect.apply(select, undefined, [[star(1, "", -4), unnamed, faint]])).name, "Faint");
  assert.equal(requiredLabel([{ ...bright, id: "star:catalogue-row-8" }]).id, "star:catalogue-row-8");
  assert.equal(requiredLabel([star(3, "First", 1), star(4, "Second", 1)]).name, "First");
});

test("projection rejects stars behind the eye and outside every viewport edge", () => {
  for (const direction of [[0, 0, 1], [1, 0, 0], [-1.001, 0, -1], [1.001, 0, -1], [0, -1.001, -1], [0, 1.001, -1]]) {
    assert.equal(select([star(1, "Outside", 1, direction)]), null, direction.join(","));
  }
  for (const direction of [[-1, 0, -1], [1, 0, -1], [0, -1, -1], [0, 1, -1]]) {
    assert.equal(requiredLabel([star(1, "Edge", 1, direction)]).name, "Edge");
  }
  assert.equal(requiredLabel([star(1, "Offscreen brighter", -3, [2, 0, -1]), star(2, "Visible", 2)]).name, "Visible");
});

test("row-major cube rotation, CSS y direction and principal offset all move the physical star anchor", () => {
  const label = requiredLabel([star(1, "Turned", 1, [1, 0.25, 0.5])], {
    rotation: [0, 0, 1, 0, 1, 0, -1, 0, 0],
    principalOffset: [13, -17],
  });
  assert.deepEqual(label.anchor, [63, 8]);
  assert.equal(select([star(1, "Shifted outside", 1, [0.9, 0, -1])], { principalOffset: [20, 0] }), null);
});

// Captured by executing ../galaxio's pointPhotometry.ts with its real tuning
// and fov modules, resetExposureAdaptation(), then refreshExposure(width,height).
// These oracle values are independent of cssEarth's forward/inverse functions.
const oracleRows = [
  { fovDegrees: 60, width: 800, height: 600, adaptationLuminanceCdM2: 0.052, magnitude: 6, hints: 6.42105722861681, radius: 0.6, alpha: 0.141557456552083 },
  { fovDegrees: 60, width: 800, height: 600, adaptationLuminanceCdM2: 0.052, magnitude: 5, hints: 6.42105722861681, radius: 0.8162491737415192, alpha: 0.4388340028827883 },
  { fovDegrees: 85, width: 1440, height: 900, adaptationLuminanceCdM2: 0.052, magnitude: 6, hints: 6.467687514916973, radius: 0.6, alpha: 0.1137596882895727 },
  { fovDegrees: 60, width: 800, height: 600, adaptationLuminanceCdM2: 0.2, magnitude: 5, hints: 5.0915073384803655, radius: 0.6, alpha: 0.058700063011209655 },
  { fovDegrees: 85, width: 390, height: 844, adaptationLuminanceCdM2: 0.052, magnitude: 4, hints: 4.956145225016848, radius: 0.6449858657080324, alpha: 0.48506020461382254 },
];

test("caption eligibility, presented radius and uncapped alpha match executed Galaxio oracle samples", () => {
  for (const sample of oracleRows) {
    const exposure = createExposure({ ...sample, screenFactor: screenFactor(sample.width, sample.height) });
    const label = requiredLabel([star(1, "Oracle", sample.magnitude)], { exposure });
    near(label.radiusPx, sample.radius);
    near(label.alpha, sample.alpha);
    assert.notEqual(select([star(1, "Just eligible", sample.hints - 1e-5)], { exposure }), null);
    const tooFaint = star(1, "Drawn but unlabelled", sample.hints + 1e-5);
    assert.ok(visibleStar(exposure, tooFaint.magnitude).luminance > 0);
    assert.equal(select([tooFaint], { exposure }), null);
  }
});

test("ordinary text has a fixed 12px cap and .55 alpha ceiling independent of the point-intensity cap", () => {
  assert.equal(STAR_LABEL_POLICY.capPixels, 12);
  assert.equal(STAR_LABEL_POLICY.gapPixels, 7);
  assert.equal(STAR_LABEL_POLICY.spacingPixels, 4);
  assert.equal(STAR_LABEL_POLICY.boxHeightCaps, 2.2);
  assert.equal(STAR_LABEL_POLICY.maxAlphaStep, 0.1);
  for (const intensityMax of [0.95, 0.1]) {
    const exposure = createExposure({ fovDegrees: 60, intensityMax });
    const label = requiredLabel([star(1, "Sirius", -1.44)], { exposure });
    assert.equal(label.alpha, 0.55);
    assert.equal(label.radiusPx, 1.25);
    assert.ok(visibleStar(exposure, -1.44).luminance < label.alpha / 0.55);
  }
});

test("the caption clears the actual retained point when the existing radius knob changes", () => {
  const exposure = createExposure({ fovDegrees: 60, maxRadiusPx: 2 });
  assert.equal(requiredLabel([star(1, "Sirius", -1.44)], { exposure }).radiusPx, 2);
});
