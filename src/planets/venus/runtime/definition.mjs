import { OBJECT_RUNTIME_SCHEMA, initialObjectSelection, reduceObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_VENUS_SCENE } from "./preparedScene.mjs";
import { PREPARED_VENUS_LENSES } from "./preparedLenses.mjs";
import { PREPARED_VENUS_SKY_SUN } from "./preparedSkySun.mjs";
import { createPresentation } from "./presentation.mjs";

const layers = ["surface", "poles", "material"];
const warm = [...preparedSkyResources(PREPARED_VENUS_SCENE.starfield, PREPARED_VENUS_SKY_SUN, "warm"),
  { key: "lighting", url: canonicalPreparedAsset(PREPARED_VENUS_SCENE.material.lightingUrl, PREPARED_VENUS_SCENE.material.lighting2xUrl), pool: "warm" }];
const entries = [...warm, ...PREPARED_VENUS_LENSES.controls.flatMap(lens => layers.map(layer => ({
  key: `${layer}:${lens.id}`, url: canonicalPreparedAsset(lens[`${layer}Url`], lens[`${layer}2xUrl`]), pool: "material",
})))];
const required = lens => layers.map(layer => `${layer}:${lens}`);
export const runtimeDefinition = Object.freeze({
  schema: OBJECT_RUNTIME_SCHEMA, id: "venus", controls: objectControls,
  camera: PREPARED_VENUS_SCENE.camera, sky: PREPARED_VENUS_SCENE.starfield, sun: PREPARED_VENUS_SKY_SUN,
  inputSelector: ".venus-input-surface",
  assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm" }),
    preparedResourcePool("material", entries, { retention: "selection", capacity: 6, concurrency: 6 })],
    startup: [...warm.map(entry => entry.key), ...required(PREPARED_VENUS_LENSES.defaultLens)] },
  initialSelection: initialObjectSelection(objectControls), reduceSelection: reduceObjectSelection,
  resolvePresentation: ({ selection }) => ({ required: required(selection.lensId) }),
  createPresentation,
});
