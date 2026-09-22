import type { DirectionalSunPresentation, PreparedDirectionalSunPlan } from "./directional-sun-contract.mts";
import {
  DIRECTIONAL_SUN_PRESENTATION_STANDARD,
  PREPARED_DIRECTIONAL_SUN_SCHEMA,
  validateDirectionalSunPlan,
  validateDirectionalSunPresentationStandard,
} from "./directional-sun-contract.mts";

export interface DirectionalSunPreparationOptions {
  presentation?: DirectionalSunPresentation; planMetadata?: Readonly<Record<string, unknown>>;
}

/** Prepare the Sun directions an object's camera and materials read. The shared universe draws the visible Sun, so
 * the object bakes no Sun image. */
export function prepareDirectionalSun({
  presentation = DIRECTIONAL_SUN_PRESENTATION_STANDARD,
  planMetadata = Object.freeze({}),
}: DirectionalSunPreparationOptions = {}): PreparedDirectionalSunPlan {
  validateDirectionalSunPresentationStandard(presentation);
  if (planMetadata === null || typeof planMetadata !== "object") {
    throw new TypeError("Planet directional Sun preparation is invalid.");
  }
  return validateDirectionalSunPlan(Object.freeze({
    schema: PREPARED_DIRECTIONAL_SUN_SCHEMA,
    model: "prepared-sun-direction-for-the-shared-universe",
    localDirection: Object.freeze([...presentation.localDirection]),
    referenceViewDirection: Object.freeze([...presentation.referenceViewDirection]),
    provenance: Object.freeze({
      source: presentation.source,
      sourcePath: presentation.sourcePath,
      qualification: presentation.qualification,
    }),
    ...planMetadata,
  }));
}
