import { sha256 } from '../../src/platform/sha256.mts';
import { isArray } from '../../src/platform/is-array.mts';
import assert from "node:assert/strict";
import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { hasErrorCode, requireString } from '../sources/source-values.mts';
import type { PreparationOptions, PreparationEvent } from '../cli/run-implemented-planets.mts';
type CacheEvent = PreparationEvent | {phase: 'verified-cache-hit'; id: string; inputs: number; outputs: number}
  | {phase: 'receipt-refused'; id: string; reason: string};
export interface CachedPreparationOptions extends Omit<PreparationOptions, 'onEvent' | 'argumentsList'> {
  force?: boolean; schedule?: typeof runPreparationObjects;
  environment?: () => Promise<Record<string, unknown>>;
  sharedFiles?: (root: string) => Promise<readonly string[]>;
  onEvent?: (event: CacheEvent) => void;
}

import cwebpPath from "cwebp-bin";
import { SCENE_OBJECTS } from "../../site/objects.mts";
import { availableMemoryBytes, defaultPreparationConcurrency, preparationPeakBytes, runObjectCommand, runPreparationObjects } from "../cli/run-implemented-planets.mts";
import { readPreparationReceipt, readPreparationTraces, writePreparationReceipt } from "./preparation-cache.mts";
import { PREPARATION_TRACE_VARIABLE } from './preparation-trace-format.mts';
import { preparePreparedAssetManifest } from '../../src/platform/runtime-asset-closure.mts';

const sharedSteps = ["prepare-shell-titles.mts", "prepare-wordmark-rail.mts",
  "prepare-planet-title-sources.mts", "prepare-scientific-charts.mts"];
const cacheRoot = ".local/preparation";
const traceModule = new URL("./preparation-trace.mts", import.meta.url).href;

const require = createRequire(import.meta.url);

// Installed packages are read from node_modules, which receipts do not fingerprint; the manifest and lockfile stand for them.
export async function sharedPreparationFiles(_root?: string) {
  return ["package.json", "pnpm-lock.yaml"];
}

export async function preparationEnvironment() {
  const dependencies: Record<string, string> = {};
  for (const name of ["@layoutit/polycss", "sharp"]) dependencies[name] = sha256(await readFile(require.resolve(name)));
  for (const file of Object.keys(require.cache).filter(file => file.endsWith(".node") && file.includes("sharp")).sort()) {
    dependencies[basename(file)] = sha256(await readFile(file));
  }
  assert.equal(typeof cwebpPath, "string", "Pinned WebP encoder path is unavailable");
  return { node: process.version, platform: process.platform, arch: process.arch,
    sharp: sharp.versions, sharpConcurrency: sharp.concurrency(),
    cwebpSha256: sha256(await readFile(requireString(cwebpPath))), dependencies };
}

/** The environment of a traced preparation: the trace directory, and the trace loaded into every Node process. */
export function tracedPreparationEnvironment(traceDirectory: string, environment: Readonly<Record<string, string | undefined>> = process.env): Record<string, string | undefined> {
  const flag = `--import=${traceModule}`, options = environment.NODE_OPTIONS ?? "";
  return { ...environment, [PREPARATION_TRACE_VARIABLE]: traceDirectory,
    NODE_OPTIONS: options.split(/\s+/u).includes(flag) ? options : `${options} ${flag}`.trim() };
}

/**
 * Reuse a body's prepared files while everything its last preparation read is unchanged. Each preparation runs
 * with tools/prepare/preparation-trace.mts, and its receipt lists exactly the files that run read and wrote.
 */
export async function runCachedPreparationObjects({ projectRoot = process.cwd(), force = false,
  objectIds = SCENE_OBJECTS.map(({ id }) => id), concurrency = defaultPreparationConcurrency(),
  runCommand = runObjectCommand, schedule = runPreparationObjects,
  environment = preparationEnvironment, sharedFiles = sharedPreparationFiles,
  onEvent = event => console.log(JSON.stringify(event)) }: CachedPreparationOptions = {}) {
  assert.ok(isArray(objectIds) && new Set(objectIds).size === objectIds.length &&
    objectIds.every(id => SCENE_OBJECTS.some(object => object.id === id)), "Preparation requires unique IDs from SCENE_OBJECTS");
  assert.equal(typeof force, "boolean");
  const root = resolve(projectRoot), shared = await sharedFiles(root), toolchain = await environment();
  const pending: string[] = [], cached: string[] = [];
  for (const id of objectIds) {
    const receipt = !force && await readPreparationReceipt({ root, path: `${cacheRoot}/${id}.json` });
    if (receipt && JSON.stringify(receipt.metadata?.toolchain) === JSON.stringify(toolchain)) {
      cached.push(id);
      onEvent({ phase: "verified-cache-hit", id, inputs: Object.keys(receipt.inputs).length, outputs: Object.keys(receipt.outputs).length });
    } else pending.push(id);
  }
  const report = await schedule({ projectRoot: root, objectIds: pending, concurrency, onEvent,
    memoryAvailableBytes: availableMemoryBytes, peakMemoryBytes: id => preparationPeakBytes(id, root),
    runCommand: async request => {
      const receiptPath = `${cacheRoot}/${request.id}.json`;
      const traces = resolve(root, cacheRoot, "traces", `${request.id}-${randomUUID()}`);
      await rm(resolve(root, receiptPath), { force: true });
      await mkdir(traces, { recursive: true });
      try {
        const result = await runCommand({ ...request, env: tracedPreparationEnvironment(traces, request.env) });
        if (result.exitCode === 0 && result.signal === null) {
          const { refusal, changed } = await writePreparationReceipt({ root, path: receiptPath, objectId: request.id,
            traces: await readPreparationTraces(traces), sharedFiles: shared, metadata: { toolchain } });
          // Outputs made from inputs that changed mid-run are stale; fail so the run is repeated, as before receipts were traced.
          assert.equal(changed.length, 0, `${request.id} preparation inputs changed during generation: ${changed.join(", ")}`);
          if (refusal) onEvent({ phase: "receipt-refused", id: request.id, reason: refusal });
        }
        return result;
      } finally {
        await rm(traces, { recursive: true, force: true });
      }
    } });
  return { ...report, cached, rebuilt: pending, force };
}

export async function preparePlanets({ projectRoot = process.cwd(), force = false,
  objectIds = SCENE_OBJECTS.map(({ id }) => id), concurrency = defaultPreparationConcurrency() }: Pick<CachedPreparationOptions, "projectRoot" | "force" | "objectIds" | "concurrency"> = {}) {
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
      argumentsList: [resolve(root, "tools/prepare/prepare-navigation.mts"), ...objectIds], cwd: root });
    assert.equal(navigation.exitCode, 0, "Navigation preparation failed"); assert.equal(navigation.signal, null);
    // Refresh the prepared/runtime.json + prepared/scene.json inventory for every prepared body, even when
    // `prepare:object-json` does not run afterward (e.g. `prepare:checkout`).
    for (const id of objectIds) {
      const preparedDirectory = resolve(root, "src/objects", id, "prepared");
      const inventoried: string[] = [];
      for (const filename of ["runtime.json", "scene.json"]) {
        if (await access(resolve(preparedDirectory, filename)).then(() => true, () => false)) inventoried.push(filename);
      }
      if (inventoried.length) {
        await preparePreparedAssetManifest({ planetId: id, preparedRoot: preparedDirectory,
          manifestPath: resolve(preparedDirectory, "..", "prepared-assets.json"), filenames: inventoried });
      }
    }
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
