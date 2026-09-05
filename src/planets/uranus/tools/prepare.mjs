import { runPreparationSteps } from "../../../platform/preparation-runner.mjs";

const steps = Object.freeze([
  ["verify-source-manifest.mjs", "--probe"],
  ["prepare-title.mjs"],
  ["prepare-scene.mjs"],
  ["prepare-moon-orbit-arcs.mjs"],
  ["prepare-panel-content.mjs"],
  ["prepare-charts.mjs"],
  ["prepare-starfield.mjs"],
  ["prepare-sky-sun.mjs"],
  ["../../../../tools/prepare-object-controls.mjs", "--object=uranus"],
  ["prepare-presentation.mjs"],
  ["prepare-runtime-asset-manifest.mjs"],
]);

await runPreparationSteps({
  objectName: "Uranus",
  toolDirectory: import.meta.dirname,
  steps,
});
