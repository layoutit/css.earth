import { runPreparationSteps } from "../../../platform/preparation-runner.mjs";

const steps = Object.freeze([
  ["verify-source-manifest.mjs", "--probe"],
  ["prepare-title.mjs"],
  ["prepare-starfield.mjs"],
  ["prepare-sky-sun.mjs"],
  ["prepare-body.mjs"],
  ["prepare-lighting.mjs"],
  ["prepare-camera.mjs"],
  ["prepare-moons.mjs"],
  ["prepare-panel-content.mjs"],
  ["prepare-atmosphere-spectrum.mjs"],
  ["prepare-temperature-pressure.mjs"],
  ["prepare-lenses.mjs"],
  ["prepare-runtime-asset-manifest.mjs"],
]);

await runPreparationSteps({
  objectName: "Mars",
  toolDirectory: import.meta.dirname,
  steps,
});
