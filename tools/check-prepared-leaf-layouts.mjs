import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { OBJECTS } from "../site/objects.mjs";
import { auditObjectRuntimeOwnership } from "./check-object-runtime-ownership.mjs";
import { readPreparedPresentationModule } from "./check-prepared-presentation.mjs";
import { applyPreparedProjectiveLayout } from "../src/platform/prepared-projective-texture-leaf.mjs";

const cssName = name => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
const textureClass = node => node?.className?.split(/\s+/).includes("polycss-projective-texture");
export function preparedStyleRecord(text, assignments = []) {
  const properties = new Map([...String(text).matchAll(/(?:^|;)\s*([\w-]+)\s*:\s*([^;]*)/g)].map(match => [match[1], match[2]]));
  // Match the retained publisher: cssText first, then every dictionary reference
  // in order. The last assignment wins; initial layout values are not final CSS.
  for (const property of assignments) {
    if (!property || typeof property.name !== "string" || typeof property.value !== "string" || typeof property.custom !== "boolean") {
      throw new TypeError("Prepared projective property reference is invalid.");
    }
    properties.set(property.custom ? property.name : cssName(property.name), property.value);
  }
  return new Proxy({ getPropertyValue: name => properties.get(name) ?? "" }, {
    get: (target, name) => target[name] ?? properties.get(cssName(name)) ?? "",
  });
}

function missingLayoutProperties(style) {
  return ["width", "height", "backgroundSize"].filter(name => {
    const value = style[name] || (name !== "backgroundSize" && style.getPropertyValue(`--polycss-atlas-${name}`));
    return !value || value === "auto";
  });
}
function requireMatrix(value, label) {
  const matrix = /^matrix3d\(([^)]+)\)$/.exec(value);
  const values = matrix?.[1].split(",").map(Number);
  if (values?.length !== 16 || !values.every(Number.isFinite)) throw new TypeError(`Prepared projective ${label} transform is missing or invalid.`);
}
function requirePair(carrier, texture) {
  for (const name of ["width", "height"]) {
    const value = carrier[name] || carrier.getPropertyValue(`--polycss-atlas-${name}`);
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)px$/.test(value) || Number.parseFloat(value) <= 0) {
      throw new TypeError(`Prepared projective carrier requires explicit positive ${name}.`);
    }
    if (texture[name] !== "100%") throw new TypeError(`Prepared projective texture must fill its carrier ${name}.`);
  }
  // One auto dimension is valid for an intrinsic-ratio image. An absent address
  // or an entirely automatic/zero-sized layer cannot supply a prepared layout.
  if (!texture.backgroundSize || texture.backgroundSize.split(",").some(layer =>
      !layer.trim().split(/\s+/).some(value => /^\d+(?:\.\d*)?px$/.test(value) && Number.parseFloat(value) > 0))) {
    throw new TypeError("Prepared projective texture requires an explicit backgroundSize.");
  }
  if (carrier.transformStyle !== "preserve-3d" || texture.transformStyle !== "flat") {
    throw new TypeError("Prepared projective carrier/texture flattening is invalid.");
  }
  requireMatrix(carrier.transform, "carrier");
  requireMatrix(texture.transform, "texture");
}

export async function censusPreparedLeafLayouts({
  root = process.cwd(), objects = OBJECTS, ignoreLayouts = false,
  readText = path => readFile(path, "utf8"),
} = {}) {
  const closure = await auditObjectRuntimeOwnership({ root, objects, strict: false, readText });
  const reports = [];
  for (const object of closure.entries) {
    const file = object.presentation?.file ?? object.closure.find(file => file.endsWith("/runtime/preparedPresentation.mjs"));
    const report = { id: object.id, count: 0, completedByDescriptor: 0, failures: [...object.violations], modules: file ? [file] : [], sourceSha256: null };
    if (!file) {
      report.failures.push({ error: "Reachable normalized presentation data is missing." });
      reports.push(report); continue;
    }
    const source = await readText(resolve(root, file));
    report.sourceSha256 = createHash("sha256").update(source).digest("hex");
    let tree;
    try { tree = object.presentation?.format === 'json' ? JSON.parse(source).data.tree : readPreparedPresentationModule(source).tree; }
    catch (error) { report.failures.push({ file, error: error.message }); reports.push(report); continue; }
    const children = new Map();
    for (const node of tree.nodes) if (textureClass(node)) children.set(node.parent, (children.get(node.parent) ?? 0) + 1);
    for (const [index, node] of tree.nodes.entries()) {
      if (!textureClass(node)) continue;
      report.count++;
      try {
        const parent = tree.nodes[node.parent];
        if (!parent || node.parent < 0 || node.parent >= index || children.get(node.parent) !== 1) {
          throw new TypeError("Prepared projective texture requires one preceding carrier and one texture child.");
        }
        const original = preparedStyleRecord(parent.style), missing = missingLayoutProperties(original);
        const assignments = entry => entry.properties.map(id => {
          if (!Number.isSafeInteger(id) || id < 0 || id >= tree.properties.length) throw new TypeError("Prepared projective property reference is invalid.");
          return tree.properties[id];
        }).filter(property => !ignoreLayouts || !missing.includes(property.name));
        requirePair(preparedStyleRecord(parent.style, assignments(parent)), preparedStyleRecord(node.style, assignments(node)));
        // This detects the old stylesheet-only layout without depending on an
        // object id, private builder, or class-to-layout dispatch table.
        try { applyPreparedProjectiveLayout(original, null, 2); }
        catch { report.completedByDescriptor++; }
      } catch (error) { report.failures.push({ file, path: `PREPARED_PRESENTATION.tree.nodes[${index}]`, error: error.message }); }
    }
    if (!report.count) report.failures.push({ file, error: "No reachable prepared projective textures were found." });
    reports.push(report);
  }
  return {
    schema: "cssearth-prepared-leaf-layout-census@2", evidence: "validated-source-data",
    complete: closure.complete && reports.every(report => report.count > 0 && !report.failures.length),
    sharedViolations: closure.sharedViolations, objects: reports,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await censusPreparedLeafLayouts({ ignoreLayouts: process.argv.includes("--ignore-layouts") });
  const index = process.argv.indexOf("--output");
  if (index >= 0) await writeFile(process.argv[index + 1], JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ complete: report.complete, objects: report.objects.map(({ id, count, completedByDescriptor, failures }) => ({ id, count, completedByDescriptor, failures: failures.length })) }, null, 2));
  if (!report.complete) process.exitCode = 1;
}
