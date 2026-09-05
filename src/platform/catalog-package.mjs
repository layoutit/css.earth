// Prepare-time access to the vendored catalogue reader (packages/catalog).
//
// Consumed exactly like the astronomy package (astronomy-package.mjs): its
// own tsup build writes packages/catalog/dist, which the workspace link
// resolves as `@cssearth/catalog` (`pnpm build:catalog`, run by `pnpm
// install` as postinstall). The `.gxct` catalogues under data/catalogs are
// SOURCES: preparation reads them here and writes prepared modules; the
// browser runtime never loads this package or a catalogue file.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const CATALOG_PACKAGE = "@cssearth/catalog";
export const CATALOG_BUILD_COMMAND = "pnpm build:catalog";
export const CATALOG_BUILD_ENTRY = resolve(
  import.meta.dirname,
  "../../packages/catalog/dist/index.js",
);
// Manifest paths are relative to data/ (galaxio's shape: "catalogs/<name>/v<N>/...").
export const CATALOG_DATA_ROOT = resolve(import.meta.dirname, "../../data");
export const CATALOG_MANIFEST_PATH = resolve(CATALOG_DATA_ROOT, "catalogs/manifest.json");

export async function loadCatalogPackage(
  specifier = process.env.CSSEARTH_CATALOG_URL ?? CATALOG_PACKAGE,
) {
  try {
    return await import(specifier);
  } catch (cause) {
    const hint = specifier === CATALOG_PACKAGE && !existsSync(CATALOG_BUILD_ENTRY)
      ? `The package build is missing at ${CATALOG_BUILD_ENTRY}; run ` +
        `\`${CATALOG_BUILD_COMMAND}\` (pnpm install runs it as well).`
      : `Set CSSEARTH_CATALOG_URL to override the module specifier.`;
    throw new Error(
      `Preparation needs the vendored catalogue package (${specifier}). ${hint}`,
      { cause },
    );
  }
}

// Resolves a catalogue by its manifest key (data/catalogs/manifest.json,
// galaxio's shape), reads it, and returns the parsed catalogue with the
// provenance the prepared module records: the manifest entry, the byte
// count and the SHA-256 of the exact file read.
export async function readVendoredCatalog(key) {
  const manifest = JSON.parse(await readFile(CATALOG_MANIFEST_PATH, "utf8"));
  const entry = manifest.assets?.[key];
  if (!entry || typeof entry.path !== "string") {
    throw new Error(`Catalogue ${key} is not in ${CATALOG_MANIFEST_PATH}.`);
  }
  const path = resolve(CATALOG_DATA_ROOT, entry.path);
  const bytes = await readFile(path);
  if (bytes.byteLength !== entry.bytes) {
    throw new Error(`Catalogue ${key} has ${bytes.byteLength} bytes; the manifest records ${entry.bytes}.`);
  }
  const { readCatalog } = await loadCatalogPackage();
  const catalog = readCatalog(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return Object.freeze({
    catalog,
    provenance: Object.freeze({
      key,
      path: `data/${entry.path}`,
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      source: entry.source,
      license: entry.license,
      url: entry.url,
      epoch: entry.epoch,
      built: entry.built,
    }),
  });
}
