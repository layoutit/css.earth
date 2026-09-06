import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import cwebpPath from "cwebp-bin";
import { OBJECTS } from "../site/objects.mjs";
import { defaultPreparationConcurrency, runObjectCommand, runPreparationObjects } from "./run-implemented-planets.mjs";
import { fingerprintPreparationFiles, readPreparationReceipt, writePreparationReceipt } from "./preparation-cache.mjs";

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
  const packageFiles = await listPreparationFiles(root, base);
  const source = JSON.parse(await readFile(resolve(root, base, "source/manifest.json"), "utf8"));
  const generatedSources = new Set(source.generatedIntermediates.map(entry => `${base}/source/${entry.path}`));
  const output = path => generatedModule(path) || path === `${base}/site/control-content.mjs` ||
    path === `${base}/runtime-assets.json` ||
    path.includes("/.prepared/") || generatedSources.has(path);
  const outputs = [...packageFiles.filter(output), ...await listPreparationFiles(root, `public/scenes/${id}`)];
  const inputs = [...packageFiles.filter(path => !output(path)), ...await preparationFileSets(root, id)];
  // Editorial input is also a preparation output for packages which enrich it.
  // Its content is checked with all other outputs on every cache hit.
  const editorial = `data/planets/${id}.json`;
  try { await readFile(resolve(root, editorial)); outputs.push(editorial); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  return { inputs: [...new Set(inputs)].sort(), outputs: [...new Set(outputs)].sort() };
}

export async function sharedPreparationFiles(root) {
  return [...new Set([
    "package.json", "pnpm-lock.yaml",
    ...await listPreparationFiles(root, "src/platform"),
    ...(await listPreparationFiles(root, "site")).filter(path => !/\.(?:astro|css)$/.test(path)),
    ...(await listPreparationFiles(root, "tools")).filter(path =>
      !/^tools\/(?:audit-|benchmark-|compare-|measure-|preview|serve-)/.test(path)),
  ])].sort();
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
    const receipt = !force && await readPreparationReceipt({ root, path: `${cacheRoot}/${id}.json`, inputPaths });
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
      const inputs = await fingerprintPreparationFiles(root, inputPaths);
      const result = await runCommand(request);
      if (result.exitCode === 0 && result.signal === null) {
        const after = await packageFiles(root, request.id);
        assert.deepEqual(after.inputs, files.inputs, `${request.id} preparation input set changed during generation`);
        await writePreparationReceipt({ root, path: `${cacheRoot}/${request.id}.json`, inputs,
          outputPaths: after.outputs, metadata: { toolchain } });
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
