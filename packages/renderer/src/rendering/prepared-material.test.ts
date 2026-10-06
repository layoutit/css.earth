import { type PreparedMaterialTrack, type PreparedMaterialSelection } from '@cssearth/objects';

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { preparedMaterialFrame, preparedMaterialState, preparedMaterialAddress } from './prepared-material.js';

import { resolvePreparedMaterialDemand } from "./prepared-material-demand.js";
import { mercuryPhaseMapping, venusPhaseMapping } from "./prepared-material-fixtures.js";

const view = (z: number) => ({ sunViewDirection: [Math.sqrt(1 - z * z), 0, z], sceneMatrix: "moved",
  reference: { sceneMatrix: "initial", sunViewDirection: [0, 0, 1] } });
const address = (frame: number, resource: string | null) => ({ resource, frame, row: null,
  backgroundPosition: "-7.1875px -7.1875px", backgroundSize: "7590px 3795px", prewarm: [] });
// One sheet holds every frame; the flood-lit frame a body shows with shadows off is a file of its own.
const track: PreparedMaterialTrack = { id: "lighting", target: 0, defaultFrame: 127, frame: mercuryPhaseMapping,
  banks: [{ id: "sheet", frames: Array.from({ length: 128 }, (_, frame) => address(frame, "lighting")),
    fixed: address(127, "shadowless"), default: address(127, "initial") }] };
const selected: PreparedMaterialSelection = { track: "lighting", bank: "sheet", mode: "frames", enabled: true, rotationEnabled: true, fixedMode: "shadowless" };

test("Mercury and Venus preserve their actual prepared phase thresholds across camera roll", () => {
  for (const mapping of [mercuryPhaseMapping, venusPhaseMapping]) {
    for (const z of [-1, -0.8, -0.2, 0, 0.3, 0.8, 1]) {
      const expected = preparedMaterialFrame(mapping, view(z)), radius = Math.sqrt(1 - z * z);
      for (const degrees of [45, 90, 180, 270]) {
        const radians = degrees * Math.PI / 180;
        assert.equal(preparedMaterialFrame(mapping, { sunViewDirection: [radius * Math.cos(radians), radius * Math.sin(radians), z] }), expected);
      }
    }
    assert.equal(preparedMaterialFrame(mapping, view(-1)), 0);
    assert.equal(preparedMaterialFrame(mapping, view(1)), mapping.indices[mapping.indices.length - 1]);
    mapping.thresholds.forEach((threshold, index) => {
      assert.equal(preparedMaterialFrame(mapping, view(threshold - 1e-12)), mapping.indices[index]);
      assert.equal(preparedMaterialFrame(mapping, view(threshold)), mapping.indices[index + 1]);
    });
  }
});

test("material demand follows ready addresses and fixed shadows, and one sheet serves every distance", () => {
  assert.deepEqual(resolvePreparedMaterialDemand(track, selected, view(-1)).required, ["lighting"]);
  const fixed = { ...selected, mode: "fixed" as const, frameOverride: 127, rotationEnabled: false };
  assert.deepEqual(resolvePreparedMaterialDemand(track, fixed, view(-1)).required, ["shadowless"]);
  const far = { ...view(-1), levelOfDetail: { stage: "billboard", silhouetteDiameter: 12, billboardOpacity: 1, markerOpacity: 0 } };
  assert.deepEqual(resolvePreparedMaterialDemand(track, selected, far), resolvePreparedMaterialDemand(track, selected, view(-1)));
  assert.deepEqual(resolvePreparedMaterialDemand(track, selected, view(1)).prewarm, []);
  const hidden = resolvePreparedMaterialDemand(track, { ...selected, enabled: false }, view(-1));
  assert.deepEqual(hidden.required, []);
  assert.deepEqual(hidden.prewarm, []);
  const shadowless = resolvePreparedMaterialDemand(track, { ...fixed, enabled: false, publishWhenHidden: "static" }, view(-1));
  assert.deepEqual(shadowless.required, ["shadowless"]);
  assert.deepEqual(shadowless.prewarm, []);
  assert.deepEqual(resolvePreparedMaterialDemand(track, { ...selected, enabled: false, publishWhenHidden: "static" }, view(-1)).required, []);
  assert.equal(preparedMaterialAddress(preparedMaterialState(track, selected, view(-1)), { has: () => false }), null);
});

test("prepared default addresses require the actual reference pose and Sun direction", () => {
  const reference = { sceneMatrix: "initial", sunViewDirection: [0, 0, 1] };
  assert.equal(preparedMaterialState(track, selected, { ...reference, reference }).mode, "default");
  assert.equal(preparedMaterialState(track, selected, { ...reference, reference, sceneMatrix: "rotated" }).mode, "directional");
  assert.equal(preparedMaterialState(track, selected, { ...reference, reference, sunViewDirection: [1, 0, 0] }).mode, "directional");
});
