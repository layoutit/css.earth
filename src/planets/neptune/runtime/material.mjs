import { cameraPlan } from "./camera-plan.mjs";
import { PREPARED_NEPTUNE_LENSES } from "./preparedLenses.mjs";
export function materialFor(selection, view) {
  const lens = PREPARED_NEPTUNE_LENSES.controls.find(lens => lens.id === selection.lensId);
  const orbit = lens.orbitMaterial;
  const base = Math.round((orbit.maximumScenePitchDegrees - cameraPlan.initialScenePitchDegrees) /
    (orbit.maximumScenePitchDegrees - orbit.minimumScenePitchDegrees) * (orbit.frameCount - 1));
  const frame = Math.round(Math.max(0, Math.min(255, base + (view.reference.sunViewDirection[2] - view.sunViewDirection[2]) * 127.5)));
  const useDefault = Math.abs(view.controlPitch - cameraPlan.defaultControlPitchDegrees) < 0.01;
  return { frame, useDefault, rowKey: `lighting:${lens.id}:${orbit.presentations[frame].rowIndex}`,
    mode: !selection.shadows ? "shadowlessMaterial" : useDefault ? "material" : "directional", lens };
}
