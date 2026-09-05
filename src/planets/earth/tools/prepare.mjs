#!/usr/bin/env node

import { runPreparationSteps } from "../../../platform/preparation-runner.mjs";

const steps = Object.freeze([
  ["verify-source-manifest.mjs"],
  ["prepare-editorial.mjs"],
  ["prepare-title.mjs"],
  ["prepare-assets.mjs"],
  ["prepare-atmosphere-charts.mjs"],
  ["prepare-panel-content.mjs"],
  ["prepare-scene.mjs"],
  ["prepare-noise-lens.mjs"],
  ["prepare-lenses.mjs"],
  ["prepare-global-wmts.mjs"],
  ["integrate-global-wmts.mjs", "--latest"],
  ["prepare-places.mjs"],
  ["prepare-starfield.mjs"],
  ["prepare-sky-sun.mjs"],
  ["prepare-runtime-asset-manifest.mjs"],
]);

await runPreparationSteps({
  objectName: "Earth",
  toolDirectory: import.meta.dirname,
  steps,
});
