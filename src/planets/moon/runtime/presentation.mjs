import { mountPreparedSphereBands } from "../../../platform/prepared-sphere-bands.mjs";
import { PREPARED_MOON_SCENE } from "./preparedScene.mjs";
import { PREPARED_MOON_LENSES } from "./preparedLenses.mjs";

export function createPresentation(stage, context) {
  return mountPreparedSphereBands(stage, context, { plan: PREPARED_MOON_SCENE,
    lenses: PREPARED_MOON_LENSES, prefix: "moon", schema: "cssmoon-prepared-retained-scene@1" });
}
