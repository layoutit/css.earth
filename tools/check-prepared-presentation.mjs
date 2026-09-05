import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseAst } from "vite";
import { OBJECTS } from "../site/objects.mjs";
import { requirePreparedPresentation, PREPARED_OBJECT_RUNTIME_SCHEMA } from "../src/platform/prepared-presentation-contract.mjs";
import { requireObjectRuntimeDefinition } from "../src/platform/object-runtime-contract.mjs";

export function readPreparedPresentationModule(source) {
  const match = source.match(/^(?:\/\/[^\n]*\n)*export const PREPARED_PRESENTATION = Object\.freeze\(([\s\S]*)\);\s*$/);
  if (!match) throw new TypeError("Prepared presentation must export one serialized JSON record.");
  return JSON.parse(match[1]);
}
export function requirePreparedDefinitionSource(source) {
  const ast = parseAst(source);
  const imports = ast.body.filter(node => node.type === "ImportDeclaration");
  const bindings = new Map(imports.flatMap(node => node.specifiers.map(specifier =>
    [specifier.local.name, { name: specifier.imported?.name, path: node.source.value }])));
  const declared = ast.body.filter(node => node.type === "ExportNamedDeclaration");
  if (ast.body.length !== imports.length + 1 || declared.length !== 1) throw new TypeError("Prepared definition must contain static imports and one data export.");
  const declaration = declared[0].declaration?.declarations;
  if (declaration?.length !== 1 || declaration[0].id.name !== "runtimeDefinition") throw new TypeError("Prepared runtime definition export is missing.");
  const call = declaration[0].init;
  if (call?.type !== "CallExpression" || call.callee?.object?.name !== "Object" || call.callee.property?.name !== "freeze" || call.arguments.length !== 1) throw new TypeError("Prepared definition must freeze its data binding.");
  const properties = call.arguments[0]?.properties;
  if (call.arguments[0]?.type !== "ObjectExpression" || properties.length !== 4 || properties[0]?.type !== "SpreadElement" ||
      bindings.get(properties[0].argument?.name)?.name !== "PREPARED_PRESENTATION" || bindings.get(properties[0].argument?.name)?.path !== "./preparedPresentation.mjs") throw new TypeError("Prepared definition must bind its prepared presentation data.");
  const values = new Map(properties.slice(1).map(property => [property.key.name, property.value]));
  if (values.size !== 3 || !["schema", "id", "controls"].every(key => values.has(key)) ||
      bindings.get(values.get("schema")?.name)?.name !== "PREPARED_OBJECT_RUNTIME_SCHEMA" ||
      bindings.get(values.get("schema")?.name)?.path !== "../../../platform/prepared-presentation-contract.mjs" ||
      bindings.get(values.get("controls")?.name)?.name !== "objectControls" ||
      bindings.get(values.get("controls")?.name)?.path !== "../site/control-content.mjs" ||
      values.get("id")?.type !== "Literal" || typeof values.get("id").value !== "string" || imports.length !== 3) {
    throw new TypeError("Prepared definition contains unsupported execution or bindings.");
  }
  return values.get("id").value;
}
export async function auditPreparedPresentations({ root = process.cwd(), objects = OBJECTS, strict = true } = {}) {
  const entries = [];
  for (const object of objects) {
    try {
      const prefix = resolve(root, `src/planets/${object.id}`);
      const id = requirePreparedDefinitionSource(await readFile(`${prefix}/runtime/definition.mjs`, "utf8"));
      if (id !== object.id) throw new TypeError("Prepared definition names another object.");
      const plan = readPreparedPresentationModule(await readFile(`${prefix}/runtime/preparedPresentation.mjs`, "utf8"));
      const { objectControls } = await import(pathToFileURL(`${prefix}/site/control-content.mjs`));
      requirePreparedPresentation(plan, { controls: objectControls });
      requireObjectRuntimeDefinition({ ...plan, schema: PREPARED_OBJECT_RUNTIME_SCHEMA, id, controls: objectControls });
      entries.push({ id, complete: true, nodes: plan.tree.nodes.length, variants: plan.variants.length,
        materialTracks: plan.materials.map(track => ({ id: track.id, frame: track.frame,
          demand: track.demand, rotation: track.rotation?.kind ?? null, banks: track.banks.length })),
        resources: plan.assets.entries.length, pools: plan.assets.pools, cameraNodes: 1,
        viewBindings: plan.viewBindings, animations: plan.animations.map(animation => ({ id: animation.id, mode: animation.mode })) });
    } catch (error) { entries.push({ id: object.id, complete: false, error: error.message }); }
  }
  const report = { schema: "cssearth-prepared-presentation-audit@1", complete: entries.every(entry => entry.complete), entries };
  if (strict && !report.complete) throw new TypeError(entries.filter(entry => !entry.complete).map(entry => `${entry.id}: ${entry.error}`).join("\n"));
  return report;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2), index = args.indexOf("--object"), id = index < 0 ? null : args[index + 1];
  if (id && !OBJECTS.some(object => object.id === id)) throw new Error(`Unknown registered object: ${id}`);
  if (!id && !args.includes("--all") && !args.includes("--inventory")) throw new Error("Use --object ID, --all, or --inventory.");
  const report = await auditPreparedPresentations({ objects: id ? OBJECTS.filter(object => object.id === id) : OBJECTS, strict: !args.includes("--inventory") });
  console.log(JSON.stringify(report, null, 2));
}
