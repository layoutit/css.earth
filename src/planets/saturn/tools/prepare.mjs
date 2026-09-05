import { runPreparationSteps } from "../../../platform/preparation-runner.mjs";

const steps = Object.freeze([
  ["verify-source-manifest.mjs", "--probe"],
  ["prepare-title.mjs"],
  // These encoded images are retained runtime assets and material inputs.
  // Keep prepare-assets' accepted bytes, including RGB below transparent texels.
  ["prepare-assets.mjs"],
  ["prepare-weather-source.mjs"],
  ["prepare-atmosphere-spectrum.mjs"],
  ["prepare-scene.mjs", "--base"],
  ["prepare-moons.mjs"],
  ["prepare-moon-orbit-arcs.mjs"],
  ["prepare-panel-content.mjs"],
  ["prepare-lenses.mjs"],
  ["prepare-interior.mjs"],
  ["prepare-scene.mjs", "--compose"],
  ["prepare-leaf-layouts.mjs"],
  ["prepare-starfield.mjs"],
  ["prepare-sky-sun.mjs"],
  ["prepare-presentation.mjs"],
  ["prepare-runtime-asset-manifest.mjs"],
]);

await runPreparationSteps({
  objectName: "Saturn",
  toolDirectory: import.meta.dirname,
  steps,
});
