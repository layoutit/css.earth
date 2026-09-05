import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../../../../site/runtime-policy.mjs";
import { PREPARED_URANUS_RUNTIME_SCENE } from "./preparedSceneRuntime.mjs";
import { cameraPlan } from "./camera-plan.mjs";

const density = String(CANONICAL_PREPARED_IMAGE_DENSITY);
export const preparedAssets = PREPARED_URANUS_RUNTIME_SCENE.assets;
export const materialRows = Object.freeze(Object.fromEntries(Object.entries(preparedAssets.materialViewBank)
  .map(([id, bank]) => [id, bank[density].rows])));
export function surfaceAssets(id) {
  const surface = preparedAssets.surfaces[id][density];
  return { surface: surface.surface, poles: surface.poles,
    defaultMaterial: preparedAssets.fixedMaterial[id][density], shadowlessMaterial: preparedAssets.shadowlessMaterial[id][density],
    ring: preparedAssets.rings[density], ringShadow: preparedAssets.rings.shadow[density] };
}
export function materialFor(selection, view, previousPlan) {
  const lighting = PREPARED_URANUS_RUNTIME_SCENE.preparedLighting;
  const defaultFrame = Math.round(cameraPlan.defaultControlPitchDegrees / cameraPlan.maximumControlPitchDegrees * (lighting.frameCount - 1));
  const frame = Math.round(Math.max(0, Math.min(lighting.frameCount - 1, defaultFrame +
    (view.reference.sunViewDirection[2] - view.sunViewDirection[2]) * ((lighting.frameCount - 1) / 2))));
  const mode = !selection.shadows ? "shadowless" : Math.abs(view.controlPitch - cameraPlan.defaultControlPitchDegrees) < 0.01 ? "default" : "directional";
  // The shared selection's last committed plan owns the hidden neighborhood.
  // Camera movement while the shadowless material is displayed does not create
  // unnecessary row requests or an object-local cache cursor.
  const row = mode === "shadowless" && previousPlan?.presentationMode === "shadowless" && previousPlan.lensId === selection.lensId
    ? previousPlan.materialRow : lighting.presentations[frame].rowIndex;
  return { lensId: selection.lensId, materialFrame: frame, materialRow: row, presentationMode: mode, effectiveFrame: selection.shadows ? frame : -1 };
}
export function neighborhood(id, row) {
  const rows = materialRows[id];
  return [...new Set([row - 1, row, row + 1].map(index => Math.max(0, Math.min(rows.length - 1, index))))]
    .map(index => `row:${id}:${index}`);
}
