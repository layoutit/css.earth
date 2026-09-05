import { OBJECT_RUNTIME_SCHEMA, initialObjectSelection, reduceObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_MARS_CAMERA } from "./preparedCamera.mjs";
import { PREPARED_MARS_SCENE } from "./preparedScene.mjs";
import { PREPARED_MARS_LENSES } from "./preparedLenses.mjs";
import { PREPARED_MARS_SKY_SUN } from "./preparedSkySun.mjs";
import { materialBank, materialFrameFor } from "./material.mjs";
import { createPresentation } from "./presentation.mjs";

const celestial = preparedSkyResources(PREPARED_MARS_SCENE.starfield, PREPARED_MARS_SKY_SUN, "warm");
const lensKeys = id => [`surface:${id}`, `poles:${id}`];
const entries = [...celestial,
  ...PREPARED_MARS_LENSES.controls.flatMap(lens => ["surface", "poles"].map(layer => ({
    key: `${layer}:${lens.id}`, url: canonicalPreparedAsset(lens[`${layer}Url`], lens[`${layer}2xUrl`]), pool: "warm",
  }))),
  ...materialBank.rows.map((row, index) => ({ key: `lighting:${index}`, url: row.url ?? row.assetUrl, pool: "lighting" })),
];
export const runtimeDefinition = Object.freeze({
  schema: OBJECT_RUNTIME_SCHEMA, id: "mars", controls: objectControls,
  camera: PREPARED_MARS_CAMERA, sky: PREPARED_MARS_SCENE.starfield, sun: PREPARED_MARS_SKY_SUN, inputSelector: null,
  assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm", decoding: "sync" }),
    preparedResourcePool("lighting", entries, { retention: "selection", decoding: "sync", capacity: materialBank.transport.maximumRetainedRowCount,
      concurrency: materialBank.transport.maximumRetainedRowCount, reuse: true, eviction: "capacity" })],
    startup: [...celestial.map(entry => entry.key), ...lensKeys(PREPARED_MARS_LENSES.defaultLens),
      ...materialBank.transport.initialWarmRows.map(index => `lighting:${index}`)] },
  initialSelection: initialObjectSelection(objectControls), reduceSelection: reduceObjectSelection,
  resolvePresentation: ({ selection, view }) => ({ required: [...lensKeys(selection.lensId),
    `lighting:${materialBank.presentations[materialFrameFor(selection, view)].rowIndex}`] }),
  createPresentation,
});
