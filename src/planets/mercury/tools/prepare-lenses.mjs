#!/usr/bin/env node

import { access, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import {
  ensureMercuryPreparationDirectories,
  MERCURY_PUBLIC_ROOT,
  MERCURY_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateMercurySourceGroup } from "./source-manifest.mjs";

await validateMercurySourceGroup("lenses");
await ensureMercuryPreparationDirectories();

const topographyLegendUrl = "/scenes/mercury/mercury-lens-topography-legend.webp";
const topographyLegendSource = resolve(
  MERCURY_SOURCE_ROOT,
  "maps/mercury-topography-legend.png",
);
const topographyLegendCrop = await sharp(topographyLegendSource)
  // Retain the published color bins while excluding the source image's gray frame.
  .extract({ left: 66, top: 12, width: 96, height: 2637 })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const dividerRows = [];
for (let y = 0; y < topographyLegendCrop.info.height; y += 1) {
  let darkPixels = 0;
  for (let x = 0; x < topographyLegendCrop.info.width; x += 1) {
    const offset = (y * topographyLegendCrop.info.width + x) *
      topographyLegendCrop.info.channels;
    if (
      topographyLegendCrop.data[offset] <= 8 &&
      topographyLegendCrop.data[offset + 1] <= 8 &&
      topographyLegendCrop.data[offset + 2] <= 8
    ) {
      darkPixels += 1;
    }
  }
  if (darkPixels / topographyLegendCrop.info.width >= 0.95) {
    dividerRows.push(y);
  }
}
const dividerRuns = [];
for (const row of dividerRows) {
  const previous = dividerRuns.at(-1);
  if (previous && row === previous.end + 1) {
    previous.end = row;
  } else {
    dividerRuns.push({ start: row, end: row });
  }
}
if (dividerRuns.length !== 27) {
  throw new Error(
    `Expected 27 internal rows in the pinned USGS legend; found ${dividerRuns.length}.`,
  );
}
const rowBytes = topographyLegendCrop.info.width * topographyLegendCrop.info.channels;
for (const { start, end } of dividerRuns) {
  const midpoint = (start + end) / 2;
  for (let row = start; row <= end; row += 1) {
    const sourceRow = row <= midpoint ? start - 1 : end + 1;
    topographyLegendCrop.data.copy(
      topographyLegendCrop.data,
      row * rowBytes,
      sourceRow * rowBytes,
      (sourceRow + 1) * rowBytes,
    );
  }
}
await sharp(topographyLegendCrop.data, { raw: topographyLegendCrop.info })
  .rotate(90)
  .resize({ width: 304, height: 14, fit: "fill", kernel: "nearest" })
  .webp({ lossless: true })
  .toFile(resolve(MERCURY_PUBLIC_ROOT, topographyLegendUrl.split("/").at(-1)));
const controls = Object.freeze([
  Object.freeze({
    id: "normal",
    label: "750 nm",
    falseColor: false,
    filter: "MESSENGER MDIS BDR global 750 nm monochrome basemap",
    thumbnailUrl: "/scenes/mercury/mercury-lens-normal.webp",
    surfaceUrl: "/scenes/mercury/mercury-surface-normal.webp",
    surface2xUrl: "/scenes/mercury/mercury-surface-normal@2x.webp",
    view: "exterior",
  }),
  Object.freeze({
    id: "enhanced",
    label: "Enhanced",
    falseColor: true,
    filter: "NASA Trek/USGS MESSENGER enhanced-color mosaic with qualified prepared coverage completion",
    thumbnailUrl: "/scenes/mercury/mercury-lens-enhanced.webp",
    surfaceUrl: "/scenes/mercury/mercury-surface-enhanced.webp",
    surface2xUrl: "/scenes/mercury/mercury-surface-enhanced@2x.webp",
    view: "exterior",
  }),
  Object.freeze({
    id: "topography",
    label: "Topography",
    falseColor: true,
    filter: "USGS MESSENGER global color shaded relief",
    thumbnailUrl: "/scenes/mercury/mercury-lens-topography.webp",
    surfaceUrl: "/scenes/mercury/mercury-surface-topography.webp",
    surface2xUrl: "/scenes/mercury/mercury-surface-topography@2x.webp",
    legend: Object.freeze({
      kind: "scale",
      title: "Elevation",
      meta: "m",
      src: topographyLegendUrl,
      width: 304,
      height: 14,
      labels: Object.freeze(["−5,020", "−450", "4,140"]),
      sourceUrl: "https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_dem_global_color_shaded_relief_2km",
    }),
    view: "exterior",
  }),
  Object.freeze({
    id: "interior",
    label: "Interior",
    falseColor: false,
    filter: "NASA-dimensioned retained 3D metallic-core cutaway",
    thumbnailUrl: "/scenes/mercury/mercury-lens-interior.webp",
    surfaceUrl: "/scenes/mercury/mercury-interior-section.webp",
    surface2xUrl: "/scenes/mercury/mercury-interior-section@2x.webp",
    legend: Object.freeze({
      kind: "categories",
      title: "Structure",
      meta: "Schematic",
      items: Object.freeze([
        Object.freeze({
          label: "Metallic core",
          description: "85% of radius",
          color: "rgb(158 94 55)",
        }),
        Object.freeze({
          label: "Mantle + crust",
          description: "366 km shell",
          color: "rgb(112 108 101)",
        }),
      ]),
      sourceUrl: "https://science.nasa.gov/mercury/facts/",
    }),
    view: "interior",
  }),
]);
for (const lens of controls) {
  const files = [
    access(resolve(MERCURY_PUBLIC_ROOT, lens.thumbnailUrl.split("/").at(-1))),
    access(resolve(MERCURY_PUBLIC_ROOT, lens.surfaceUrl.split("/").at(-1))),
    access(resolve(MERCURY_PUBLIC_ROOT, lens.surface2xUrl.split("/").at(-1))),
  ];
  if (lens.legend?.src) {
    files.push(access(resolve(MERCURY_PUBLIC_ROOT, lens.legend.src.split("/").at(-1))));
  }
  await Promise.all(files);
}
await writeFile(
  resolve(import.meta.dirname, "../runtime/preparedLenses.mjs"),
  "// Generated by tools/prepare-lenses.mjs from declared local sources.\n" +
    `export const PREPARED_MERCURY_LENSES = Object.freeze(${JSON.stringify({
      schema: "cssmercury-prepared-lenses@1",
      defaultLens: "normal",
      controls,
      runtimeRasterization: false,
    })});\n`,
);
