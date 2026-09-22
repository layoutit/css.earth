import {parsePreparedObjectRuntime, type PreparedView} from '../renderers/css/dist/index.js';
import {requireRecord,requireArray,requireFiniteNumber} from '../../tools/sources/source-values.mts';
import { loadObjectTestDefinition } from '../../tools/contract/object-test-data.mts';
import assert from "node:assert/strict";
import test from "node:test";
import { createPreparedMaterialPublisher, preparedMaterialState } from '../renderers/css/dist/testing.js';
import { selectedPreparedVariant } from '../renderers/css/dist/testing.js';
import { initialObjectSelection } from '../renderers/css/dist/testing.js';
import { requireObjectRuntimeDefinition } from "../../tools/contract/object-runtime-contract.mts";
import { retainedPresentationFixture } from "./test/object-runtime-package.mts";
const mars = parsePreparedObjectRuntime(await loadObjectTestDefinition('mars'));
import { viewSunDirectionToPreparedLightDirection } from "./directional-sun-coordinate.mts";

const track = mars.materials[0], phaseMaximum = Math.max(...track.frame.indices), bankLength = phaseMaximum + 1;
const frameCount = requireFiniteNumber(requireRecord(track.frame).count, 'Mars material frame count');
const rotation = track.rotation; assert.ok(rotation);
const selected = (shadows: boolean) => selectedPreparedVariant(mars, { ...initialObjectSelection(mars.controls), shadows }).materials[0];
const roll = (direction: readonly number[]) => {
  if (Math.hypot(direction[0], direction[1]) < 1e-9) return 0;
  const value = Math.atan2(direction[1], direction[0]) * 180 / Math.PI - rotation.baseDegrees;
  return (value % 360 + 540) % 360 - 180;
};
const matrix = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
function view(direction: readonly number[]) {
  const value: PreparedView & {skySunViewDirection: readonly number[]} = {zoom: mars.camera.defaultZoom, sceneMatrix: matrix, counterRotation: matrix, counterRotationFor: () => matrix, controlPitch: mars.camera.defaultControlPitchDegrees, controlYaw: mars.camera.defaultControlYawDegrees,
    sunViewDirection: direction, skySunViewDirection: viewSunDirectionToPreparedLightDirection(direction) };
  value.reference = value; return value;
}
function fixture() {
  const f = retainedPresentationFixture(mars), element = f.document.createElement("s");
  const resources = { ...f.resources, has: () => true, readyKeys: () => [] };
  return { ...f, element, resources, publisher: createPreparedMaterialPublisher(track, element as unknown as HTMLElement, mars.camera) };
}

test("the actual Mars material covers the complete phase sphere with two disjoint shadow modes", t => {
  const f = fixture(); t.after(f.restore);
  assert.equal(frameCount, bankLength * 2);
  for (const [direction, phase] of [[[0, 0, -1], 0], [[0, 0, 1], phaseMaximum],
    [[1, 0, 0], Math.round(phaseMaximum / 2)], [[0, 1, 0], Math.round(phaseMaximum / 2)],
    [[-1, 0, 0], Math.round(phaseMaximum / 2)], [[0, -1, 0], Math.round(phaseMaximum / 2)]] as const) {
    for (const shadows of [true, false]) {
      const state = preparedMaterialState(track, selected(shadows), view(direction));
      assert.equal(state.calculatedFrame, phase); assert.equal(state.frame, phase + (shadows ? 0 : bankLength));
      f.publisher.publish(selected(shadows), view(direction), f.resources);
      const observed = f.publisher.observe();
      assert.equal(observed.calculatedFrame, phase); assert.equal(observed.appliedFrame, state.frame);
      assert.ok(Math.abs(observed.lightRollDegrees - roll(direction)) < 1e-10);
      assert.equal(f.element.style.rotate, `${observed.lightRollDegrees}deg`);
    }
  }
});
test("missing native addresses retain the applied image and rotation together", t => {
  const f = fixture(); t.after(f.restore); const selection = selected(false);
  f.publisher.publish(selection, view([1, 0, 0]), f.resources);
  const properties = ["backgroundImage", "backgroundPosition", "backgroundSize", "rotate"];
  const before = properties.map(name => f.element.style[name]), observed = f.publisher.observe();
  assert.ok(observed.addressWrites > 0);
  f.publisher.publish(selection, view([0, 1, 0]), { ...f.resources, has: () => false, url() { throw new Error("Missing data cannot be addressed"); } });
  assert.deepEqual(properties.map(name => f.element.style[name]), before);
  assert.equal(f.publisher.observe().appliedFrame, observed.appliedFrame);
  assert.equal(f.publisher.observe().addressWrites, observed.addressWrites);
  assert.equal(f.publisher.observe().transformWrites, observed.transformWrites);
  f.publisher.publish(selection, view([1, 0, 0]), f.resources);
  assert.equal(f.publisher.observe().addressWrites, observed.addressWrites);
  f.publisher.publish(selection, view([0, 1, 0]), f.resources);
  assert.notEqual(f.element.style.rotate, before[3]);
});
test("a missing decoded URL fails before native image or rotation publication", t => {
  const f = fixture(); t.after(f.restore); const selection = selected(true);
  f.publisher.publish(selection, view([1, 0, 0]), f.resources);
  const before = [f.element.style.backgroundImage, f.element.style.rotate];
  assert.throws(() => f.publisher.publish(selection, view([0, 1, 0]), { ...f.resources, has: () => true, url: () => null }), /no decoded URL/);
  assert.deepEqual([f.element.style.backgroundImage, f.element.style.rotate], before);
});
test("the generic contract rejects invalid or overlapping prepared frame offsets", () => {
  requireObjectRuntimeDefinition(mars);
  for (const frameOffset of [-1, 0.5, 1, bankLength - 1, bankLength + 1, frameCount]) {
    const invalid = structuredClone(mars);
    const variant = invalid.variants.find(variant => variant.when.shadows === false); assert.ok(variant);
    Reflect.set(variant.materials[0], "frameOffset", frameOffset);
    assert.throws(() => requireObjectRuntimeDefinition(invalid), /offset/);
  }
});
test("preparation rejects invalid material phase and rotation data", () => {
  const mutations: ((record: Record<string, unknown>) => void)[] = [
    record => { const thresholds = requireArray(requireRecord(record.frame).thresholds); thresholds[1] = thresholds[0]; },
    record => { requireArray(requireRecord(record.frame).thresholds)[0] = Infinity; },
    record => { requireRecord(record.frame).count = 0; },
    record => { requireRecord(record.rotation).baseDegrees = NaN; },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(mars); mutate(requireRecord(invalid.materials[0]));
    assert.throws(() => requireObjectRuntimeDefinition(invalid), /Prepared presentation/);
  }
});
