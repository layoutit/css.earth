import assert from "node:assert/strict";
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { DATASET_LABELS, prepareDatasetLabels } from '@cssearth/bake/objects/content';

test("names arbitrary dataset IDs without changing source data or assuming a fixed set of concepts", () => {
  const source = {
    defaultDataset: "normal",
    controls: [
      { id: "normal", label: "750 nm", title: "Instrument at 750 nm", thumbnailUrl: "/mono.webp" },
      { id: "height-survey", label: "Topography", title: "Topography: stereo model", legend: { meta: "km" } },
      { id: "cut", label: "Interior", title: "Interior" },
      { id: "ir", label: "Thermal", title: "Thermal, source-informed model" },
      { id: "new-measurement", label: "Ice thickness", title: "Topography is used to estimate ice thickness" },
    ],
  };
  const original = structuredClone(source);
  const result = prepareDatasetLabels(source, {
    normal: DATASET_LABELS.monochrome,
    "height-survey": DATASET_LABELS.elevation,
    cut: DATASET_LABELS.crossSection,
    ir: DATASET_LABELS.thermalInfrared,
  });
  assert.deepEqual(result.controls.map(({ label, title }) => [label, title]), [
    ["Monochrome", "Instrument at 750 nm"],
    ["Elevation", "Topography: stereo model"],
    ["Cross section", "Interior"],
    ["Thermal infrared", "Thermal, source-informed model"],
    ["Ice thickness", "Topography is used to estimate ice thickness"],
  ]);
  const withoutNames = (datasets: typeof source) => ({ ...datasets, controls: datasets.controls.map(({ label, ...data }) => data) });
  assert.deepEqual(withoutNames(result), withoutNames(source));
  assert.deepEqual(source, original);
});
