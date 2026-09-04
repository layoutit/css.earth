#!/usr/bin/env node

import { runPreparationSteps } from "../../../platform/preparation-runner.mjs";

await runPreparationSteps({
  objectName: "Venus",
  toolDirectory: import.meta.dirname,
  steps: Object.freeze([
    ["verify-source-manifest.mjs", "--probe"],
    ["prepare-title.mjs"],
    ["prepare-assets.mjs"],
    ["prepare-charts.mjs"],
    ["prepare-panel-content.mjs"],
    ["prepare-surface-gallery.mjs"],
    ["prepare-lenses.mjs"],
    ["prepare-starfield.mjs"],
    ["prepare-sky-sun.mjs"],
    ["prepare-scene.mjs"],
    ["prepare-runtime-asset-manifest.mjs"],
  ]),
});
