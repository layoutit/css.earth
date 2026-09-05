import { OBJECT_RUNTIME_SCHEMA, initialObjectSelection, reduceObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_PLUTO_SCENE } from "./preparedScene.mjs";
import { PREPARED_PLUTO_LENSES } from "./preparedLenses.mjs";
import { PREPARED_PLUTO_STARFIELD } from "./preparedStarfield.mjs";
import { PREPARED_PLUTO_SKY_SUN } from "./preparedSkySun.mjs";
import { createPresentation } from "./presentation.mjs";

const celestial = preparedSkyResources(PREPARED_PLUTO_STARFIELD, PREPARED_PLUTO_SKY_SUN, "mounted");
const entries = [
  ...celestial,
  { key: "curvature", url: canonicalPreparedAsset(PREPARED_PLUTO_LENSES.material), pool: "mounted" },
  ...PREPARED_PLUTO_LENSES.controls.flatMap(lens => [
    { key: `surface:${lens.id}`, url: canonicalPreparedAsset(lens.surfaceUrl, lens.surface2xUrl), pool: "mounted" },
    { key: `poles:${lens.id}`, url: canonicalPreparedAsset(lens.polesUrl, lens.poles2xUrl), pool: "mounted" },
  ]),
];
const required = lens => [`surface:${lens}`, `poles:${lens}`];
export const runtimeDefinition = Object.freeze({
  schema: OBJECT_RUNTIME_SCHEMA, id: "pluto", controls: objectControls,
  camera: PREPARED_PLUTO_SCENE.camera, sky: PREPARED_PLUTO_STARFIELD, sun: PREPARED_PLUTO_SKY_SUN,
  inputSelector: ".pluto-input-surface",
  assets: { entries, pools: [preparedResourcePool("mounted", entries)],
    startup: [...celestial.map(entry => entry.key), "curvature", ...required(PREPARED_PLUTO_LENSES.defaultLens)] },
  initialSelection: initialObjectSelection(objectControls), reduceSelection: reduceObjectSelection,
  resolvePresentation: ({ selection }) => ({ required: required(selection.lensId) }),
  createPresentation,
});
