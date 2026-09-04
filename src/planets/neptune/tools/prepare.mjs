import { runPreparationSteps } from "../../../platform/preparation-runner.mjs";

await runPreparationSteps({
  objectName: "Neptune",
  toolDirectory: import.meta.dirname,
  steps: Object.freeze([
    ["verify-source-manifest.mjs", "--probe"],
    ["prepare-title.mjs"],
    ["prepare-panel-content.mjs"],
    ["prepare-atmosphere-spectrum.mjs"],
    ["prepare-scene.mjs"],
    ["prepare-moon-orbit-arcs.mjs"],
    ["prepare-orbit.mjs"],
    ["prepare-starfield.mjs"],
    ["prepare-sky-sun.mjs"],
    ["prepare-runtime-asset-manifest.mjs"],
  ]),
});
