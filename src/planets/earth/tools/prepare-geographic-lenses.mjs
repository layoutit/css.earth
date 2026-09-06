import { readFile, writeFile, readdir, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { EARTH_PUBLIC_ROOT, EARTH_STAGING_ROOT } from "./preparation-paths.mjs";
import { requireGeographicScope, preparedEntityLenses } from "../../../platform/geographic-lens-applicability.mjs";
import { requireGeographicLensReference } from "../../../platform/geographic-lens-contract.mjs";

const root = new URL("../", import.meta.url);
const config = JSON.parse(await readFile(new URL("source/observations.json", root), "utf8"));
if (config.schema !== "cssearth-observation-inventory@1" || config.objectId !== "earth" ||
    !Array.isArray(config.datasets) || new Set(config.datasets.map(entry => entry.id)).size !== config.datasets.length) {
  throw new Error("Invalid observation inventory.");
}
const inventory = [], assets = new Set();
for (const entry of config.datasets) {
  requireGeographicScope(entry.scope);
  if (entry.scope.objectId !== config.objectId || !/^runtime\/prepared[A-Za-z]+\.mjs$/u.test(entry.prepared)) throw new Error("Invalid observation preparation module.");
  const prepared = await import(new URL(entry.prepared, root)), lens = prepared[entry.descriptorExport];
  requireGeographicLensReference(lens, `/scenes/${config.objectId}/`);
  if (lens.id !== entry.id) throw new Error("Prepared observation identity drifted.");
  inventory.push({ scope: entry.scope, lens });
  const urls = prepared[entry.assetsExport];
  if (!Array.isArray(urls) || !urls.includes(lens.package.url) || !urls.includes(lens.thumbnailUrl)) throw new Error("Observation asset inventory is incomplete.");
  for (const url of urls) {
    if (!url.startsWith(`/scenes/${config.objectId}/`) || url.includes("..") || url.includes("?")) throw new Error("Observation asset scope is invalid.");
    assets.add(url);
  }
}
await writeFile(new URL("runtime/preparedGeographicLenses.mjs", root),
  `// Generated observation references. Source payloads remain lazy packages.\nexport const PREPARED_GEOGRAPHIC_LENSES=${JSON.stringify(inventory)};\n` +
  `export const PREPARED_ROOT_GEOGRAPHIC_LENSES=${JSON.stringify(preparedEntityLenses(inventory, config.objectId, config.objectId))};\n` +
  `export const PREPARED_GEOGRAPHIC_ASSET_URLS=${JSON.stringify([...assets].sort())};\n`);
// Retain prior immutable observations outside the current public closure. This
// only moves hash-identified outputs owned by this inventory; nothing is deleted.
const archive = `${EARTH_STAGING_ROOT}/retired-observations`;
await mkdir(archive, { recursive: true });
for (const filename of await readdir(EARTH_PUBLIC_ROOT)) {
  const match = /^(?:geographic-lens-[a-z0-9-]+|geographic-roots|earth-land-cover-[a-z0-9-]+|earth-lens-land-cover)-([a-f0-9]{16})\.(?:json|pack|webp)$/u.exec(filename);
  if (!match || assets.has(`/scenes/${config.objectId}/${filename}`)) continue;
  const bytes = await readFile(`${EARTH_PUBLIC_ROOT}/${filename}`);
  if (!createHash("sha256").update(bytes).digest("hex").startsWith(match[1])) throw new Error("Retired observation asset identity drifted.");
  let previous;
  try { previous = await readFile(`${archive}/${filename}`); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (previous && !previous.equals(bytes)) throw new Error("Retired observation asset name collision.");
  await rename(`${EARTH_PUBLIC_ROOT}/${filename}`, `${archive}/${filename}`);
}
