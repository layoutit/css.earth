import { OBJECT_RUNTIME_SCHEMA, initialObjectSelection, reduceObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_NEPTUNE_LENSES } from "./preparedLenses.mjs";
import { PREPARED_NEPTUNE_STARFIELD } from "./preparedStarfield.mjs";
import { PREPARED_NEPTUNE_SKY_SUN } from "./preparedSkySun.mjs";
import { cameraPlan } from "./camera-plan.mjs";
import { materialFor } from "./material.mjs";
import { createPresentation } from "./presentation.mjs";

const warm = [...preparedSkyResources(PREPARED_NEPTUNE_STARFIELD, PREPARED_NEPTUNE_SKY_SUN, "warm"),
  { key: "rings", url: "/scenes/neptune/neptune-rings@2x.webp", pool: "warm" }];
const staticKeys = id => ["surface", "poles", "material", "shadowlessMaterial"].map(layer => `${layer}:${id}`);
const initialOrbit = PREPARED_NEPTUNE_LENSES.controls.find(lens => lens.id === PREPARED_NEPTUNE_LENSES.defaultLens).orbitMaterial;
const initialFrame = Math.round((initialOrbit.maximumScenePitchDegrees - cameraPlan.initialScenePitchDegrees) /
  (initialOrbit.maximumScenePitchDegrees - initialOrbit.minimumScenePitchDegrees) * (initialOrbit.frameCount - 1));
const initialRow = initialOrbit.presentations[initialFrame].rowIndex;
const entries = [...warm, ...PREPARED_NEPTUNE_LENSES.controls.flatMap(lens => [
  ...["surface", "poles", "material", "shadowlessMaterial"].map(layer => ({ key: `${layer}:${lens.id}`,
    url: canonicalPreparedAsset(lens[`${layer}Url`], lens[`${layer}2xUrl`]), pool: "variant" })),
  ...lens.orbitMaterial.rows.map((row, index) => ({ key: `lighting:${lens.id}:${index}`, url: row.assetUrl, pool: "lighting" })),
])];
export const runtimeDefinition = Object.freeze({
  schema: OBJECT_RUNTIME_SCHEMA, id: "neptune", controls: objectControls,
  camera: cameraPlan, sky: PREPARED_NEPTUNE_STARFIELD, sun: PREPARED_NEPTUNE_SKY_SUN, inputSelector: ".neptune-input-surface",
  assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm" }),
    preparedResourcePool("variant", entries, { retention: "selection", capacity: 8, concurrency: 8 }),
    preparedResourcePool("lighting", entries, { retention: "selection", capacity: 3, concurrency: 3, eviction: "capacity" })],
    startup: [...warm.map(entry => entry.key), ...staticKeys(PREPARED_NEPTUNE_LENSES.defaultLens),
      ...[initialRow - 1, initialRow, initialRow + 1].filter(index => index >= 0 && index < initialOrbit.rows.length).map(index => `lighting:${PREPARED_NEPTUNE_LENSES.defaultLens}:${index}`)] },
  initialSelection: initialObjectSelection(objectControls), reduceSelection: reduceObjectSelection,
  resolvePresentation({ selection, view, previousPlan }) {
    const material = materialFor(selection, view);
    // Retain the legacy lens preparation rule without a private async loop:
    // the shared selection owner rechecks this demand immediately before commit.
    const prepareRow = !material.useDefault && (selection.shadows || previousPlan?.lensId !== selection.lensId);
    return { required: [...staticKeys(selection.lensId), ...(prepareRow ? [material.rowKey] : [])],
      lensId: selection.lensId, materialFrame: material.frame };
  },
  createPresentation,
});
