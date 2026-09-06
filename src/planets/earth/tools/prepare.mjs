#!/usr/bin/env node

import { runPreparationSteps } from "../../../platform/preparation-runner.mjs";

const steps = Object.freeze([
  ["verify-source-manifest.mjs"],
  ["prepare-editorial.mjs"],
  ["prepare-title.mjs"],
  ["prepare-scene.mjs"],
  ["prepare-assets.mjs"],
  ["prepare-atmosphere-charts.mjs"],
  ["prepare-panel-content.mjs"],
  ["prepare-noise-lens.mjs"],
  ["prepare-lenses.mjs"],
  ["prepare-pinned-global-wmts.mjs"],
  ["prepare-land-cover-lens.mjs"],
  ["prepare-geographic-lenses.mjs"],
  ["prepare-places.mjs"],
  ["prepare-starfield.mjs"],
  ["prepare-sky-sun.mjs"],
  ["../../../../tools/prepare-object-controls.mjs", "--object=earth"],
  ["prepare-presentation.mjs"],
  ["prepare-runtime-asset-manifest.mjs"],
]);

await runPreparationSteps({
  objectName: "Earth",
  toolDirectory: import.meta.dirname,
  steps,
});
