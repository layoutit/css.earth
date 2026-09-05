import { OBJECT_RUNTIME_SCHEMA, initialObjectSelection, reduceObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_SATURN_RUNTIME_SCENE as scene } from "./preparedSceneRuntime.mjs";
import { PREPARED_SATURN_LENSES } from "./preparedLenses.mjs";
import { PREPARED_SATURN_VIEWS } from "./preparedViews.mjs";
import { PREPARED_SATURN_STARFIELD } from "./preparedStarfield.mjs";
import { PREPARED_SATURN_SKY_SUN } from "./preparedSkySun.mjs";
import { cameraPlan } from "./camera-plan.mjs";
import { exteriorAtlas, interiorAtlas, variantFor } from "./material.mjs";
import { createPresentation } from "./presentation.mjs";
const exteriorLenses = PREPARED_SATURN_LENSES.controls.filter(lens => lens.view !== "interior");
const interiorLens = PREPARED_SATURN_LENSES.controls.find(lens => lens.view === "interior").id;
const lensAssets = lens => [
  { key: `surface:${lens.id}`, url: canonicalPreparedAsset(lens.surfaceUrl, lens.surface2xUrl) },
  { key: `poles:${lens.id}`, url: lens.polesUrl },
  { key: `rings:${lens.id}`, url: canonicalPreparedAsset(lens.ringUrl, lens.ring2xUrl) },
  ...(lens.id !== PREPARED_SATURN_LENSES.defaultLens && PREPARED_SATURN_VIEWS.assets.outerPoles[lens.id]
    ? [{ key: `outer-poles:${lens.id}`, url: canonicalPreparedAsset(PREPARED_SATURN_VIEWS.assets.outerPoles[lens.id]) }] : []),
];
const interior = [...Object.entries(PREPARED_SATURN_VIEWS.interiorLenses.normal.assets).map(([name, asset]) => ({ key: `interior:${name}`, url: canonicalPreparedAsset(asset), pool: "interior" })),
  { key: "interior:outer-poles", url: canonicalPreparedAsset(PREPARED_SATURN_VIEWS.assets.outerPoles.normal), pool: "interior" }];
const warm = [...preparedSkyResources(PREPARED_SATURN_STARFIELD, PREPARED_SATURN_SKY_SUN, "warm"),
  { key: "weather", url: "/scenes/saturn/saturn-weather.webp", pool: "warm" },
  { key: "ring-shadow", url: "/scenes/saturn/saturn-ring-shadow.webp", pool: "warm" },
  ...scene.ringMotionPlates.map((plate, index) => ({ key: `ring-motion:${index}`, url: canonicalPreparedAsset(plate.textureUrl, plate.texture2xUrl), pool: "warm" })),
];
const entries = [...warm, ...interior,
  ...exteriorLenses.flatMap(lens => lensAssets(lens).map(entry => ({ ...entry, pool: lens.id === PREPARED_SATURN_LENSES.defaultLens ? "warm" : "lenses" }))),
  ...Object.entries(exteriorAtlas.variants).map(([id, variant]) => ({ key: `exterior:${id}`, url: variant.runtimeAtlas.asset2xUrl || variant.runtimeAtlas.assetUrl, pool: "exterior-material" })),
  ...Object.entries(interiorAtlas.variants).map(([id, variant]) => ({ key: `interior-material:${id}`, url: variant.runtimeAtlas.asset2xUrl || variant.runtimeAtlas.assetUrl, pool: "interior-material" })),
];
export const runtimeDefinition = Object.freeze({
  schema: OBJECT_RUNTIME_SCHEMA, id: "saturn", controls: objectControls,
  camera: cameraPlan, sky: PREPARED_SATURN_STARFIELD, sun: PREPARED_SATURN_SKY_SUN, inputSelector: ".saturn-input-surface",
  assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm", decoding: "sync" }),
    preparedResourcePool("lenses", entries, { retention: "selection", decoding: "sync", capacity: 8, concurrency: 8 }),
    preparedResourcePool("interior", entries, { retention: "selection", decoding: "sync" }),
    ...["exterior-material", "interior-material"].map(id => preparedResourcePool(id, entries, { retention: "selection", decoding: "sync", capacity: 2, concurrency: 2 }))],
    startup: [...entries.filter(entry => entry.pool === "warm").map(entry => entry.key), `exterior:${exteriorAtlas.defaultVariant}`] },
  initialSelection: Object.freeze({ ...initialObjectSelection(objectControls), interior: false }),
  reduceSelection(selection, action) {
    return action.kind === "lens" && action.id === interiorLens ? Object.freeze({ ...selection, interior: !selection.interior })
      : reduceObjectSelection(selection, action);
  },
  resolvePresentation({ selection }) {
    const lens = exteriorLenses.find(lens => lens.id === selection.lensId), variant = variantFor(selection);
    return { required: [...lensAssets(lens).map(entry => entry.key), `exterior:${variant}`,
      ...(selection.interior ? [...interior.map(entry => entry.key), `interior-material:${variant}`] : [])],
      pressedLenses: [selection.lensId, ...(selection.interior ? [interiorLens] : [])] };
  },
  createPresentation,
});
