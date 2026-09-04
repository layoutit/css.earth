#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import sharp from "sharp";

import {
  ensureVenusPreparationDirectories,
  VENUS_PUBLIC_ROOT,
  VENUS_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateVenusSourceGroup } from "./source-manifest.mjs";

const sourcePath = resolve(VENUS_SOURCE_ROOT, "venera/gallery.json");
const outputPath = resolve(import.meta.dirname, "../site/preparedSurfaceGallery.mjs");
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const entries = await validateVenusSourceGroup("surface-gallery");
const declaredPaths = new Set(entries.map(({ path }) => path));

validateSource(source, declaredPaths);
await ensureVenusPreparationDirectories();

const items = [];
for (const item of source.items) {
  const inputPath = resolve(VENUS_SOURCE_ROOT, item.sourcePath);
  const bytes = await readFile(inputPath);
  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== item.width || metadata.height !== item.height) {
    throw new Error(`Venus gallery dimensions drifted: ${item.sourcePath}.`);
  }
  await writeFile(resolve(VENUS_PUBLIC_ROOT, item.publicFilename), bytes);
  items.push({
    id: item.id,
    label: item.label,
    src: `/scenes/venus/${item.publicFilename}`,
    width: item.width,
    height: item.height,
    alt: item.alt,
    caption: item.caption,
    sourceUrl: item.sourceUrl,
  });
}

const prepared = {
  schema: "cssearth-prepared-gallery@1",
  id: source.id,
  open: false,
  qualification: source.qualification,
  credit: source.credit,
  sourcePage: source.sourcePage,
  items,
};
await writeFile(outputPath, [
  "// Generated from the checked Venus Venera archive sources.",
  `export const PREPARED_VENUS_SURFACE_GALLERY = deepFreeze(${JSON.stringify(prepared)});`,
  "",
  "function deepFreeze(value) {",
  "  for (const child of Object.values(value)) {",
  "    if (child && typeof child === \"object\") deepFreeze(child);",
  "  }",
  "  return Object.freeze(value);",
  "}",
  "",
].join("\n"));
console.log(`Prepared ${items.length} Venus surface photographs.`);

function validateSource(value, paths) {
  if (value?.schema !== "cssvenus-venera-surface-gallery-source@1" ||
      value.id !== "surface-photographs" || !nonEmpty(value.label) ||
      !validUrl(value.sourcePage) || !nonEmpty(value.credit) ||
      !nonEmpty(value.qualification) || value.items?.length !== 4 ||
      !paths.has("venera/gallery.json")) {
    throw new TypeError("Venus surface-gallery metadata is incompatible.");
  }
  const ids = new Set();
  const filenames = new Set();
  for (const item of value.items) {
    if (!/^[a-z0-9-]+$/u.test(item.id ?? "") || ids.has(item.id) ||
        !nonEmpty(item.label) || !nonEmpty(item.alt) ||
        !nonEmpty(item.caption) || !validUrl(item.sourceUrl) ||
        !/^venera\/venera(?:9|10)\.gif$|^venera\/venera1(?:3|4)\.jpg$/u
          .test(item.sourcePath ?? "") || !paths.has(item.sourcePath) ||
        !/^venus-venera-(?:9|10)\.gif$|^venus-venera-1(?:3|4)\.jpg$/u
          .test(item.publicFilename ?? "") ||
        basename(item.publicFilename) !== item.publicFilename ||
        filenames.has(item.publicFilename) ||
        !Number.isSafeInteger(item.width) || item.width < 1 ||
        !Number.isSafeInteger(item.height) || item.height < 1) {
      throw new TypeError("Venus surface-gallery item is invalid.");
    }
    ids.add(item.id);
    filenames.add(item.publicFilename);
  }
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
