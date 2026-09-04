#!/usr/bin/env node

import { runPreparationSteps } from "../../../platform/preparation-runner.mjs";

await runPreparationSteps({
  objectName: "Sun",
  toolDirectory: import.meta.dirname,
  steps: Object.freeze([
    ["verify-source-manifest.mjs", "--probe"],
    ["prepare-title.mjs"],
    ["prepare-assets.mjs"],
    ["prepare-starfield.mjs"],
    ["prepare-panel-content.mjs"],
    ["prepare-lenses.mjs"],
    ["prepare-scene.mjs"],
    ["prepare-runtime-asset-manifest.mjs"],
  ]),
});
