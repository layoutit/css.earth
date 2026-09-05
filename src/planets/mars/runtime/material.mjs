import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../../../../site/runtime-policy.mjs";
import { viewSunDirectionToPreparedLightDirection } from "../../../platform/directional-sun-coordinate.mjs";
import { PREPARED_MARS_LIGHTING } from "./preparedLighting.mjs";

export const materialBank = PREPARED_MARS_LIGHTING.banks[String(CANONICAL_PREPARED_IMAGE_DENSITY)];
export function materialFrameFor(selection, view) {
  const lighting = PREPARED_MARS_LIGHTING;
  if (!selection.shadows) return lighting.frameCount - 1;
  const direction = viewSunDirectionToPreparedLightDirection(view.skySunViewDirection);
  return Math.round(Math.max(0, Math.min(1, (direction[2] - lighting.minimumLightViewZ) /
    (lighting.maximumLightViewZ - lighting.minimumLightViewZ))) * (lighting.frameCount - 1));
}
