#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const controls = Object.freeze([
  Object.freeze({
    id: "normal",
    label: "Normal",
    shortLabel: "RGB",
    thumbnailUrl: "/scenes/earth/earth-lens-normal.webp",
    surfaceUrl: "/scenes/earth/earth-surface.webp",
    polesUrl: "/scenes/earth/earth-surface-poles.webp",
    maximumZoom: 4,
    qualification: "NASA Blue Marble visible-color composite",
  }),
  Object.freeze({
    id: "topography",
    label: "Topography",
    shortLabel: "TOPO",
    thumbnailUrl: "/scenes/earth/earth-lens-topography.webp",
    surfaceUrl: "/scenes/earth/earth-topography.webp",
    polesUrl: "/scenes/earth/earth-topography-poles.webp",
    maximumZoom: 4,
    qualification: "NASA Blue Marble topography and bathymetry",
  }),
  Object.freeze({
    id: "night-lights",
    label: "Night lights",
    shortLabel: "VIIRS",
    thumbnailUrl: "/scenes/earth/earth-lens-night-lights.webp",
    surfaceUrl: "/scenes/earth/earth-night-lights.webp",
    polesUrl: "/scenes/earth/earth-night-lights-poles.webp",
    maximumZoom: 4,
    qualification: "NASA Black Marble 2016 global composite",
  }),
  Object.freeze({
    id: "cross-section",
    label: "Cross section",
    shortLabel: "CUT",
    thumbnailUrl: "/scenes/earth/earth-view-interior.webp",
    view: "interior",
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
    normal: "NASA Earth Observatory Blue Marble Next Generation December 2004",
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
