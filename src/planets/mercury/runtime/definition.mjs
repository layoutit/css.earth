import { OBJECT_RUNTIME_SCHEMA, initialObjectSelection, reduceObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_MERCURY_SCENE } from "./preparedScene.mjs";
import { PREPARED_MERCURY_ASSETS } from "./preparedAssets.mjs";
import { PREPARED_MERCURY_LENSES } from "./preparedLenses.mjs";
import { PREPARED_MERCURY_SKY_SUN } from "./preparedSkySun.mjs";
import { materialBank, materialDemand } from "./material.mjs";
import { createPresentation } from "./presentation.mjs";
const interiorKeys = ["outerSurface", "outerPoles", "core", "corePoles", "section"];
const entries = [...preparedSkyResources(PREPARED_MERCURY_SCENE.starfield, PREPARED_MERCURY_SKY_SUN, "warm"),
  { key: "poles", url: canonicalPreparedAsset(PREPARED_MERCURY_ASSETS.poles), pool: "warm" },
  { key: "shadowless", url: materialBank.presentations.at(-1).url, pool: "warm" },
  ...PREPARED_MERCURY_LENSES.controls.filter(lens => lens.view === "exterior").map(lens => ({
    key: `surface:${lens.id}`, url: canonicalPreparedAsset(lens.surfaceUrl, lens.surface2xUrl), pool: lens.id === "normal" ? "warm" : "lenses",
  })),
  ...interiorKeys.map(name => ({ key: `interior:${name}`, pool: "lenses", url: canonicalPreparedAsset(
    PREPARED_MERCURY_ASSETS.interior[`${name}Url`], PREPARED_MERCURY_ASSETS.interior[`${name}2xUrl`]) })),
  ...materialBank.rows.map((row, index) => ({ key: `lighting:${index}`, url: row.url, pool: "lighting" })),
];
export const runtimeDefinition = Object.freeze({
  schema: OBJECT_RUNTIME_SCHEMA, id: "mercury", controls: objectControls,
  camera: PREPARED_MERCURY_SCENE.camera, sky: PREPARED_MERCURY_SCENE.starfield, sun: PREPARED_MERCURY_SKY_SUN,
  inputSelector: ".mercury-input-surface",
  assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm", decoding: "sync" }),
    preparedResourcePool("lenses", entries, { retention: "selection", decoding: "sync", capacity: interiorKeys.length + 1, concurrency: interiorKeys.length + 1 }),
    preparedResourcePool("lighting", entries, { retention: "selection", decoding: "sync", capacity: materialBank.transport.maximumRetainedRowCount,
      concurrency: materialBank.transport.maximumRetainedRowCount, eviction: "capacity", reuse: true })],
    startup: [...entries.filter(entry => entry.pool === "warm").map(entry => entry.key),
      ...materialBank.transport.initialWarmRows.map(index => `lighting:${index}`)] },
  initialSelection: initialObjectSelection(objectControls), reduceSelection: reduceObjectSelection,
  resolvePresentation({ selection, view }) {
    const lens = PREPARED_MERCURY_LENSES.controls.find(lens => lens.id === selection.lensId);
    const material = materialDemand(selection, view);
    return { ...material, required: [...material.required, ...(lens.view === "interior"
      ? ["surface:normal", "poles", ...interiorKeys.map(name => `interior:${name}`)] : [`surface:${lens.id}`, "poles"])] };
  },
  createPresentation,
});
