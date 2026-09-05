import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../../../../site/runtime-policy.mjs";
import { viewSunDirectionToPreparedLightDirection } from "../../../platform/directional-sun-coordinate.mjs";
import { preparedIlluminationState } from "../../../platform/prepared-illumination.mjs";
import { PREPARED_MARS_LIGHTING } from "./preparedLighting.mjs";

export const materialBank = PREPARED_MARS_LIGHTING.banks[String(CANONICAL_PREPARED_IMAGE_DENSITY)];
export function materialIlluminationFor(selection, view) {
  return preparedIlluminationState(PREPARED_MARS_LIGHTING,
    viewSunDirectionToPreparedLightDirection(view.skySunViewDirection), selection.shadows);
}
export function materialFrameFor(selection, view) {
  return materialIlluminationFor(selection, view).frame;
}
