#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const city = JSON.parse(await readFile(new URL("../source/city/manifest.json", import.meta.url), "utf8"));
import { EARTH_STAGING_ROOT } from "./preparation-paths.mjs";
import { earthSurfacePageUrls } from "./surface-raster.mjs";

const { pages } = JSON.parse(await readFile(resolve(EARTH_STAGING_ROOT, "surface-raster-plan.json"), "utf8"));

const controls = Object.freeze([
  Object.freeze({
    id: "normal",
    label: "Normal",
    shortLabel: "RGB",
    thumbnailUrl: "/scenes/earth/earth-lens-normal.webp",
    surfaceUrl: "/scenes/earth/earth-surface.webp",
    surfaceUrls: earthSurfacePageUrls("earth-surface", pages.length),
    polesUrl: "/scenes/earth/earth-surface-poles.webp",
    maximumZoom: city.presentation.maximumZoom,
    qualification: "NASA Blue Marble; ESA WorldCover 2021 global source-footprint detail from the Terrascope WMTS service",
  }),
  Object.freeze({
    id: "topography",
    label: "Topography",
    shortLabel: "TOPO",
    thumbnailUrl: "/scenes/earth/earth-lens-topography.webp",
    surfaceUrl: "/scenes/earth/earth-topography.webp",
    surfaceUrls: earthSurfacePageUrls("earth-topography", pages.length),
    polesUrl: "/scenes/earth/earth-topography-poles.webp",
    maximumZoom: 8,
    qualification: "NASA Blue Marble topography and bathymetry",
  }),
  Object.freeze({
    id: "night-lights",
    label: "Night lights",
    shortLabel: "VIIRS",
    thumbnailUrl: "/scenes/earth/earth-lens-night-lights.webp",
    surfaceUrl: "/scenes/earth/earth-night-lights.webp",
    surfaceUrls: earthSurfacePageUrls("earth-night-lights", pages.length),
    polesUrl: "/scenes/earth/earth-night-lights-poles.webp",
    maximumZoom: 8,
    qualification: "NASA Black Marble 2016 global composite",
  }),
  Object.freeze({
    id: "cross-section",
    label: "Cross section",
    shortLabel: "CUT",
    thumbnailUrl: "/scenes/earth/earth-view-interior.webp",
    view: "interior",
    maximumZoom: 8,
    qualification: "Schematic NASA Science source-backed interior",
  }),
]);
const prepared = Object.freeze({
  schema: "cssearth-prepared-lenses@1",
  defaultLens: "normal",
  runtimeFilters: false,
  runtimeRasterization: false,
  controls,
  provenance: Object.freeze({
    normal: "NASA Blue Marble Next Generation December 2004; ESA WorldCover 2021 v200 RGBNIR, CC-BY-4.0",
    topography: "NASA Earth Observatory Blue Marble topography and bathymetry December 2004",
    nightLights: "NASA Earth Observatory Black Marble 2016",
    interior: "NASA Science Facts About Earth, schematic presentation",
  }),
});
await writeFile(
  resolve(import.meta.dirname, "../runtime/preparedLenses.mjs"),
  "// Generated from the checked Earth observation plan.\n" +
    `export const PREPARED_EARTH_LENSES = ${JSON.stringify(prepared)};\n`,
);
