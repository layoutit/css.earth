import { isArray } from '../src/platform/is-array.mts';
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import type { Node, ImportDeclaration, VariableDeclaration } from 'estree';
import { parseRuntimeSource } from './runtime-source-graph.mts';
import { nodeName } from './runtime-ast.mts';
import { hasErrorCode, isRecord, requireRecord, requireArray, requireString } from './source-values.mts';
import type { PreparationOptions, PreparationEvent, PreparationCommand, ObjectCommandOutcome } from './run-implemented-planets.mts';
import type { PreparationInputKinds } from './preparation-cache.mts';
export interface PreparationFileSet {inputs: string[]; outputs: string[]; inputKinds?: PreparationInputKinds;}
type CacheEvent = PreparationEvent | {phase: 'verified-cache-hit'; id: string; outputs: number};
export interface CachedPreparationOptions extends Omit<PreparationOptions, 'onEvent' | 'argumentsList'> {
  force?: boolean; schedule?: typeof runPreparationObjects;
  environment?: () => Promise<Record<string, unknown>>;
  sharedFiles?: (root: string) => Promise<readonly string[]>;
  packageFiles?: (root: string, id: string) => Promise<PreparationFileSet>;
  onEvent?: (event: CacheEvent) => void;
}

import cwebpPath from "cwebp-bin";
import { OBJECTS } from "../site/objects.mts";
import { defaultPreparationConcurrency, runObjectCommand, runPreparationObjects } from "./run-implemented-planets.mts";
import { fingerprintPreparationFiles, readPreparationReceipt, writePreparationReceipt } from "./preparation-cache.mts";
import { readObjectPreparation } from "./object-preparation.mts";
import { authoredObject } from './authored-object.mts';

const sharedSteps = ["prepare-shell-titles.mts", "prepare-wordmark-rail.mts",
  "prepare-planet-title-sources.mts", "prepare-scientific-charts.mts"];
const cacheRoot = ".local/preparation";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const require = createRequire(import.meta.url);
const generatedModule = (path: string) => /\/(?:runtime|site)\/prepared[^/]*\.mjs$/.test(path);
const ignoredSource = (path: string) => /\/(?:test|oracle|node_modules)\//.test(path) || path.endsWith(".test.mjs");

export async function listPreparationFiles(root: string, directory: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(path: string): Promise<void> {
    let entries;
    try { entries = await readdir(resolve(root, path), { withFileTypes: true }); }
    catch (error) { if (hasErrorCode(error, "ENOENT")) return; throw error; }
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

export async function preparationFileSets(root: string, id: string) {
  const declaration = `src/planets/${id}/preparation.json`;
  let recipe;
  try { recipe = requireRecord(JSON.parse(await readFile(resolve(root, declaration), "utf8"))); }
  catch (error) { if (hasErrorCode(error, "ENOENT")) return []; throw error; }
  assert.equal(recipe.schema, "cssearth-preparation-inputs@1");
  assert.ok(isArray(recipe.fileSets));
  const paths = [declaration];
  for (const value of requireArray(recipe.fileSets)) {
    const set = requireRecord(value);
    for (const path of [set.manifest, set.directory]) {
      assert.ok(typeof path === "string" && path && !isAbsolute(path) && !path.split(/[\\/]/).includes(".."), "Unsafe preparation file set");
    }
    const manifest = requireRecord(JSON.parse(await readFile(resolve(root, requireString(set.manifest)), "utf8")));
    assert.ok(typeof manifest.version === "string" && /^[a-zA-Z0-9_-]+$/.test(manifest.version));
    assert.ok(isArray(manifest.files) && manifest.files.length);
    paths.push(requireString(set.manifest));
    const names = new Set();
    for (const value of requireArray(manifest.files)) {
      const file = requireRecord(value);
      assert.ok(typeof file.filename === "string" && /^[a-zA-Z0-9_.-]+$/.test(file.filename) &&
        ![".", ".."].includes(file.filename) && !names.has(file.filename), "Unsafe or duplicate prepared input file");
      names.add(file.filename);
      paths.push(`${set.directory}/${manifest.version}/${file.filename}`);
    }
  }
  return paths;
}

export async function objectPreparationFiles(root: string, id: string): Promise<PreparationFileSet> {
  assert.ok(OBJECTS.some(object => object.id === id), "Preparation object must belong to OBJECTS");
  const base = `src/planets/${id}`;
  if (await authoredObject(id, root)) {
    const descriptor = `${base}/object.json`;
    const directories = ['tools/objects', 'src/preparation', 'src/renderers/css/preparation', 'packages/objects/src'];
    const compiler = (await Promise.all(directories.map(directory => listPreparationFiles(root, directory)))).flat()
      .filter(path => !path.includes('/dist/') && !/\.test\.ts$/.test(path));
    const shared = await preparationDependencies(root, ['tools/prepare-surface-minimaps.mts', 'tools/prepared-node-tree.mts', 'tools/prepared-cssom.mts',
      'tools/prepare-materials.mts', 'src/platform/prepare-cubic-sky-source.mts', 'src/platform/prepare-directional-sun.mts',
      'tools/objects/solar-system-scene.mts', 'tools/objects/solar-system-presentation.mts', 'tools/objects/solar-system-markers.mts',
      'tools/objects/provenance.mts']);
    const outputs = [descriptor, `${base}/runtime-assets.json`, `${base}/prepared/object.json`,
      ...await listPreparationFiles(root, `${base}/prepared`), ...await listPreparationFiles(root, `public/scenes/${id}`)];
    return { inputs: [...new Set([descriptor, ...compiler, ...shared, ...await listPreparationFiles(root, `${base}/source`)])].sort(),
      outputs: [...new Set(outputs)].sort(), inputKinds: {[descriptor]: 'object-descriptor-authored@1'} };
  }
  const packageFiles = await listPreparationFiles(root, base);
  const source = requireRecord(JSON.parse(await readFile(resolve(root, base, "source/manifest.json"), "utf8")));
  const generatedSources = new Set(requireArray(source.generatedIntermediates).map(value => `${base}/source/${requireString(requireRecord(value).path)}`));
  const output = (path: string) => generatedModule(path) || path === `${base}/site/control-content.mjs` ||
    path === `${base}/runtime-assets.json` ||
    path.includes("/.prepared/") || generatedSources.has(path);
  const outputs = [...packageFiles.filter(output), ...await listPreparationFiles(root, `public/scenes/${id}`)];
  const generators = [`${base}/tools/prepare.mjs`];
  const content = `${base}/site/control-content.source.mjs`;
  const dependencies = await preparationDependencies(root, [...generators, content]);
  const descriptorPath = `${base}/object.json`;
  const inputKinds: PreparationInputKinds = dependencies.includes(descriptorPath) ? { [descriptorPath]: 'object-descriptor-authored@1' } : {};
  if (Object.hasOwn(inputKinds, descriptorPath)) outputs.push(descriptorPath, `${base}/prepared/object.json`);
  const inputs = [...dependencies.filter(path => !output(path)),
    ...packageFiles.filter(path => path.startsWith(`${base}/source/`) && !output(path)),
    ...await preparationFileSets(root, id)];
  // Editorial input is also a preparation output for packages which enrich it.
  // Its content is checked with all other outputs on every cache hit.
  const editorial = `data/planets/${id}.json`;
  try { await readFile(resolve(root, editorial)); outputs.push(editorial); }
  catch (error) { if (!hasErrorCode(error, "ENOENT")) throw error; }
  return { inputs: [...new Set(inputs)].sort(), outputs: [...new Set(outputs)].sort(), inputKinds };
}

// Follow code imported by generators, including their literal CLI steps. Do
// not fingerprint whole runtime, shell or tooling directories.
export async function preparationDependencies(root: string, entries: readonly string[]): Promise<string[]> {
  const visited = new Set<string>();
  async function visit(path: string): Promise<void> {
    if (path.endsWith('.js')) {
      try { await access(resolve(root, path)); }
      catch (error) {
        if (!hasErrorCode(error, 'ENOENT')) throw error;
        const typed = path.replace(/\.js$/, '.ts');
        try { await access(resolve(root, typed)); path = typed; }
        catch (typedError) { if (!hasErrorCode(typedError, 'ENOENT')) throw typedError; }
      }
    }
    if (visited.has(path)) return;
    assert.ok(!path.startsWith("../") && !isAbsolute(path), "Preparation import escaped the project");
    visited.add(path);
    const source = await readFile(resolve(root, path), "utf8");
    if (!/\.(?:mjs|js|mts|ts)$/.test(path) || generatedModule(path)) return;
    const ast = parseRuntimeSource(source, path);
    const dependencies = ast.body.flatMap(node => node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration'
      ? typeof node.source?.value === 'string' && node.source.value.startsWith('.') ? [node.source.value] : [] : []);
    // Steps are executed by preparation-runner, rather than imported.
    if (path.endsWith("/tools/prepare.mjs")) {
      const recipeImport = ast.body.find((node): node is ImportDeclaration => node.type === "ImportDeclaration" &&
        typeof node.source.value === "string" && node.source.value.startsWith(".") &&
        resolve(root, dirname(path), node.source.value) === resolve(root, "tools/object-preparation.mts"));
      if (recipeImport) {
        const binding = recipeImport.specifiers.find(specifier => specifier.type === "ImportSpecifier" &&
          nodeName(specifier.imported) === "runObjectPreparation")?.local.name;
        const calls = ast.body.flatMap(node => node.type === 'ExpressionStatement' && node.expression.type === 'AwaitExpression'
          && node.expression.argument.type === 'CallExpression' && nodeName(node.expression.argument.callee) === binding ? [node.expression.argument] : []);
        assert.equal(calls.length, 1, "Preparation bridge must invoke its shared runner once");
        const call = calls[0], reference = call.arguments[0];
        assert.ok(call.arguments.length === 1 && reference?.type === "NewExpression" && nodeName(reference.callee) === "URL" &&
          reference.arguments.length === 2 && reference.arguments[0].type === "Literal" && reference.arguments[0].value === "../object.json" &&
          reference.arguments[1].type === "MemberExpression" && nodeName(reference.arguments[1].property) === "url" &&
          reference.arguments[1].object.type === "MetaProperty" && reference.arguments[1].object.meta.name === "import" &&
          reference.arguments[1].object.property.name === "meta", "Preparation bridge must address its own descriptor");
        const descriptorPath = resolve(root, dirname(path), reference.arguments[0].value);
        const plan = await readObjectPreparation(descriptorPath, { projectRoot: root });
        dependencies.push(relative(resolve(root, dirname(path)), descriptorPath),
          ...plan.steps.map(([script]) => relative(resolve(root, dirname(path)), resolve(plan.toolDirectory, script))));
      } else {
      const declaration = ast.body.find((node): node is VariableDeclaration => node.type === 'VariableDeclaration' && node.declarations.some(value => nodeName(value.id) === 'steps'));
      let value: Node | null | undefined = declaration?.declarations.find(value => nodeName(value.id) === 'steps')?.init;
      function findSteps(input: unknown): void {
        if (!isRecord(input)) return;
        // The input belongs to the parser's ESTree, not arbitrary source JSON.
        const node = input as unknown as Node;
        if (node.type === 'Property' && nodeName(node.key) === 'steps') value = node.value;
        for (const child of Object.values(node as unknown as Record<string, unknown>)) if (isArray(child)) child.forEach(findSteps);
        else if (child && typeof child === "object") findSteps(child);
      }
      if (!value) findSteps(ast);
      const steps = value?.type === "CallExpression" ? value.arguments[0] : value;
      assert.ok(steps?.type === "ArrayExpression", "Preparation steps must be a literal list");
      for (const step of steps.elements) {
        assert.ok(step?.type === 'ArrayExpression' && step.elements[0]?.type === 'Literal' && typeof step.elements[0].value === 'string', 'Preparation step must name its script');
        dependencies.push(step.elements[0].value);
      }
      }
    }
    for (const dependency of dependencies) await visit(relative(root, resolve(root, dirname(path), dependency)));
  }
  for (const entry of entries) await visit(entry);
  return [...visited].sort();
}

export async function sharedPreparationFiles(_root?: string) {
  return ["package.json", "pnpm-lock.yaml"];
}

export async function preparationEnvironment() {
  const dependencies: Record<string, string> = {};
  for (const name of ["@layoutit/polycss", "sharp"]) dependencies[name] = hash(await readFile(require.resolve(name)));
  for (const file of Object.keys(require.cache).filter(file => file.endsWith(".node") && file.includes("sharp")).sort()) {
    dependencies[basename(file)] = hash(await readFile(file));
  }
  assert.equal(typeof cwebpPath, "string", "Pinned WebP encoder path is unavailable");
  return { node: process.version, platform: process.platform, arch: process.arch,
    sharp: sharp.versions, sharpConcurrency: sharp.concurrency(),
    cwebpSha256: hash(await readFile(requireString(cwebpPath))), dependencies };
}

export async function runCachedPreparationObjects({ projectRoot = process.cwd(), force = false,
  objectIds = OBJECTS.map(({ id }) => id), concurrency = defaultPreparationConcurrency(),
  runCommand = runObjectCommand, schedule = runPreparationObjects,
  environment = preparationEnvironment, sharedFiles = sharedPreparationFiles,
  packageFiles = objectPreparationFiles, onEvent = event => console.log(JSON.stringify(event)) }: CachedPreparationOptions = {}) {
  assert.ok(isArray(objectIds) && new Set(objectIds).size === objectIds.length &&
    objectIds.every(id => OBJECTS.some(object => object.id === id)), "Preparation requires unique IDs from OBJECTS");
  assert.equal(typeof force, "boolean");
  const root = resolve(projectRoot), shared = await sharedFiles(root), toolchain = await environment();
  const pending: string[] = [], cached: string[] = [];
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
  objectIds = OBJECTS.map(({ id }) => id), concurrency = defaultPreparationConcurrency() }: Pick<CachedPreparationOptions, "projectRoot" | "force" | "objectIds" | "concurrency"> = {}) {
  const root = resolve(projectRoot), lock = resolve(root, cacheRoot, "running.lock");
  await mkdir(resolve(root, cacheRoot), { recursive: true });
  try { await writeFile(lock, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }) + "\n", { flag: "wx" }); }
  catch (error) {
    if (hasErrorCode(error, "EEXIST")) throw new Error(`Another preparation owns ${lock}; do not run two writers in the same checkout.`, { cause: error });
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
      argumentsList: [resolve(root, "tools/prepare-navigation.mts"), ...objectIds], cwd: root });
    assert.equal(navigation.exitCode, 0, "Navigation preparation failed"); assert.equal(navigation.signal, null);
    const totalReport = { ...report, totalElapsedMilliseconds: performance.now() - start };
    await writeFile(resolve(root, cacheRoot, "latest-run.json"), JSON.stringify(totalReport, null, 2) + "\n");
    console.log(`Prepared ${report.rebuilt.length} objects; verified ${report.cached.length} unchanged objects in ${(totalReport.totalElapsedMilliseconds / 1000).toFixed(1)}s.`);
    return totalReport;
  } finally { await rm(lock, { force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const options: { force?: boolean; concurrency?: number; objectIds?: string[] } = {};
  for (const argument of process.argv.slice(2)) {
    if (argument === "--") continue;
    if (argument === "--force") options.force = true;
    else if (argument.startsWith("--concurrency=")) options.concurrency = Number(argument.slice("--concurrency=".length));
    else if (argument.startsWith("--object=")) (options.objectIds ??= []).push(argument.slice("--object=".length));
    else throw new Error(`Unknown preparation argument: ${argument}`);
  }
  await preparePlanets(options);
}
