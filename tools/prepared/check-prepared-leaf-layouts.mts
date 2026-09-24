import { sha256 } from '@cssearth/core/node';
import {requireRecord,requireString,shape,array,text,number,boolean,dictionary,optional} from '@cssearth/core';
const parseProperty=shape({name:text,value:text,custom:boolean});
const parseNode=shape({parent:number,tag:text,style:(value:unknown)=>value,attributes:optional(dictionary(text)),properties:array(number)});
const parseTree=shape({nodes:array(parseNode),properties:array(parseProperty)});
type TreeNode=ReturnType<typeof parseNode>;
interface StyleRecord {width:string;height:string;backgroundSize:string;backgroundPosition:string;transformStyle:string;transform:string;getPropertyValue(name:string):string;}
interface LayoutFailure {file?:string;path?:string;error?:string;line?:number;reason?:string;}
interface LayoutReport {id:string;count:number;completedByDescriptor:number;failures:LayoutFailure[];modules:string[];sourceSha256:string|null;}
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SCENE_OBJECTS } from "../../site/objects.mts";
import { auditObjectRuntimeOwnership } from "../ci/check-object-runtime-ownership.mts";
import { readPreparedPresentationModule } from "./check-prepared-presentation.mts";
import { applyPreparedProjectiveLayout } from "./projective-layout.mts";

const cssName = (name:string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
const projectiveLeaf = (node:TreeNode) => node?.attributes?.["data-prepared-projection"] === "single-leaf";
const rasterTriangle = (node:TreeNode) => node?.tag === "u" &&
  node.attributes?.["data-polycss-texture-leaf-sizing"] === "raster" &&
  node.attributes?.["data-polycss-texture-backend"] === "atlas";
export function preparedStyleRecord(text:unknown, assignments:readonly unknown[] = []):StyleRecord {
  const properties = new Map([...String(text).matchAll(/(?:^|;)\s*([\w-]+)\s*:\s*([^;]*)/g)].map(match => [match[1], match[2]]));
  // Match the retained publisher: cssText first, then every dictionary reference
  // in order. The last assignment wins; initial layout values are not final CSS.
  for (const input of assignments) {
    const property=parseProperty(input);
    if (!property || typeof property.name !== "string" || typeof property.value !== "string" || typeof property.custom !== "boolean") {
      throw new TypeError("Prepared projective property reference is invalid.");
    }
    properties.set(property.custom ? property.name : cssName(property.name), property.value);
  }
  return new Proxy({ getPropertyValue: (name:string) => properties.get(name) ?? "" }, {
    get: (target, name) => Reflect.get(target,name) ?? (typeof name === 'string' ? properties.get(cssName(name)) : undefined) ?? "",
  }) as StyleRecord;
}

function missingLayoutProperties(style:StyleRecord) {
  return (["width", "height", "backgroundSize"] as const).filter(name => {
    const value = style[name] || (name !== "backgroundSize" && style.getPropertyValue(`--polycss-atlas-${name}`));
    return !value || value === "auto";
  });
}
// A projective surface leaf may follow its matrix with the prepared seam outset:
// a scale about the leaf centre driven by the body's silhouette-stepped property.
const SCALE = String.raw`\d+(?:\.\d+)?(?:e[+-]?\d+)?`;
const SEAM_OUTSET = new RegExp(String.raw`^ translate\(50%, 50%\) scale\(calc\(1 \+ var\((--[a-z][a-z0-9-]*), 0\) \* ${SCALE}\), calc\(1 \+ var\(\1, 0\) \* ${SCALE}\)\) translate\(-50%, -50%\)$`);
function requireMatrix(value:string, label:string, seamOutset = false) {
  const matrix = /^matrix3d\(([^)]+)\)(.*)$/.exec(value);
  const values = matrix?.[1].split(",").map(Number), suffix = matrix?.[2] ?? "";
  if (values?.length !== 16 || !values.every(Number.isFinite) || suffix !== "" && !(seamOutset && SEAM_OUTSET.test(suffix))) {
    throw new TypeError(`Prepared projective ${label} transform is missing or invalid.`);
  }
  return values;
}
function requireLeaf(carrier:StyleRecord, nativeRaster = false) {
  for (const name of ["width", "height"] as const) {
    const value = carrier[name] || carrier.getPropertyValue(`--polycss-atlas-${name}`);
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)px$/.test(value) || Number.parseFloat(value) <= 0) {
      throw new TypeError(`Prepared projective carrier requires explicit positive ${name}.`);
    }
  }
  // One auto dimension is valid for an intrinsic-ratio image. An absent address
  // or an entirely automatic/zero-sized layer cannot supply a prepared layout.
  if (!carrier.backgroundSize || carrier.backgroundSize.split(",").some(layer =>
      !layer.trim().split(/\s+/).some(value => /^\d+(?:\.\d*)?px$/.test(value) && Number.parseFloat(value) > 0))) {
    throw new TypeError("Prepared projective texture requires an explicit backgroundSize.");
  }
  // Native u triangles receive their base primitive styles from PolyCSS CSS.
  // Their dimensions, atlas address and affine matrix still belong to data.
  if ((!nativeRaster || carrier.transformStyle) && carrier.transformStyle !== "preserve-3d") {
    throw new TypeError("Prepared projective carrier/texture flattening is invalid.");
  }
  const matrix = requireMatrix(carrier.transform, "carrier", !nativeRaster);
  if (nativeRaster) {
    if ([3, 7, 11].some(index => matrix[index] !== 0) || matrix[15] !== 1) {
      throw new TypeError("Prepared native raster triangle requires an affine transform.");
    }
    if (carrier.getPropertyValue("--polycss-atlas-leaf-sizing") !== "raster" ||
        !/^-?\d+(?:\.\d+)?px\s+-?\d+(?:\.\d+)?px$/.test(carrier.backgroundPosition)) {
      throw new TypeError("Prepared native raster triangle requires its raster sizing and texture address.");
    }
  }
}

export async function censusPreparedLeafLayouts({
  root = process.cwd(), objects = SCENE_OBJECTS, ignoreLayouts = false,
  readText = path => readFile(path, "utf8"),
}:Pick<NonNullable<Parameters<typeof auditObjectRuntimeOwnership>[0]>,'root'|'objects'|'readText'> & {ignoreLayouts?:boolean} = {}) {
  const closure = await auditObjectRuntimeOwnership({ root, objects, strict: false, readText });
  const reports:LayoutReport[] = [];
  for (const object of closure.entries) {
    const file = object.presentation?.file ?? object.closure.find(file => file.endsWith("/runtime/preparedPresentation.mjs"));
    const report:LayoutReport = { id: object.id, count: 0, completedByDescriptor: 0, failures: [...object.violations], modules: file ? [file] : [], sourceSha256: null };
    if (!file) {
      report.failures.push({ error: "Reachable normalized presentation data is missing." });
      reports.push(report); continue;
    }
    const source = await readText(resolve(root, file));
    report.sourceSha256 = sha256(source);
    let tree:ReturnType<typeof parseTree>;
    try { const plan=object.presentation?.format === 'json' ? requireRecord(JSON.parse(source)).data : readPreparedPresentationModule(source);tree=parseTree(requireRecord(plan).tree); }
    catch (error) { report.failures.push({ file, error: error instanceof Error ? error.message : String(error) }); reports.push(report); continue; }
    const children = new Map<number,number>();
    for (const node of tree.nodes) children.set(node.parent, (children.get(node.parent) ?? 0) + 1);
    for (const [index, node] of tree.nodes.entries()) {
      const nativeRaster = rasterTriangle(node);
      if (!projectiveLeaf(node) && !nativeRaster) continue;
      report.count++;
      try {
        if (node.parent < 0 || node.parent >= index || children.has(index)) {
          throw new TypeError("Prepared projective raster requires one leaf without nested texture children.");
        }
        const original = preparedStyleRecord(node.style), missing = missingLayoutProperties(original);
        const assignments = (entry:TreeNode) => entry.properties.map(id => {
          if (!Number.isSafeInteger(id) || id < 0 || id >= tree.properties.length) throw new TypeError("Prepared projective property reference is invalid.");
          return tree.properties[id];
        }).filter(property => !ignoreLayouts || !missing.some(name=>name===property.name));
        requireLeaf(preparedStyleRecord(node.style, assignments(node)), nativeRaster);
        // This detects the old stylesheet-only layout without depending on an
        // object id, private builder, or class-to-layout dispatch table.
        if (!nativeRaster) {
          try { applyPreparedProjectiveLayout(original, null, 2); }
          catch { report.completedByDescriptor++; }
        }
      } catch (error) { report.failures.push({ file, path: `PREPARED_PRESENTATION.tree.nodes[${index}]`, error: error instanceof Error ? error.message : String(error) }); }
    }
    if (!report.count) report.failures.push({ file, error: "No reachable prepared textures were found." });
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
  if (index >= 0) await writeFile(requireString(process.argv[index + 1]), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ complete: report.complete, objects: report.objects.map(({ id, count, completedByDescriptor, failures }) => ({ id, count, completedByDescriptor, failures: failures.length })) }, null, 2));
  if (!report.complete) process.exitCode = 1;
}
