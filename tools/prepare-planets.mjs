import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { parseAst } from "vite";
import cwebpPath from "cwebp-bin";
import { OBJECTS } from "../site/objects.mjs";
import { defaultPreparationConcurrency, runObjectCommand, runPreparationObjects } from "./run-implemented-planets.mjs";
import { fingerprintPreparationFiles, readPreparationReceipt, writePreparationReceipt } from "./preparation-cache.mjs";
import { readObjectPreparation } from "./object-preparation.mjs";
import { authoredObject } from './authored-object.mjs';

const sharedSteps = ["prepare-shell-titles.mjs", "prepare-wordmark-rail.mjs",
  "prepare-planet-title-sources.mjs", "prepare-scientific-charts.mjs"];
const cacheRoot = ".local/preparation";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const require = createRequire(import.meta.url);
const generatedModule = path => /\/(?:runtime|site)\/prepared[^/]*\.mjs$/.test(path);
const ignoredSource = path => /\/(?:test|oracle|node_modules)\//.test(path) || path.endsWith(".test.mjs");

export async function listPreparationFiles(root, directory) {
  const files = [];
  async function visit(path) {
    let entries;
    try { entries = await readdir(resolve(root, path), { withFileTypes: true }); }
    catch (error) { if (error.code === "ENOENT") return; throw error; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = `${path}/${entry.name}`;
      if (entry.name === ".DS_Store" || ignoredSource(child + (entry.isDirectory() ? "/" : ""))) continue;
      if (entry.isDirectory()) await visit(child);
      else files.push(child);
    }
  }
  await visit(directory);
  return files.sort();
}

export async function preparationFileSets(root, id) {
  const declaration = `src/planets/${id}/preparation.json`;
  let recipe;
  try { recipe = JSON.parse(await readFile(resolve(root, declaration), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  assert.equal(recipe.schema, "cssearth-preparation-inputs@1");
  assert.ok(Array.isArray(recipe.fileSets));
  const paths = [declaration];
  for (const set of recipe.fileSets) {
    for (const path of [set.manifest, set.directory]) {
      assert.ok(typeof path === "string" && path && !isAbsolute(path) && !path.split(/[\\/]/).includes(".."), "Unsafe preparation file set");
    }
    const manifest = JSON.parse(await readFile(resolve(root, set.manifest), "utf8"));
    assert.ok(typeof manifest.version === "string" && /^[a-zA-Z0-9_-]+$/.test(manifest.version));
    assert.ok(Array.isArray(manifest.files) && manifest.files.length);
    paths.push(set.manifest);
    const names = new Set();
    for (const file of manifest.files) {
      assert.ok(typeof file.filename === "string" && /^[a-zA-Z0-9_.-]+$/.test(file.filename) &&
        ![".", ".."].includes(file.filename) && !names.has(file.filename), "Unsafe or duplicate prepared input file");
      names.add(file.filename);
      paths.push(`${set.directory}/${manifest.version}/${file.filename}`);
    }
  }
  return paths;
}

export async function objectPreparationFiles(root, id) {
  assert.ok(OBJECTS.some(object => object.id === id), "Preparation object must belong to OBJECTS");
  const base = `src/planets/${id}`;
  if (await authoredObject(id, root)) {
    const descriptor = `${base}/object.json`;
    const directories = ['tools/objects', 'src/preparation', 'src/renderers/css/preparation', 'packages/objects/src'];
    const compiler = (await Promise.all(directories.map(directory => listPreparationFiles(root, directory)))).flat()
      .filter(path => !path.includes('/dist/') && !/\.test\.ts$/.test(path));
    const shared = await preparationDependencies(root, ['tools/prepared-node-tree.mjs', 'tools/prepared-cssom.mjs',
      'tools/prepare-materials.mjs', 'src/platform/prepare-cubic-sky-source.mjs', 'src/platform/prepare-directional-sun.mjs',
      'tools/objects/solar-system-scene.mjs', 'tools/objects/solar-system-presentation.mjs', 'tools/objects/solar-system-markers.mjs']);
    const outputs = [descriptor, `${base}/runtime-assets.json`, `${base}/prepared/object.json`,
      ...await listPreparationFiles(root, `${base}/prepared`), ...await listPreparationFiles(root, `public/scenes/${id}`)];
    return { inputs: [...new Set([descriptor, ...compiler, ...shared, ...await listPreparationFiles(root, `${base}/source`)])].sort(),
      outputs: [...new Set(outputs)].sort(), inputKinds: {[descriptor]: 'object-descriptor-authored@1'} };
  }
  const packageFiles = await listPreparationFiles(root, base);
  const source = JSON.parse(await readFile(resolve(root, base, "source/manifest.json"), "utf8"));
  const generatedSources = new Set(source.generatedIntermediates.map(entry => `${base}/source/${entry.path}`));
  const output = path => generatedModule(path) || path === `${base}/site/control-content.mjs` ||
    path === `${base}/runtime-assets.json` ||
    path.includes("/.prepared/") || generatedSources.has(path);
  const outputs = [...packageFiles.filter(output), ...await listPreparationFiles(root, `public/scenes/${id}`)];
  const generators = [`${base}/tools/prepare.mjs`];
  const content = `${base}/site/control-content.source.mjs`;
  const dependencies = await preparationDependencies(root, [...generators, content]);
  const descriptorPath = `${base}/object.json`;
  const inputKinds = dependencies.includes(descriptorPath) ? { [descriptorPath]: 'object-descriptor-authored@1' } : {};
  if (Object.hasOwn(inputKinds, descriptorPath)) outputs.push(descriptorPath, `${base}/prepared/object.json`);
  const inputs = [...dependencies.filter(path => !output(path)),
    ...packageFiles.filter(path => path.startsWith(`${base}/source/`) && !output(path)),
    ...await preparationFileSets(root, id)];
  // Editorial input is also a preparation output for packages which enrich it.
  // Its content is checked with all other outputs on every cache hit.
  const editorial = `data/planets/${id}.json`;
  try { await readFile(resolve(root, editorial)); outputs.push(editorial); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  return { inputs: [...new Set(inputs)].sort(), outputs: [...new Set(outputs)].sort(), inputKinds };
}

// Follow code imported by generators, including their literal CLI steps. Do
// not fingerprint whole runtime, shell or tooling directories.
export async function preparationDependencies(root, entries) {
  const visited = new Set();
  async function visit(path) {
    if (visited.has(path)) return;
    assert.ok(!path.startsWith("../") && !isAbsolute(path), "Preparation import escaped the project");
    visited.add(path);
    const source = await readFile(resolve(root, path), "utf8");
    if (!/\.mjs$/.test(path) || generatedModule(path)) return;
    const ast = parseAst(source);
    const dependencies = ast.body.filter(node => ["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type))
      .map(node => node.source?.value).filter(value => value?.startsWith("."));
    // Steps are executed by preparation-runner, rather than imported.
    if (path.endsWith("/tools/prepare.mjs")) {
      const recipeImport = ast.body.find(node => node.type === "ImportDeclaration" &&
        node.source.value.startsWith(".") &&
        resolve(root, dirname(path), node.source.value) === resolve(root, "tools/object-preparation.mjs"));
      if (recipeImport) {
        const binding = recipeImport.specifiers.find(specifier => specifier.type === "ImportSpecifier" &&
          specifier.imported.name === "runObjectPreparation")?.local.name;
        const calls = ast.body.filter(node => node.type === "ExpressionStatement" && node.expression.type === "AwaitExpression")
          .map(node => node.expression.argument).filter(node => node.type === "CallExpression" && node.callee.name === binding);
        assert.equal(calls.length, 1, "Preparation bridge must invoke its shared runner once");
        const call = calls[0], reference = call.arguments[0];
        assert.ok(call.arguments.length === 1 && reference?.type === "NewExpression" && reference.callee.name === "URL" &&
          reference.arguments.length === 2 && reference.arguments[0].value === "../object.json" &&
          reference.arguments[1].type === "MemberExpression" && reference.arguments[1].property.name === "url" &&
          reference.arguments[1].object.type === "MetaProperty" && reference.arguments[1].object.meta.name === "import" &&
          reference.arguments[1].object.property.name === "meta", "Preparation bridge must address its own descriptor");
        const descriptorPath = resolve(root, dirname(path), reference.arguments[0].value);
        const plan = await readObjectPreparation(descriptorPath, { projectRoot: root });
        dependencies.push(relative(resolve(root, dirname(path)), descriptorPath),
          ...plan.steps.map(([script]) => relative(resolve(root, dirname(path)), resolve(plan.toolDirectory, script))));
      } else {
      const declaration = ast.body.find(node => node.type === "VariableDeclaration" && node.declarations.some(value => value.id.name === "steps"));
      let value = declaration?.declarations.find(value => value.id.name === "steps").init;
      function findSteps(node) {
        if (!node || typeof node !== "object") return;
        if (node.type === "Property" && node.key.name === "steps") value = node.value;
        for (const child of Object.values(node)) if (Array.isArray(child)) child.forEach(findSteps);
        else if (child && typeof child === "object") findSteps(child);
      }
      if (!value) findSteps(ast);
      const steps = value?.type === "CallExpression" ? value.arguments[0] : value;
      assert.equal(steps?.type, "ArrayExpression", "Preparation steps must be a literal list");
      for (const step of steps.elements) {
        assert.equal(typeof step.elements?.[0]?.value, "string", "Preparation step must name its script");
        dependencies.push(step.elements[0].value);
      }
      }
    }
    for (const dependency of dependencies) await visit(relative(root, resolve(root, dirname(path), dependency)));
  }
  for (const entry of entries) await visit(entry);
  return [...visited].sort();
}

export async function sharedPreparationFiles() {
  return ["package.json", "pnpm-lock.yaml"];
}

export async function preparationEnvironment() {
  const dependencies = {};
  for (const name of ["@layoutit/polycss", "sharp"]) dependencies[name] = hash(await readFile(require.resolve(name)));
  for (const file of Object.keys(require.cache).filter(file => file.endsWith(".node") && file.includes("sharp")).sort()) {
    dependencies[basename(file)] = hash(await readFile(file));
  }
  return { node: process.version, platform: process.platform, arch: process.arch,
    sharp: sharp.versions, sharpConcurrency: sharp.concurrency(),
    cwebpSha256: hash(await readFile(cwebpPath)), dependencies };
}

export async function runCachedPreparationObjects({ projectRoot = process.cwd(), force = false,
  objectIds = OBJECTS.map(({ id }) => id), concurrency = defaultPreparationConcurrency(),
  runCommand = runObjectCommand, schedule = runPreparationObjects,
  environment = preparationEnvironment, sharedFiles = sharedPreparationFiles,
  packageFiles = objectPreparationFiles, onEvent = event => console.log(JSON.stringify(event)) } = {}) {
  assert.ok(Array.isArray(objectIds) && new Set(objectIds).size === objectIds.length &&
    objectIds.every(id => OBJECTS.some(object => object.id === id)), "Preparation requires unique IDs from OBJECTS");
  assert.equal(typeof force, "boolean");
  const root = resolve(projectRoot), shared = await sharedFiles(root), toolchain = await environment();
  const pending = [], cached = [];
  for (const id of objectIds) {
    assert.ok(OBJECTS.some(object => object.id === id), "Unknown preparation object");
    const files = await packageFiles(root, id);
    const inputPaths = [...new Set([...shared, ...files.inputs])].sort();
    const receipt = !force && await readPreparationReceipt({ root, path: `${cacheRoot}/${id}.json`, inputPaths,
      inputKinds: files.inputKinds });
    if (receipt && JSON.stringify(receipt.metadata?.toolchain) === JSON.stringify(toolchain) &&
        JSON.stringify(Object.keys(receipt.outputs)) === JSON.stringify(files.outputs)) {
      cached.push(id);
      onEvent({ phase: "verified-cache-hit", id, outputs: files.outputs.length });
    } else pending.push(id);
  }
  const report = await schedule({ projectRoot: root, objectIds: pending, concurrency, onEvent,
    runCommand: async request => {
      const files = await packageFiles(root, request.id);
      const inputPaths = [...new Set([...shared, ...files.inputs])].sort();
      const inputs = await fingerprintPreparationFiles(root, inputPaths, files.inputKinds);
      const result = await runCommand(request);
      if (result.exitCode === 0 && result.signal === null) {
        const after = await packageFiles(root, request.id);
        assert.deepEqual(after.inputs, files.inputs, `${request.id} preparation input set changed during generation`);
        assert.deepEqual(after.inputKinds, files.inputKinds, `${request.id} preparation input kinds changed during generation`);
        await writePreparationReceipt({ root, path: `${cacheRoot}/${request.id}.json`, inputs,
          inputKinds: files.inputKinds, outputPaths: after.outputs, metadata: { toolchain } });
      }
      return result;
    } });
  return { ...report, cached, rebuilt: pending, force };
}

export async function preparePlanets({ projectRoot = process.cwd(), force = false,
  objectIds = OBJECTS.map(({ id }) => id), concurrency = defaultPreparationConcurrency() } = {}) {
  const root = resolve(projectRoot), lock = resolve(root, cacheRoot, "running.lock");
  await mkdir(resolve(root, cacheRoot), { recursive: true });
  try { await writeFile(lock, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }) + "\n", { flag: "wx" }); }
  catch (error) {
    if (error.code === "EEXIST") throw new Error(`Another preparation owns ${lock}; do not run two writers in the same checkout.`, { cause: error });
    throw error;
  }
  const start = performance.now();
  try {
    for (const script of sharedSteps) {
      const result = await runObjectCommand({ command: process.execPath, argumentsList: [resolve(root, "tools", script)], cwd: root });
      assert.equal(result.exitCode, 0, `${script} failed`); assert.equal(result.signal, null);
    }
    const report = await runCachedPreparationObjects({ projectRoot: root, force, objectIds, concurrency });
    const navigation = await runObjectCommand({ command: process.execPath,
      argumentsList: [resolve(root, "tools/prepare-navigation.mjs")], cwd: root });
    assert.equal(navigation.exitCode, 0, "Navigation preparation failed"); assert.equal(navigation.signal, null);
    report.totalElapsedMilliseconds = performance.now() - start;
    await writeFile(resolve(root, cacheRoot, "latest-run.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(`Prepared ${report.rebuilt.length} objects; verified ${report.cached.length} unchanged objects in ${(report.totalElapsedMilliseconds / 1000).toFixed(1)}s.`);
    return report;
  } finally { await rm(lock, { force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const options = {};
  for (const argument of process.argv.slice(2)) {
    if (argument === "--") continue;
    if (argument === "--force") options.force = true;
    else if (argument.startsWith("--concurrency=")) options.concurrency = Number(argument.slice("--concurrency=".length));
    else if (argument.startsWith("--object=")) (options.objectIds ??= []).push(argument.slice("--object=".length));
    else throw new Error(`Unknown preparation argument: ${argument}`);
  }
  await preparePlanets(options);
}
