import { OBJECT_RUNTIME_SCHEMA, initialObjectSelection, reduceObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_URANUS_LENSES } from "./preparedLenses.mjs";
import { PREPARED_URANUS_RUNTIME_SCENE } from "./preparedSceneRuntime.mjs";
import { PREPARED_URANUS_STARFIELD } from "./preparedStarfield.mjs";
import { PREPARED_URANUS_SKY_SUN } from "./preparedSkySun.mjs";
import { cameraPlan } from "./camera-plan.mjs";
import { materialRows, materialFor, surfaceAssets, neighborhood } from "./material.mjs";
import { createPresentation } from "./presentation.mjs";

const normal = surfaceAssets(PREPARED_URANUS_LENSES.defaultLens);
const celestial = [...preparedSkyResources(PREPARED_URANUS_STARFIELD, PREPARED_URANUS_SKY_SUN, "mounted"),
  { key: "rings", url: normal.ring, pool: "mounted" }, { key: "ring-shadow", url: normal.ringShadow, pool: "mounted" }];
const staticKeys = id => ["surface", "poles", "default", "shadowless"].map(layer => `${layer}:${id}`);
const entries = [...celestial, ...PREPARED_URANUS_LENSES.controls.flatMap(({ id }) => {
  const assets = surfaceAssets(id);
  return [
    ...Object.entries({ surface: assets.surface, poles: assets.poles, default: assets.defaultMaterial, shadowless: assets.shadowlessMaterial })
      .map(([layer, url]) => ({ key: `${layer}:${id}`, url, pool: "mounted" })),
    ...materialRows[id].map((url, index) => ({ key: `row:${id}:${index}`, url, pool: "rows" })),
  ];
})];
const lighting = PREPARED_URANUS_RUNTIME_SCENE.preparedLighting;
const initialFrame = Math.round(PREPARED_URANUS_RUNTIME_SCENE.camera.defaultPitch / cameraPlan.maximumControlPitchDegrees * (lighting.frameCount - 1));
export const runtimeDefinition = Object.freeze({
  schema: OBJECT_RUNTIME_SCHEMA, id: "uranus", controls: objectControls,
  camera: cameraPlan, sky: PREPARED_URANUS_STARFIELD, sun: PREPARED_URANUS_SKY_SUN, inputSelector: ".uranus-input-surface",
  assets: { entries, pools: [preparedResourcePool("mounted", entries),
    preparedResourcePool("rows", entries, { retention: "selection", capacity: 6, concurrency: 6 })],
    startup: [...celestial.map(entry => entry.key), ...staticKeys(PREPARED_URANUS_LENSES.defaultLens),
      ...neighborhood(PREPARED_URANUS_LENSES.defaultLens, lighting.presentations[initialFrame].rowIndex)] },
  initialSelection: initialObjectSelection(objectControls), reduceSelection: reduceObjectSelection,
  resolvePresentation({ selection, view, previousPlan }) {
    const material = materialFor(selection, view, previousPlan);
    return { ...material, required: [...staticKeys(selection.lensId), ...neighborhood(selection.lensId, material.materialRow)] };
  },
  createPresentation,
});
