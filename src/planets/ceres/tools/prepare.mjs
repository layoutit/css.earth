import { runPreparationSteps } from "../../../platform/preparation-runner.mjs";

await runPreparationSteps({ objectName: "Ceres", toolDirectory: import.meta.dirname, steps: [
  ["acquire.mjs", "--verify-only"],
  ["prepare-surfaces.mjs"],
  ["prepare-starfield.mjs"],
  ["prepare-sky-sun.mjs"],
  ["prepare-material.mjs"],
  ["prepare-content.mjs"],
  ["../../../../tools/prepare-object-controls.mjs", "--object=ceres"],
  ["prepare-scene.mjs"],
  ["prepare-presentation.mjs"],
] });
