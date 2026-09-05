import { preparedScenePitch } from "../../../platform/cubic-sky-runtime.mjs";
import { PREPARED_JUPITER_CAMERA } from "./preparedCamera.mjs";
import { PREPARED_JUPITER_LIGHTING } from "./preparedLighting.mjs";

export function materialFrameFor(view) {
  const plan = PREPARED_JUPITER_LIGHTING;
  const pitch = preparedScenePitch(view.controlPitch, PREPARED_JUPITER_CAMERA);
  return Math.round(Math.max(0, Math.min(plan.frameCount - 1,
    (pitch - plan.minimumPitchDegrees) / plan.pitchStepDegrees)));
}
export function materialDemand(selection, view, previousPlan) {
  if (!selection.shadows) return { required: ["shadowless"], prewarm: [], materialFrame: previousPlan?.materialFrame ?? PREPARED_JUPITER_LIGHTING.transport.defaultFrame };
  const plan = PREPARED_JUPITER_LIGHTING, frame = materialFrameFor(view);
  const previous = previousPlan?.materialFrame ?? plan.transport.defaultFrame;
  const direction = Math.sign(frame - previous), row = plan.presentations[frame].rowIndex;
  const prewarm = [];
  for (let distance = 1; direction && distance < plan.transport.maximumRetainedRowCount; distance++) {
    const next = Math.max(0, Math.min(plan.rows.length - 1, row + direction * distance));
    const key = `lighting:${next}`;
    if (next !== row && !prewarm.includes(key)) prewarm.push(key);
  }
  return { required: [`lighting:${row}`], prewarm, materialFrame: frame };
}
