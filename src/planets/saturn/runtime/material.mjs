import { PREPARED_SATURN_RUNTIME_SCENE as scene } from "./preparedSceneRuntime.mjs";
import { PREPARED_SATURN_LENSES } from "./preparedLenses.mjs";
import { cameraPlan } from "./camera-plan.mjs";
export const exteriorAtlas = scene.preparedLighting.orbitAtlas.runtimeShards;
export const interiorAtlas = scene.interior.atmosphere.runtimeShards;
export function variantFor(selection) {
  const lens = PREPARED_SATURN_LENSES.controls.find(lens => lens.id === selection.lensId);
  const mode = !selection.rings ? selection.shadows ? "ringless" : "ringless-no-shadows" : selection.shadows ? "full" : "no-shadows";
  return mode === "full" ? lens.materialLens : `${lens.materialLens}-${mode}`;
}
export function materialState(selection, view) {
  const plan = scene.preparedLighting.orbitAtlas;
  const defaultFrame = Math.round(Math.max(0, Math.min(plan.frameCount - 1,
    (plan.maximumScenePitchDegrees - cameraPlan.initialScenePitchDegrees) /
    (plan.maximumScenePitchDegrees - plan.minimumScenePitchDegrees) * (plan.frameCount - 1))));
  const materialFrame = Math.round(Math.max(0, Math.min(plan.frameCount - 1,
    defaultFrame + (view.reference.sunViewDirection[2] - view.sunViewDirection[2]) * ((plan.frameCount - 1) / 2))));
  const useDefault = Math.abs(view.controlPitch - cameraPlan.defaultControlPitchDegrees) < 0.01 &&
    Math.abs(view.controlYaw - cameraPlan.defaultControlYawDegrees) < 0.01;
  return { variantId: variantFor(selection), materialFrame, useDefault,
    interiorFrame: Math.round(materialFrame / Math.max(1, plan.frameCount - 1) * (scene.interior.atmosphere.frameCount - 1)) };
}
