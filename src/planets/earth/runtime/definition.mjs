import { OBJECT_RUNTIME_SCHEMA, initialObjectSelection, reduceObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_EARTH_SCENE } from "./preparedScene.mjs";
import { PREPARED_EARTH_LENSES } from "./preparedLenses.mjs";
import { PREPARED_EARTH_STARFIELD } from "./preparedStarfield.mjs";
import { PREPARED_EARTH_SKY_SUN } from "./preparedSkySun.mjs";
import { cameraPlan } from "./camera-plan.mjs";
import { banks, pageKeys, interiorUrls, materialDemand } from "./material.mjs";
import { PREPARED_EARTH_PLACES } from "./preparedPlaces.mjs";
import { createPresentation } from "./presentation.mjs";
const celestial = preparedSkyResources(PREPARED_EARTH_STARFIELD, PREPARED_EARTH_SKY_SUN, "mounted");
const interiorKeys = interiorUrls.map((_, index) => `interior:${index}`);
const entries = [...celestial,
  ...banks.flatMap(bank => bank.urls.map((url, index) => ({ key: `page:${bank.id}:${index}`, url, pool: "pages" }))),
  ...PREPARED_EARTH_LENSES.controls.filter(lens => lens.view !== "interior").map(lens => ({ key: `poles:${lens.id}`, url: canonicalPreparedAsset(lens.polesUrl), pool: "mounted" })),
  ...interiorUrls.map((url, index) => ({ key: interiorKeys[index], url, pool: "mounted" })),
  { key: "shadowless:lighting", url: canonicalPreparedAsset(PREPARED_EARTH_SCENE.material.lighting.shadowlessAssets), pool: "mounted" },
  ...["lighting", "atmosphere"].flatMap(id => [
    { key: `default:${id}`, url: canonicalPreparedAsset(PREPARED_EARTH_SCENE.material[id].defaultAssets), pool: "default-materials" },
    ...PREPARED_EARTH_SCENE.material[id].preparedRows.map(row => ({ key: `${id}:${row.rowIndex}`, url: canonicalPreparedAsset(row.assets), pool: id })),
  ]),
];
export const runtimeDefinition = Object.freeze({
  schema: OBJECT_RUNTIME_SCHEMA, id: "earth", controls: objectControls,
  camera: cameraPlan, sky: PREPARED_EARTH_STARFIELD, sun: PREPARED_EARTH_SKY_SUN, inputSelector: ".earth-input-surface",
  destinations: { catalog: PREPARED_EARTH_PLACES, defaultLens: "normal",
    statuses: { detail: "WorldCover imagery · 2021. Source gaps retain the Earth base map.",
      overview: "Earth overview. WorldCover detail is unavailable at this location." } },
  assets: { entries, pools: [preparedResourcePool("mounted", entries),
    preparedResourcePool("default-materials", entries, { retention: "warm" }),
    preparedResourcePool("pages", entries, { retention: "selection", concurrency: 2, capacity: banks[0].urls.length * 2 }),
    ...["lighting", "atmosphere"].map(id => preparedResourcePool(id, entries, { retention: "selection", reuse: true,
      capacity: PREPARED_EARTH_SCENE.material[id].transport.maximumRetainedRowCount, concurrency: 3,
      eviction: "capacity", stabilityMilliseconds: 120, decoding: "sync" }))],
    startup: [...celestial.map(entry => entry.key), ...pageKeys(PREPARED_EARTH_LENSES.defaultLens),
      "poles:normal", "shadowless:lighting", "default:lighting", "default:atmosphere",
      ...PREPARED_EARTH_SCENE.material.atmosphere.transport.initialWarmRows.map(index => `atmosphere:${index}`)] },
  initialSelection: initialObjectSelection(objectControls), reduceSelection: reduceObjectSelection,
  resolvePresentation({ selection, view, previousPlan }) {
    const lens = PREPARED_EARTH_LENSES.controls.find(lens => lens.id === selection.lensId);
    const material = materialDemand(selection, view, previousPlan);
    return { ...material, navigation: { maximumZoom: lens.maximumZoom, camera: lens.camera ?? null }, required: [...pageKeys(lens.id), ...(lens.view === "interior" ? interiorKeys : [`poles:${lens.id}`]), ...material.required] };
  },
  createPresentation,
});
