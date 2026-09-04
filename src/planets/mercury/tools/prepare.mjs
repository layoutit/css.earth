import { runPreparationSteps } from "../../../platform/preparation-runner.mjs";

const steps = Object.freeze([
  ["verify-source-manifest.mjs", "--probe"],
  ["prepare-title.mjs"],
  ["prepare-panel-content.mjs"],
  ["prepare-assets.mjs"],
  ["prepare-starfield.mjs"],
  ["prepare-sky-sun.mjs"],
  ["prepare-lenses.mjs"],
  ["prepare-charts.mjs"],
  ["prepare-scene.mjs"],
  ["prepare-runtime-asset-manifest.mjs"],
]);

await runPreparationSteps({
  objectName: "Mercury",
  toolDirectory: import.meta.dirname,
  steps,
});
