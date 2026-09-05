import { mountPreparedSphereBands } from "../../../platform/prepared-sphere-bands.mjs";
import { PREPARED_PLUTO_SCENE } from "./preparedScene.mjs";
import { PREPARED_PLUTO_LENSES } from "./preparedLenses.mjs";

export function createPresentation(stage, context) {
  return mountPreparedSphereBands(stage, context, { plan: PREPARED_PLUTO_SCENE,
    lenses: PREPARED_PLUTO_LENSES, prefix: "pluto", schema: "csspluto-prepared-retained-scene@1" });
}
