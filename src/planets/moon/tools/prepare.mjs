#!/usr/bin/env node

import { runPreparationSteps } from "../../../platform/preparation-runner.mjs";

const steps = Object.freeze([
  ["verify-source-manifest.mjs", "--probe"],
  ["prepare-title.mjs"],
  ["prepare-panel-content.mjs"],
  ["prepare-assets.mjs"],
  ["prepare-starfield.mjs"],
  ["prepare-sky-sun.mjs"],
  ["prepare-scene.mjs"],
  ["prepare-runtime-asset-manifest.mjs"],
]);

await runPreparationSteps({
  objectName: "Moon",
  toolDirectory: import.meta.dirname,
  steps,
});
