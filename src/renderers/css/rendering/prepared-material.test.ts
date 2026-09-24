import { expect, test } from "vitest";
import { preparedMaterialFrame, preparedMaterialState, preparedMaterialAddress, type PreparedMaterialTrack, type PreparedMaterialSelection } from "./prepared-material.js";
import { resolvePreparedMaterialDemand } from "./prepared-material-demand.js";
import { mercuryPhaseMapping, venusPhaseMapping } from "./prepared-material-fixtures.js";

const view = (z: number) => ({ sunViewDirection: [Math.sqrt(1 - z * z), 0, z], sceneMatrix: "moved",
  reference: { sceneMatrix: "initial", sunViewDirection: [0, 0, 1] } });
const address = (frame: number, resource: string | null) => ({ resource, frame, row: Math.floor(frame / 8),
  backgroundPosition: "0px 0px", backgroundSize: "3680px 460px", prewarm: ["next"] });
const track: PreparedMaterialTrack = { id: "lighting", target: 0, defaultFrame: 230, frame: mercuryPhaseMapping, farBank: "billboard",
  banks: [{ id: "rows", frames: Array.from({ length: 256 }, (_, frame) => address(frame, `row:${Math.floor(frame / 8)}`)),
    fixed: address(255, "shadowless"), default: address(230, "initial") },
  { id: "billboard", frames: Array.from({ length: 256 }, (_, frame) => address(frame, "billboard")), fixed: address(255, "billboard") }] };
const selected: PreparedMaterialSelection = { track: "lighting", bank: "rows", mode: "frames", enabled: true, rotationEnabled: true, fixedMode: "shadowless" };

test("Mercury and Venus preserve their actual prepared phase thresholds across camera roll", () => {
  for (const mapping of [mercuryPhaseMapping, venusPhaseMapping]) {
    for (const z of [-1, -0.8, -0.2, 0, 0.3, 0.8, 1]) {
      const expected = preparedMaterialFrame(mapping, view(z)), radius = Math.sqrt(1 - z * z);
      for (const degrees of [45, 90, 180, 270]) {
        const radians = degrees * Math.PI / 180;
        expect(preparedMaterialFrame(mapping, { sunViewDirection: [radius * Math.cos(radians), radius * Math.sin(radians), z] })).toBe(expected);
      }
    }
    expect(preparedMaterialFrame(mapping, view(-1))).toBe(0);
    expect(preparedMaterialFrame(mapping, view(1))).toBe(mapping.indices[mapping.indices.length - 1]);
    mapping.thresholds.forEach((threshold, index) => {
      expect(preparedMaterialFrame(mapping, view(threshold - 1e-12))).toBe(mapping.indices[index]);
      expect(preparedMaterialFrame(mapping, view(threshold))).toBe(mapping.indices[index + 1]);
    });
  }
});

test("material demand follows ready addresses, fixed shadows and the geometry-to-billboard bank", () => {
  expect(resolvePreparedMaterialDemand(track, selected, view(-1)).required).toEqual(["row:0"]);
  const fixed = { ...selected, mode: "fixed" as const, frameOverride: 255, rotationEnabled: false };
  expect(resolvePreparedMaterialDemand(track, fixed, view(-1)).required).toEqual(["shadowless"]);
  expect(resolvePreparedMaterialDemand(track, selected, { ...view(-1), levelOfDetail: { stage: "billboard", silhouetteDiameter: 12, billboardOpacity: 1, markerOpacity: 0 } }).required).toEqual(["billboard"]);
  const hidden = resolvePreparedMaterialDemand(track, { ...selected, enabled: false }, view(-1));
  expect(hidden.required).toEqual([]);
  expect(hidden.prewarm).toEqual([]);
  const shadowless = resolvePreparedMaterialDemand(track, { ...fixed, enabled: false, publishWhenHidden: "static" }, view(-1));
  expect(shadowless.required).toEqual(["shadowless"]);
  expect(shadowless.prewarm).toEqual([]);
  expect(resolvePreparedMaterialDemand(track, { ...selected, enabled: false, publishWhenHidden: "static" }, view(-1)).required).toEqual([]);
  expect(preparedMaterialAddress(preparedMaterialState(track, selected, view(-1)), { has: () => false })).toBeNull();
});

test("prepared default addresses require the actual reference pose and Sun direction", () => {
  const reference = { sceneMatrix: "initial", sunViewDirection: [0, 0, 1] };
  expect(preparedMaterialState(track, selected, { ...reference, reference }).mode).toBe("default");
  expect(preparedMaterialState(track, selected, { ...reference, reference, sceneMatrix: "rotated" }).mode).toBe("directional");
  expect(preparedMaterialState(track, selected, { ...reference, reference, sunViewDirection: [1, 0, 0] }).mode).toBe("directional");
});
