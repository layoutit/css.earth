import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { OBJECTS } from "../site/objects.mjs";
import { auditObjectRuntimeOwnership } from "./check-object-runtime-ownership.mjs";
import { applyPreparedProjectiveLayout } from "../src/platform/prepared-projective-texture-leaf.mjs";

export function readPreparedExport(source) {
  const declaration = source.match(/^\s*(?:\/\/[^\n]*\n)*export const (\w+) = ([\s\S]*);\s*$/);
  if (!declaration) return null;
  const expression = declaration[2];
  try { return { name: declaration[1], value: JSON.parse(expression.startsWith("Object.freeze(") ? expression.slice(14, -1) : expression) }; }
  catch { return null; }
}
export function preparedStyleRecord(text) {
  const properties = new Map([...String(text).matchAll(/(?:^|;)\s*([\w-]+)\s*:\s*([^;]*)/g)].map(match => [match[1], match[2]]));
  return { width: properties.get("width") ?? "", height: properties.get("height") ?? "", backgroundSize: properties.get("background-size") ?? "",
    getPropertyValue: name => properties.get(name) ?? "" };
}
export async function censusPreparedLeafLayouts({ root = process.cwd(), objects = OBJECTS, ignoreLayouts = false } = {}) {
  const closure = await auditObjectRuntimeOwnership({ root, objects, strict: false });
  const reports = [];
  for (const object of closure.entries) {
    const modules = [];
    for (const file of object.closure.filter(file => file.startsWith(`src/planets/${object.id}/runtime/`))) {
      const source = await readFile(resolve(root, file), "utf8");
      const prepared = readPreparedExport(source);
      if (prepared) modules.push({ file, ...prepared });
    }
    const classes = {};
    for (const module of modules.filter(module => module.value.schema === "cssearth-prepared-leaf-layouts@1")) {
      for (const [file, expected] of Object.entries(module.value.sources)) {
        const bytes = await readFile(resolve(root, "src/planets", object.id, file));
        if (createHash("sha256").update(bytes).digest("hex") !== expected) throw new Error(`Prepared layout source drift: ${object.id}/${file}.`);
      }
      if (!ignoreLayouts) Object.assign(classes, module.value.classes);
    }
    const report = { id: object.id, count: 0, completedByDescriptor: 0, failures: [], modules: modules.map(({ file }) => file) };
    function visit(value, file, path, inherited = null) {
      if (!value || typeof value !== "object") return;
      const layout = classes[value.className] ?? inherited;
      if (value.projectiveTextureLayer) {
        report.count++;
        const scale = value.projectiveTextureLayer.rasterScale ?? 1;
        let incomplete = false;
        try { applyPreparedProjectiveLayout(preparedStyleRecord(value.style), null, scale); } catch { incomplete = true; }
        try {
          applyPreparedProjectiveLayout(preparedStyleRecord(value.style), layout, scale);
          if (incomplete) report.completedByDescriptor++;
        } catch (error) { report.failures.push({ file, path, error: error.message }); }
      }
      for (const [key, child] of Object.entries(value)) visit(child, file, `${path}.${key}`, layout);
    }
    for (const module of modules) visit(module.value, module.file, module.name);
    reports.push(report);
  }
  return { schema: "cssearth-prepared-leaf-layout-census@1", complete: reports.every(report => !report.failures.length), objects: reports };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await censusPreparedLeafLayouts({ ignoreLayouts: process.argv.includes("--ignore-layouts") });
  const index = process.argv.indexOf("--output");
  if (index >= 0) await writeFile(process.argv[index + 1], JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ complete: report.complete, objects: report.objects.map(({ id, count, completedByDescriptor, failures }) => ({ id, count, completedByDescriptor, failures: failures.length })) }, null, 2));
  if (!report.complete) process.exitCode = 1;
}
