import { OBJECT_RUNTIME_SCHEMA, initialObjectSelection, reduceObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_SUN_SCENE } from "./preparedScene.mjs";
import { PREPARED_SUN_LENSES } from "./preparedLenses.mjs";
import { createPresentation } from "./presentation.mjs";

const layers = ["surface", "poles", "corona", "limb"];
const celestial = preparedSkyResources(PREPARED_SUN_SCENE.starfield, null, "warm");
const entries = [...celestial, ...PREPARED_SUN_LENSES.controls.flatMap(lens => layers.map(layer => ({
  key: `${layer}:${lens.id}`, url: canonicalPreparedAsset(lens[`${layer}Url`], lens[`${layer}2xUrl`]), pool: "material",
})))];
const required = lens => layers.map(layer => `${layer}:${lens}`);

export const runtimeDefinition = Object.freeze({
  schema: OBJECT_RUNTIME_SCHEMA, id: "sun", controls: objectControls,
  camera: PREPARED_SUN_SCENE.camera, sky: PREPARED_SUN_SCENE.starfield, sun: null,
  inputSelector: ".sun-input-surface",
  assets: { entries, pools: [
    preparedResourcePool("warm", entries, { retention: "warm" }),
    preparedResourcePool("material", entries, { retention: "selection", capacity: 8, concurrency: 8 }),
  ], startup: [...celestial.map(entry => entry.key), ...required(PREPARED_SUN_LENSES.defaultLens)] },
  initialSelection: initialObjectSelection(objectControls), reduceSelection: reduceObjectSelection,
  resolvePresentation: ({ selection }) => ({ required: required(selection.lensId) }),
  createPresentation,
});
