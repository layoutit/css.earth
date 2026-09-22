import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import {
  DEFAULT_LABEL_POLICY,
  LABEL_OWNER_BODY,
  LABEL_OWNER_FOCUS,
  LABEL_OWNER_SUN,
  createLabelDeclutter,
  createLabelSlots,
  labelBox,
  labelFontPixels,
  validateLabelPolicy,
} from "./label-field.mts";

const policy = DEFAULT_LABEL_POLICY;
const box = (anchor: readonly number[], widthPx: number, priority: number, owner = LABEL_OWNER_BODY, id = "x") => ({
  owner, id, priority, anchor, widthPx, bottomOffsetPx: 10, topOffsetPx: 10 + 26.4,
});

test("the pass accepts the higher priority of two overlapping captions and drops the other", () => {
  const declutter = createLabelDeclutter({ capacity: 64, spacingPixels: 4 });
  declutter.add(box([100, 100], 60, -5, LABEL_OWNER_BODY, "faint"));
  declutter.add(box([120, 100], 60, -1, LABEL_OWNER_BODY, "bright"));
  const accepted = declutter.resolve();
  assert.deepEqual(accepted.map((entry) => entry.id), ["bright"]);
  assert.equal(declutter.accepted(LABEL_OWNER_BODY, "bright"), true);
  assert.equal(declutter.accepted(LABEL_OWNER_BODY, "faint"), false);
});

test("clearance: boxes closer than the spacing block, boxes at the spacing or beyond do not", () => {
  for (const [gap, expected] of [[3, 1], [4, 2], [10, 2]]) {
    const declutter = createLabelDeclutter({ capacity: 64, spacingPixels: 4 });
    declutter.add(box([100, 100], 60, 1, LABEL_OWNER_BODY, "a"));
    // Side by side: right edge of a at 130, left edge of b at 130 + gap.
    declutter.add(box([160 + gap, 100], 60, 0, LABEL_OWNER_BODY, "b"));
    assert.equal(declutter.resolve().length, expected, `gap ${gap}`);
  }
});

test("classes rank against each other; the focused object outranks everything and is always admitted", () => {
  const declutter = createLabelDeclutter({ capacity: 64, spacingPixels: 4 });
  declutter.add(box([100, 100], 60, -1, LABEL_OWNER_BODY, "venus"));
  declutter.add(box([100, 100], 60, -27, LABEL_OWNER_SUN, "sun"));
  declutter.add(box([100, 100], 60, Number.MAX_SAFE_INTEGER, LABEL_OWNER_FOCUS, "mercury"));
  const accepted = declutter.resolve();
  assert.deepEqual(accepted.map((entry) => entry.id), ["mercury"]);
  // Without the focus, the Sun's priority (-magnitude style, brighter is
  // larger) decides.
  const second = createLabelDeclutter({ capacity: 64, spacingPixels: 4 });
  second.add(box([100, 100], 60, -1, LABEL_OWNER_BODY, "venus"));
  second.add(box([100, 100], 60, 27, LABEL_OWNER_SUN, "sun"));
  assert.deepEqual(second.resolve().map((entry) => entry.id), ["sun"]);
});

test("the pass has a fixed capacity and resets", () => {
  const declutter = createLabelDeclutter({ capacity: 2, spacingPixels: 4 });
  assert.equal(declutter.add(box([0, 0], 10, 1)), true);
  assert.equal(declutter.add(box([100, 0], 10, 1)), true);
  assert.equal(declutter.add(box([200, 0], 10, 1)), false);
  assert.equal(declutter.count, 2);
  declutter.reset();
  assert.equal(declutter.count, 0);
});

test("boxes sit above the anchor (+y down) so a caption never covers its marker", () => {
  const declutter = createLabelDeclutter({ capacity: 64, spacingPixels: 4 });
  declutter.add({ owner: LABEL_OWNER_BODY, id: "a", priority: 1, anchor: [50, 200], widthPx: 40, bottomOffsetPx: 9, topOffsetPx: 35 });
  const [entry] = declutter.resolve();
  assert.equal(entry.bottom, 191);
  assert.equal(entry.top, 165);
  assert.equal(entry.left, 30);
  assert.equal(entry.right, 70);
});

test("slots keep their occupant while it stays accepted and ramp alpha by at most one step", () => {
  const pool = createLabelSlots({ poolSize: 2, maxAlpha: 0.85, maxAlphaStep: 0.1 });
  const venus = { key: "venus", text: "Venus", priority: 1, anchor: [0, 0], bottomOffsetPx: 5, alpha: 1 };
  const earth = { key: "earth", text: "Earth", priority: 0.5, anchor: [10, 0], bottomOffsetPx: 5, alpha: 1 };
  const mars = { key: "mars", text: "Mars", priority: 0.2, anchor: [20, 0], bottomOffsetPx: 5, alpha: 1 };
  pool.assign([venus, earth]);
  assert.deepEqual(pool.slots.map((slot) => slot.occupant), ["venus", "earth"]);
  assert.deepEqual(pool.slots.map((slot) => slot.alpha), [0.1, 0.1]);
  for (let index = 0; index < 20; index += 1) pool.assign([venus, earth]);
  assert.deepEqual(pool.slots.map((slot) => Number(slot.alpha.toFixed(6))), [0.85, 0.85]);
  // A third candidate finds no free slot until one has faded out.
  pool.assign([venus, earth, mars]);
  assert.deepEqual(pool.slots.map((slot) => slot.occupant), ["venus", "earth"]);
  // Earth is no longer accepted: its slot fades, then Mars takes it.
  let steps = 0;
  while (pool.slots[1].occupant === "earth") { pool.assign([venus, mars]); steps += 1; }
  assert.ok(steps >= 9 && steps <= 10, `faded in ${steps} steps`);
  assert.equal(pool.slots[1].occupant, "mars");
  assert.equal(pool.slots[0].occupant, "venus");
  // The first publication adopts targets at once (no fade-in from nothing).
  const fresh = createLabelSlots({ poolSize: 1, maxAlpha: 0.85, maxAlphaStep: 0.1 });
  fresh.assign([venus], false);
  assert.equal(fresh.slots[0].alpha, 0.85);
});

test("cap-height sizing: font size from the em ratio, box width from the measured width per cap", () => {
  // The shell's navigation label: 14 px in the UI stack lands capitals at
  // 10.08 px (0.72 em), the policy's cap.
  assert.ok(Math.abs(labelFontPixels(policy) - 14) < 1e-9);
  const b = labelBox(policy, { widthPerCapHeight: 4.5, markerRadiusPx: 3 });
  assert.ok(Math.abs(b.widthPx - 45.36) < 1e-9);
  assert.equal(b.bottomOffsetPx, 10);
  assert.ok(Math.abs(b.topOffsetPx - (10 + 10.08 * 2.2)) < 1e-9);
  assert.equal(validateLabelPolicy(policy), policy);
  assert.throws(() => validateLabelPolicy({ ...policy, poolSize: 0 }), TypeError);
  assert.throws(() => validateLabelPolicy({ ...policy, capHeightEm: 1.2 }), TypeError);
  assert.throws(() => validateLabelPolicy({ ...policy, candidateCapacity: 2 }), TypeError);
});
