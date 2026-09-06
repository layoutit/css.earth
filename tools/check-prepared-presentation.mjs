import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseAst } from "vite";
import { OBJECTS } from "../site/objects.mjs";
import { requirePreparedPresentation, PREPARED_OBJECT_RUNTIME_SCHEMA } from "../src/platform/prepared-presentation-contract.mjs";
import { requireObjectRuntimeDefinition } from "../src/platform/object-runtime-contract.mjs";

export function readPreparedJsonModule(source, expectedExport) {
  const match = source.match(/^\s*(?:\/\/[^\n]*\n\s*)*export const ([A-Z][A-Z0-9_]*)\s*=\s*([\s\S]*);\s*$/);
  if (!match || expectedExport && match[1] !== expectedExport) throw new TypeError("Prepared module must export one serialized JSON record.");
  const expression = match[2];
  return { name: match[1], value: JSON.parse(expression.startsWith("Object.freeze(") && expression.endsWith(")") ? expression.slice(14, -1) : expression) };
}
export function readPreparedJsonExports(source) {
  try { return [readPreparedJsonModule(source)]; } catch { /* Multiple literal exports are also data. */ }
  const ast = parseAst(source), exports = [];
  for (const statement of ast.body) {
    if (statement.type !== "ExportNamedDeclaration" || statement.declaration?.type !== "VariableDeclaration" || statement.declaration.kind !== "const") throw new TypeError("Prepared modules cannot contain executable statements.");
    for (const declaration of statement.declaration.declarations) {
      if (declaration.id.type !== "Identifier" || !/^[A-Z][A-Z0-9_]*$/.test(declaration.id.name)) throw new TypeError("Prepared module export is not a data binding.");
      const expression = source.slice(declaration.init.start, declaration.init.end);
      exports.push(readPreparedJsonModule(`export const ${declaration.id.name} = ${expression};`));
    }
  }
  if (!exports.length) throw new TypeError("Prepared module has no data exports.");
  return exports;
}
export function readPreparedPresentationModule(source) {
  return readPreparedJsonModule(source, "PREPARED_PRESENTATION").value;
}
export function requirePreparedDefinitionSource(source) {
  const ast = parseAst(source);
  const imports = ast.body.filter(node => node.type === "ImportDeclaration");
  if (imports.length !== 3 || imports.some(node => node.specifiers.length !== 1 ||
      node.specifiers[0].type !== "ImportSpecifier" || node.attributes?.length)) {
    throw new TypeError("Prepared definition requires its three named data bindings only.");
  }
  const bindings = new Map(imports.flatMap(node => node.specifiers.map(specifier =>
    [specifier.local.name, { name: specifier.imported?.name, path: node.source.value }])));
  const declared = ast.body.filter(node => node.type === "ExportNamedDeclaration");
  if (ast.body.length !== imports.length + 1 || declared.length !== 1) throw new TypeError("Prepared definition must contain static imports and one data export.");
  const declaration = declared[0].declaration?.declarations;
  if (declared[0].declaration?.kind !== "const" || declaration?.length !== 1 || declaration[0].id.name !== "runtimeDefinition") throw new TypeError("Prepared runtime definition export is missing.");
  const call = declaration[0].init;
  if (call?.type !== "CallExpression" || call.optional || call.callee?.computed || call.callee?.object?.name !== "Object" || call.callee.property?.name !== "freeze" || call.arguments.length !== 1 || bindings.has("Object")) throw new TypeError("Prepared definition must freeze its data binding.");
  const properties = call.arguments[0]?.properties;
  if (call.arguments[0]?.type !== "ObjectExpression" || properties.length !== 4 || properties[0]?.type !== "SpreadElement" ||
      bindings.get(properties[0].argument?.name)?.name !== "PREPARED_PRESENTATION" || bindings.get(properties[0].argument?.name)?.path !== "./preparedPresentation.mjs") throw new TypeError("Prepared definition must bind its prepared presentation data.");
  if (properties.slice(1).some(property => property.type !== "Property" || property.kind !== "init" || property.method || property.computed)) throw new TypeError("Prepared definition cannot contain executable or computed bindings.");
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

// Content modules may project prepared labels into shell content. They cannot
// install behavior, call arbitrary helpers, or hide side effects in a callback.
export function requirePreparedControlSource(source) {
  const ast = parseAst(source), bindings = new Set(["undefined"]), imports = [];
  const fail = () => { throw new TypeError("Object controls must only project static prepared content."); };
  function expression(node, scope = bindings) {
    if (!node) return fail();
    switch (node.type) {
      case "Literal": if (node.regex || node.bigint) fail(); return;
      case "Identifier": if (!scope.has(node.name)) fail(); return;
      case "MemberExpression": expression(node.object, scope); if (node.computed) expression(node.property, scope); return;
      case "ObjectExpression": for (const property of node.properties) {
        if (property.type !== "Property" || property.kind !== "init" || property.method || property.computed) fail();
        expression(property.value, scope);
      } return;
      case "ArrayExpression": node.elements.forEach(value => expression(value, scope)); return;
      case "TemplateLiteral": node.expressions.forEach(value => expression(value, scope)); return;
      case "ConditionalExpression": for (const key of ["test", "consequent", "alternate"]) expression(node[key], scope); return;
      case "BinaryExpression": case "LogicalExpression": expression(node.left, scope); expression(node.right, scope); return;
      case "UnaryExpression": if (!["!", "-", "+"].includes(node.operator)) fail(); expression(node.argument, scope); return;
      case "CallExpression": {
        const callee = node.callee;
        if (node.optional || callee?.computed || node.arguments.length !== 1) return fail();
        if (callee?.object?.name === "Object" && callee.property?.name === "freeze" && !bindings.has("Object")) return expression(node.arguments[0], scope);
        if (callee?.type !== "MemberExpression" || callee.property?.name !== "map") return fail();
        expression(callee.object, scope);
        const callback = node.arguments[0];
        if (callback.type !== "ArrowFunctionExpression" || callback.async || !callback.expression || callback.params.length !== 1 || callback.params[0].type !== "Identifier") return fail();
        expression(callback.body, new Set([...scope, callback.params[0].name])); return;
      }
      default: fail();
    }
  }
  let exports = 0;
  for (const statement of ast.body) {
    if (statement.type === "ImportDeclaration") {
      if (!statement.specifiers.length || !statement.source.value.startsWith(".") || !statement.source.value.endsWith(".mjs") || statement.attributes?.length) fail();
      for (const specifier of statement.specifiers) {
        if (specifier.type !== "ImportSpecifier" || !/^PREPARED_[A-Z0-9_]+$/.test(specifier.imported.name)) fail();
        bindings.add(specifier.local.name);
      }
      imports.push(statement.source.value); continue;
    }
    const exported = statement.type === "ExportNamedDeclaration";
    const declaration = exported ? statement.declaration : statement;
    if (declaration?.type !== "VariableDeclaration" || declaration.kind !== "const") fail();
    for (const variable of declaration.declarations) {
      if (variable.id.type !== "Identifier" || exported && variable.id.name !== "objectControls") fail();
      expression(variable.init); bindings.add(variable.id.name);
      if (exported) exports++;
    }
  }
  if (exports !== 1) fail();
  return imports;
}

export async function auditPreparedPresentations({ root = process.cwd(), objects = OBJECTS, strict = true,
  readText = path => readFile(path, "utf8"), readControls = async path => (await import(pathToFileURL(path))).objectControls } = {}) {
  const entries = [];
  for (const object of objects) {
    try {
      const prefix = resolve(root, `src/planets/${object.id}`);
      const definitionSource = await readText(`${prefix}/runtime/definition.mjs`);
      const id = requirePreparedDefinitionSource(definitionSource);
      if (id !== object.id) throw new TypeError("Prepared definition names another object.");
      const presentationSource = await readText(`${prefix}/runtime/preparedPresentation.mjs`);
      const plan = readPreparedPresentationModule(presentationSource);
      const controlSource = await readText(`${prefix}/site/control-content.mjs`);
      requirePreparedControlSource(controlSource);
      const objectControls = await readControls(`${prefix}/site/control-content.mjs`);
      requirePreparedPresentation(plan, { controls: objectControls });
      requireObjectRuntimeDefinition({ ...plan, schema: PREPARED_OBJECT_RUNTIME_SCHEMA, id, controls: objectControls });
      const sha256 = value => createHash("sha256").update(value).digest("hex");
      entries.push({ id, complete: true, evidence: "validated-source-data", observedOwners: null,
        source: { definitionSha256: sha256(definitionSource), presentationSha256: sha256(presentationSource), controlsSha256: sha256(controlSource) },
        nodes: plan.tree.nodes.length, roots: plan.tree.nodes.filter(node => node.parent === -1).length,
        variants: plan.variants.length,
        controls: { lenses: objectControls.lenses?.controls.map(lens => lens.id) ?? [],
          settings: objectControls.settings?.controls.map(({ name, kind }) => ({ name, kind })) ?? [] },
        materialTracks: plan.materials.map(track => ({ id: track.id, frame: track.frame,
          demand: track.demand, rotation: track.rotation?.kind ?? null, banks: track.banks.length })),
        resources: plan.assets.entries.length, pools: plan.assets.pools,
        cameraNodes: plan.tree.nodes.filter(node => /(?:^|\s)polycss-camera(?:\s|$)/.test(node.className)).length,
        sceneNodes: plan.tree.nodes.filter(node => /(?:^|\s)polycss-scene(?:\s|$)/.test(node.className)).length,
        camera: plan.camera,
        viewBindings: plan.viewBindings, animations: plan.animations.map(({ id, mode, target }) => ({ id, mode, target })),
        pageLayers: (plan.pageLayers ?? []).map(({ lensIds, plan: layer }) => ({ lensIds, schema: layer.schema,
          roots: layer.roots?.length ?? 0, poolSize: layer.poolSize ?? null })),
        destinations: plan.destinations ? { defaultLens: plan.destinations.defaultLens, catalog: plan.destinations.catalog } : null });
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
