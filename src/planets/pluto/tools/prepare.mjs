#!/usr/bin/env node

import { runPreparationSteps } from "../../../platform/preparation-runner.mjs";

const steps = Object.freeze([
  ["verify-source-manifest.mjs", "--probe"],
  ["prepare-title.mjs"],
  ["prepare-panel-content.mjs"],
  ["prepare-scene.mjs"],
  ["prepare-assets.mjs"],
  ["prepare-starfield.mjs"],
  ["prepare-sky-sun.mjs"],
  ["../../../../tools/prepare-object-controls.mjs", "--object=pluto"],
  ["prepare-presentation.mjs"],
  ["prepare-runtime-asset-manifest.mjs"],
]);

await runPreparationSteps({
  objectName: "Pluto",
  toolDirectory: import.meta.dirname,
  steps,
});
