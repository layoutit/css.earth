import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { LENS_LABELS, prepareLensLabels } from "../prepare-lens-labels.mts";

test("names arbitrary lens IDs without changing source data or assuming a fixed set of concepts", () => {
  const source = {
    defaultLens: "normal",
    controls: [
      { id: "normal", label: "750 nm", title: "Instrument at 750 nm", thumbnailUrl: "/mono.webp" },
      { id: "height-survey", label: "Topography", title: "Topography: stereo model", legend: { meta: "km" } },
      { id: "cut", label: "Interior", title: "Interior" },
      { id: "ir", label: "Thermal", title: "Thermal, source-informed model" },
      { id: "new-measurement", label: "Ice thickness", title: "Topography is used to estimate ice thickness" },
    ],
  };
  const original = structuredClone(source);
  const result = prepareLensLabels(source, {
    normal: LENS_LABELS.monochrome,
    "height-survey": LENS_LABELS.elevation,
    cut: LENS_LABELS.crossSection,
    ir: LENS_LABELS.thermalInfrared,
  });
  assert.deepEqual(result.controls.map(({ label, title }) => [label, title]), [
    ["Monochrome", "Instrument at 750 nm"],
    ["Elevation", "Topography: stereo model"],
    ["Cross section", "Interior"],
    ["Thermal infrared", "Thermal, source-informed model"],
    ["Ice thickness", "Topography is used to estimate ice thickness"],
  ]);
  const withoutNames = (lenses: typeof source) => ({ ...lenses, controls: lenses.controls.map(({ label, ...data }) => data) });
  assert.deepEqual(withoutNames(result), withoutNames(source));
  assert.deepEqual(source, original);
});
