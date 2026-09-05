import { OBJECT_RUNTIME_SCHEMA, initialObjectSelection, reduceObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_JUPITER_CAMERA } from "./preparedCamera.mjs";
import { PREPARED_JUPITER_LENSES } from "./preparedLenses.mjs";
import { PREPARED_JUPITER_RINGS } from "./preparedRings.mjs";
import { PREPARED_JUPITER_LIGHTING } from "./preparedLighting.mjs";
import { PREPARED_JUPITER_STARFIELD } from "./preparedStarfield.mjs";
import { PREPARED_JUPITER_SKY_SUN } from "./preparedSkySun.mjs";
import { materialDemand } from "./material.mjs";
import { createPresentation } from "./presentation.mjs";

const warm = [...preparedSkyResources(PREPARED_JUPITER_STARFIELD, PREPARED_JUPITER_SKY_SUN, "warm"),
  ...Object.entries(PREPARED_JUPITER_RINGS.assets).map(([name, asset]) => ({ key: `rings:${name}`, url: canonicalPreparedAsset(asset), pool: "warm" })),
  { key: "shadowless", url: PREPARED_JUPITER_LIGHTING.shadowless.url, pool: "warm" }];
const lensKeys = id => [`surface:${id}`, `poles:${id}`];
const entries = [...warm,
  ...PREPARED_JUPITER_LENSES.controls.flatMap(lens => ["surface", "poles"].map(layer => ({
    key: `${layer}:${lens.id}`, url: canonicalPreparedAsset(lens[`${layer}Url`], lens[`${layer}2xUrl`]), pool: "warm",
  }))),
  ...PREPARED_JUPITER_LIGHTING.rows.map((row, index) => ({ key: `lighting:${index}`, url: row.url, pool: "lighting" })),
];
export const runtimeDefinition = Object.freeze({
  schema: OBJECT_RUNTIME_SCHEMA, id: "jupiter", controls: objectControls,
  camera: PREPARED_JUPITER_CAMERA, sky: PREPARED_JUPITER_STARFIELD, sun: PREPARED_JUPITER_SKY_SUN, inputSelector: null,
  assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm", decoding: "sync" }),
    preparedResourcePool("lighting", entries, { retention: "selection", decoding: "sync", capacity: PREPARED_JUPITER_LIGHTING.transport.maximumRetainedRowCount,
      concurrency: PREPARED_JUPITER_LIGHTING.transport.maximumRetainedRowCount, reuse: true, eviction: "capacity" })],
    startup: [...warm.map(entry => entry.key), ...lensKeys(PREPARED_JUPITER_LENSES.defaultLens),
      ...PREPARED_JUPITER_LIGHTING.transport.initialWarmRows.map(index => `lighting:${index}`)] },
  initialSelection: initialObjectSelection(objectControls), reduceSelection: reduceObjectSelection,
  resolvePresentation({ selection, view, previousPlan }) {
    const material = materialDemand(selection, view, previousPlan);
    return { ...material, required: [...lensKeys(selection.lensId), ...material.required] };
  },
  createPresentation,
});
