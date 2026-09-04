import { runPreparationSteps } from "../../../platform/preparation-runner.mjs";

const steps = Object.freeze([
  ["verify-source-manifest.mjs", "--probe"],
  ["prepare-title.mjs"],
  ["prepare-assets.mjs"],
  ["optimize-runtime-assets.mjs"],
  ["prepare-weather-source.mjs"],
  ["prepare-atmosphere-spectrum.mjs"],
  ["prepare-scene.mjs", "--base"],
  ["prepare-moons.mjs"],
  ["prepare-moon-orbit-arcs.mjs"],
  ["prepare-panel-content.mjs"],
  ["prepare-lenses.mjs"],
  ["prepare-interior.mjs"],
  ["prepare-scene.mjs"],
  ["prepare-starfield.mjs"],
  ["prepare-sky-sun.mjs"],
  ["prepare-runtime-asset-manifest.mjs"],
]);

await runPreparationSteps({
  objectName: "Saturn",
  toolDirectory: import.meta.dirname,
  steps,
});
