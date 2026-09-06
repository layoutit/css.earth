import { readFile, writeFile } from "node:fs/promises";
import { requireGeographicScope, preparedEntityLenses } from "../../../platform/geographic-lens-applicability.mjs";
import { requireGeographicLensReference } from "../../../platform/geographic-lens-contract.mjs";

const root = new URL("../", import.meta.url);
const config = JSON.parse(await readFile(new URL("source/observations.json", root), "utf8"));
if (config.schema !== "cssearth-observation-inventory@1" || config.objectId !== "earth" ||
    !Array.isArray(config.datasets) || new Set(config.datasets.map(entry => entry.id)).size !== config.datasets.length) {
  throw new Error("Invalid observation inventory.");
}
const inventory = [];
for (const entry of config.datasets) {
  requireGeographicScope(entry.scope);
  if (entry.scope.objectId !== config.objectId || !/^runtime\/prepared[A-Za-z]+\.mjs$/u.test(entry.prepared)) throw new Error("Invalid observation preparation module.");
  const lens = (await import(new URL(entry.prepared, root)))[entry.descriptorExport];
  requireGeographicLensReference(lens, `/scenes/${config.objectId}/`);
  if (lens.id !== entry.id) throw new Error("Prepared observation identity drifted.");
  inventory.push({ scope: entry.scope, lens });
}
await writeFile(new URL("runtime/preparedGeographicLenses.mjs", root),
  `// Generated observation references. Source payloads remain lazy packages.\nexport const PREPARED_GEOGRAPHIC_LENSES=${JSON.stringify(inventory)};\n` +
  `export const PREPARED_ROOT_GEOGRAPHIC_LENSES=${JSON.stringify(preparedEntityLenses(inventory, config.objectId, config.objectId))};\n`);
