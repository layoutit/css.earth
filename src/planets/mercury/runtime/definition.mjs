import { OBJECT_RUNTIME_SCHEMA, initialObjectSelection, reduceObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_NAVIGATION_MARKERS } from "../../../../site/prepared-navigation-markers.mjs";
import { DEFAULT_LABEL_POLICY } from "../../../platform/label-field.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_MERCURY_SCENE } from "./preparedScene.mjs";
import { PREPARED_MERCURY_ASSETS } from "./preparedAssets.mjs";
import { PREPARED_MERCURY_LENSES } from "./preparedLenses.mjs";
import { PREPARED_MERCURY_SKY_SUN } from "./preparedSkySun.mjs";
import { PREPARED_MERCURY_SYSTEM_MARKERS } from "./preparedSystemMarkers.mjs";
import { BILLBOARD_LIGHTING_KEY, billboardLighting, materialBank, materialDemand } from "./material.mjs";
import { createPresentation } from "./presentation.mjs";
const interiorKeys = ["outerSurface", "outerPoles", "core", "corePoles", "section"];
// The stars ride the scene matrix through the prepared astrometric
// registration, exactly like the observed Sun.
if (PREPARED_MERCURY_SCENE.starfield.cameraContract !== "scene-locked-unbounded-accumulated-matrix3d" ||
    typeof PREPARED_MERCURY_SCENE.starfield.sceneRegistration !== "string") {
  throw new TypeError("Mercury cubic-sky camera binding is incompatible.");
}
// The shell's navigation atlas (see site/planet-navigation-marker.css): the
// far-view marker is the header's Mercury sprite, from the same file.
const NAVIGATION_MARKER_ATLAS_URL = "/navigation/planet-markers@2x.webp";
const navigationMarker = PREPARED_NAVIGATION_MARKERS.mercury;
if (!navigationMarker || !(navigationMarker.presentation?.size > 0)) {
  throw new Error("Mercury has no prepared navigation marker.");
}
// The other planets and the Sun as the same atlas tiles at the shell's own
// sizes: the planetary system's markers are billboards at a fixed screen
// size, never geometry.
const atlasSprite = (id) => {
  const marker = PREPARED_NAVIGATION_MARKERS[id];
  if (marker && marker.presentation?.size > 0) {
    return Object.freeze({ index: marker.index, count: marker.count, size: marker.presentation.size });
  }
  // Dwarf planets without a navigation tile draw from Mercury's prepared
  // system-marker strip (synthetic discs; see prepare-system-markers.mjs).
  const tile = PREPARED_MERCURY_SYSTEM_MARKERS.tiles[id];
  if (!tile) throw new Error(`No prepared marker for ${id}.`);
  return Object.freeze({ url: canonicalPreparedAsset(PREPARED_MERCURY_SYSTEM_MARKERS.density1.url,
    PREPARED_MERCURY_SYSTEM_MARKERS.density2.url), index: tile.index, count: tile.count, size: tile.size });
};
const systemMarkers = Object.freeze({
  url: NAVIGATION_MARKER_ATLAS_URL,
  sun: atlasSprite("sun"),
  bodies: Object.freeze(Object.fromEntries(
    PREPARED_MERCURY_SCENE.heliocentricView.system.bodies.map((body) => [body.id, atlasSprite(body.id)]))),
  // Each marker carries its phase from Mercury's own billboard lighting
  // atlas (the same frames the far-view overlay draws), scaled down.
  phase: Object.freeze({
    url: billboardLighting.url, columns: billboardLighting.columns, rowCount: billboardLighting.rowCount,
    frameCount: billboardLighting.frameCount,
    minimumLightViewZ: PREPARED_MERCURY_ASSETS.lighting.minimumLightViewZ,
    maximumLightViewZ: PREPARED_MERCURY_ASSETS.lighting.maximumLightViewZ,
    baseLightAzimuthDegrees: PREPARED_MERCURY_ASSETS.lighting.baseLightAzimuthDegrees,
  }),
});
const entries = [...preparedSkyResources(PREPARED_MERCURY_SCENE.starfield, PREPARED_MERCURY_SKY_SUN, "warm"),
  { key: "poles", url: canonicalPreparedAsset(PREPARED_MERCURY_ASSETS.poles), pool: "warm" },
  { key: "shadowless", url: materialBank.presentations.at(-1).url, pool: "warm" },
  { key: BILLBOARD_LIGHTING_KEY, url: billboardLighting.url, pool: "warm" },
  ...PREPARED_MERCURY_LENSES.controls.filter(lens => lens.view === "exterior").map(lens => ({
    key: `surface:${lens.id}`, url: canonicalPreparedAsset(lens.surfaceUrl, lens.surface2xUrl), pool: lens.id === "normal" ? "warm" : "lenses",
  })),
  ...interiorKeys.map(name => ({ key: `interior:${name}`, pool: "lenses", url: canonicalPreparedAsset(
    PREPARED_MERCURY_ASSETS.interior[`${name}Url`], PREPARED_MERCURY_ASSETS.interior[`${name}2xUrl`]) })),
  ...materialBank.rows.map((row, index) => ({ key: `lighting:${index}`, url: row.url, pool: "lighting" })),
];
// Captions above the far-view markers, under the shared label policy
// (priority declutter, cap-height sizing). The names are the shell's
// display names (site/objects.mjs), spelled here as this object's own data
// because the registry's dynamic client imports sit outside the static
// runtime closure; the dwarf planets have no shell entry.
const captionNames = Object.freeze({
  sun: "Sun", mercury: "Mercury", venus: "Venus", earth: "Earth", mars: "Mars", jupiter: "Jupiter",
  saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", pluto: "Pluto",
  ceres: "Ceres", eris: "Eris", haumea: "Haumea", makemake: "Makemake",
});
export const runtimeDefinition = Object.freeze({
  schema: OBJECT_RUNTIME_SCHEMA, id: "mercury", controls: objectControls,
  camera: PREPARED_MERCURY_SCENE.camera, sky: PREPARED_MERCURY_SCENE.starfield, sun: PREPARED_MERCURY_SKY_SUN,
  // The Sun at its true distance as real geometry, the orbit as a true
  // ellipse, and the shell's own Mercury marker (tile and size from the
  // shared atlas) once the disc is too small to read.
  heliocentricView: Object.freeze({
    plan: PREPARED_MERCURY_SCENE.heliocentricView,
    bodyMarker: Object.freeze({
      url: NAVIGATION_MARKER_ATLAS_URL,
      index: navigationMarker.index,
      count: navigationMarker.count,
      size: navigationMarker.presentation.size,
    }),
    systemMarkers,
    labels: Object.freeze({ policy: DEFAULT_LABEL_POLICY, names: captionNames }),
  }),
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
