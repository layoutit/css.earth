import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { testLaneFiles } from '../preparation/index.ts';
// `@cssearth/bake/run-implemented-objects` (Node only): runs a registered scene object's acquire, prepare, test, browser
// or assemble command, and the concurrency-limited scheduler that prepares several objects with a memory budget. It
// imports `sources`. `packages/bake/cli/run-implemented-objects.mts` is its command.
import { isArray } from '@cssearth/core';
import { execFileSync, spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { availableParallelism, freemem, totalmem } from "node:os";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

import { readPreparedObjects } from "@cssearth/objects/node";
import { authoredObject } from '../sources/index.ts';

/** The real checkout, found by the shared workspace-marker resolver from source and `dist/`. */
const ROOT = checkoutProjectRoot(import.meta.url);
/** The scene objects, read through the prepared registry of this checkout rather than the application's bound registry. */
const SCENE_OBJECTS = () => readPreparedObjects(ROOT).sceneObjects;

export interface ObjectCommand {command: string; argumentsList: readonly string[]; cwd?: string; env?: Readonly<Record<string, string | undefined>>; onSpawn?: (pid: number) => void;}
export interface PreparationCommand extends ObjectCommand {id: string; cwd: string;}
export interface ObjectCommandOutcome {exitCode: number | null; signal: string | null;}
export interface PreparationResult {id: string; script: string; status: 'not-started' | 'running' | 'succeeded' | 'failed'; startedAt?: string; exitCode?: number | null; signal?: string | null; error?: string; elapsedMilliseconds?: number;}
export interface PreparationReport {mode: 'prepare'; startedAt: string; requestedConcurrency: number; concurrency: number; elapsedMilliseconds: number; results: PreparationResult[];}
export type PreparationEvent = {phase: 'queue'; objectIds: string[]; concurrency: number}
  | {phase: 'start'; id: string; index: number; total: number}
  | ({phase: 'finish'; elapsedMilliseconds: number} & PreparationResult)
  | {phase: 'complete'; report: PreparationReport};
export interface PreparationOptions {projectRoot?: string; objectIds?: readonly string[]; concurrency?: number; argumentsList?: readonly string[]; runCommand?: (request: PreparationCommand) => Promise<ObjectCommandOutcome>; onEvent?: (event: PreparationEvent) => void;
  /** An object starts only while its expected peak, the growth still expected of the running objects and a floor fit in the
   * memory available now. Growth is each running object's expected peak less its measured resident memory. */
  memoryAvailableBytes?: () => number; memoryFloorBytes?: number; peakMemoryBytes?: (id: string) => Promise<number>;
  residentBytes?: (pids: readonly number[]) => ReadonlyMap<number, number>;}
interface ResolveOptions {projectRoot?: string; accessFile?: typeof access;}

/** Every scene object is authored: its object.json carries a recipe. Refuse any other before running a command for it. */
async function requireAuthored(id: string, projectRoot: string) {
  if (!await authoredObject(id, projectRoot))
    throw new TypeError(`src/objects/${id}/object.json: scene object ${id} has no authored recipe (properties.recipe), so it has no preparation commands.`);
}

export async function discoverObjectTests(
  id: string,
  { projectRoot = checkoutProjectRoot(import.meta.url) }: {projectRoot?: string} = {},
) {
  const lanes = testLaneFiles(projectRoot, JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')) as unknown, ['test:packages', 'test:site']);
  // Lane globs determine membership. Shared object suites declare the selection contract in their source;
  // unfiltered shared invariants use the same marker, so adding a suite requires no runner name list.
  const tests = [...lanes.packages, ...lanes.site].filter(file => file.startsWith(`src/objects/${id}/`)
    || /^\/\/[^\n]*\bCSSEARTH_TEST_OBJECTS\b/mu.test(readFileSync(resolve(projectRoot, file), 'utf8'))).map(file => resolve(projectRoot, file));
  if (tests.length === 0) throw new Error(`Implemented object ${id} has no tests.`);
  return [...new Set(tests)].sort();
}

export async function resolveObjectAssembly(id: string, { projectRoot = checkoutProjectRoot(import.meta.url), accessFile = access }: ResolveOptions = {}) {
  return resolveObjectCommand(id, 'assemble', { projectRoot, accessFile });
}

export async function resolveObjectCommand(
  id: string,
  mode: string,
  { projectRoot = checkoutProjectRoot(import.meta.url), accessFile = access }: ResolveOptions = {},
) {
  const scripts: Readonly<Partial<Record<string, string>>> = Object.freeze({
    acquire: 'packages/bake/cli/object-operations.mts',
    prepare: 'site/build/prepare/prepare-authored.ts',
    browser: 'site/test/dom-cleanliness-browser.mts',
    assemble: 'packages/bake/cli/object-operations.mts',
  });
  const relative = scripts[mode];
  if (!relative) throw new TypeError(`Unknown planet command mode: ${mode}.`);
  await requireAuthored(id, projectRoot);
  const script = resolve(projectRoot, relative);
  try {
    await accessFile(script);
  } catch (cause) {
    throw new Error(`Implemented object ${id} ${mode} script ${relative} is missing.`, { cause });
  }
  return script;
}

export function defaultPreparationConcurrency({
  cores = availableParallelism(),
  memoryBytes = totalmem(),
} = {}) {
  if (!Number.isInteger(cores) || cores < 1 ||
      !Number.isFinite(memoryBytes) || memoryBytes <= 0) {
    throw new TypeError("Preparation host capacity is incompatible.");
  }
  // One core each, two left for the browser and the system. Memory, not cores, bounds photographed bodies: the scheduler
  // admits each object against the memory budget, so this only caps how many light objects run together.
  const gibibyte = 1024 ** 3;
  return Math.max(1, Math.min(cores - 2, Math.floor(memoryBytes / (4 * gibibyte))));
}

const gibibyte = 1024 ** 3;
/** Expected peak resident memory per preparation, measured 2026-09-17 on a 36 GB host: an irregular body without photographs
 * 1.15–1.29 GiB; with photographs 2.1 GiB (Amalthea) to 5.75 GiB (67P). Other objects run their own pipelines and are expected heavy. */
export const PREPARATION_PEAK_BYTES = { light: 1.5 * gibibyte, heavy: 6 * gibibyte } as const;
export const PREPARATION_MEMORY_FLOOR = 2.5 * gibibyte;

export async function preparationPeakBytes(id: string, projectRoot = checkoutProjectRoot(import.meta.url)) {
  if (!await authoredObject(id, projectRoot)) return PREPARATION_PEAK_BYTES.heavy;
  let recipe: {raster?: {surfaceObservations?: unknown[]}; geometry?: {radialTerrain?: unknown}};
  try { recipe = JSON.parse(await readFile(resolve(projectRoot, 'src/objects', id, 'source/preparation/terrestrial.json'), 'utf8')); }
  catch { return PREPARATION_PEAK_BYTES.heavy; }
  return recipe.geometry?.radialTerrain && !recipe.raster?.surfaceObservations?.length ? PREPARATION_PEAK_BYTES.light : PREPARATION_PEAK_BYTES.heavy;
}

/** Memory the system can hand to new processes now: free, inactive and purgeable pages on macOS, MemAvailable on Linux. */
export function availableMemoryBytes() {
  if (process.platform === 'darwin') {
    const text = execFileSync('vm_stat', { encoding: 'utf8' }), page = Number(/page size of (\d+) bytes/u.exec(text)?.[1]);
    const pages = (name: string) => Number(new RegExp(`${name}:\\s+(\\d+)`, 'u').exec(text)?.[1] ?? 0);
    const bytes = page * (pages('Pages free') + pages('Pages inactive') + pages('Pages speculative') + pages('Pages purgeable'));
    if (Number.isFinite(bytes) && bytes > 0) return bytes;
  }
  return freemem();
}

/** Resident memory of running processes, from ps. */
export function processResidentBytes(pids: readonly number[]): ReadonlyMap<number, number> {
  if (!pids.length) return new Map();
  let text = '';
  try { text = execFileSync('ps', ['-o', 'pid=,rss=', '-p', pids.join(',')], { encoding: 'utf8' }); } catch { return new Map(); }
  return new Map(text.trim().split('\n').filter(Boolean).map(line => { const [pid, kib] = line.trim().split(/\s+/u).map(Number); return [pid, kib * 1024]; }));
}

export async function runObjectCommand({ command, argumentsList, cwd, env, onSpawn }: ObjectCommand): Promise<ObjectCommandOutcome> {
  return new Promise<ObjectCommandOutcome>((resolvePromise, reject) => {
    const child = spawn(command, argumentsList, { cwd, env, stdio: "inherit" });
    if (child.pid !== undefined) onSpawn?.(child.pid);
    child.once("error", reject);
    // close follows process exit and closure of its inherited output streams.
    child.once("close", (exitCode, signal) => resolvePromise({ exitCode, signal }));
  });
}

export async function runPreparationObjects({
  projectRoot = checkoutProjectRoot(import.meta.url),
  objectIds = SCENE_OBJECTS().map(({ id }) => id),
  concurrency = defaultPreparationConcurrency(),
  argumentsList = [],
  runCommand = runObjectCommand,
  onEvent = printPreparationProgress,
  memoryAvailableBytes = () => Infinity,
  memoryFloorBytes = PREPARATION_MEMORY_FLOOR,
  peakMemoryBytes = async () => 0,
  residentBytes = processResidentBytes,
}: PreparationOptions = {}) {
  const knownIds = new Set(SCENE_OBJECTS().map(({ id }) => id));
  if (!isArray(objectIds) || objectIds.some(id => !knownIds.has(id)) ||
      new Set(objectIds).size !== objectIds.length) {
    throw new TypeError("Preparation requires unique IDs from SCENE_OBJECTS.");
  }
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 ||
      !isArray(argumentsList) || argumentsList.some(value => typeof value !== "string") ||
      typeof runCommand !== "function" || typeof onEvent !== "function") {
    throw new TypeError("Preparation scheduling options are incompatible.");
  }
  const cwd = resolve(projectRoot);
  // Resolve the complete requested queue before any command starts.
  const commands = await Promise.all(objectIds.map(async id => ({
    id,
    command: process.execPath,
    argumentsList: [await resolveObjectCommand(id, "prepare", { projectRoot: cwd }),
      id, '--write', ...argumentsList],
    cwd,
  })));
  const startedAt = new Date().toISOString(), start = performance.now();
  const report: PreparationReport = {
    mode: "prepare", startedAt, requestedConcurrency: concurrency,
    concurrency: Math.min(concurrency, commands.length),
    elapsedMilliseconds: 0,
    results: commands.map(({ id, argumentsList }) => ({
      id, script: argumentsList[0], status: "not-started",
    })),
  };
  const failures: Error[] = [];
  // Heavier objects start first, so they run beside light ones instead of queueing together at the end; results keep the requested order.
  const peaks = await Promise.all(commands.map(({ id }) => peakMemoryBytes(id)));
  const order = commands.map((_, index) => index).sort((a, b) => peaks[b] - peaks[a] || a - b);
  let released: (() => void) | null = null;
  const running = new Map<number, number | undefined>();
  function emit(event: PreparationEvent) {
    try { onEvent(event); }
    catch (cause) { failures.push(new Error("Preparation progress reporting failed.", { cause })); }
  }
  emit({ phase: "queue", objectIds: [...objectIds], concurrency: report.concurrency });
  async function run(index: number) {
    const request = { ...commands[index], onSpawn: (pid: number) => { running.set(index, pid); } }, result = report.results[index];
    const commandStart = performance.now();
    result.status = "running";
    result.startedAt = new Date().toISOString();
    emit({ phase: "start", id: request.id, index, total: commands.length });
    try {
      const outcome = await runCommand(request);
      if (!outcome || !(outcome.exitCode === null || Number.isInteger(outcome.exitCode)) ||
          !(outcome.signal === null || typeof outcome.signal === "string")) {
        throw new TypeError(`${request.id} preparation did not return a process exit receipt.`);
      }
      result.exitCode = outcome.exitCode;
      result.signal = outcome.signal;
      if (outcome.exitCode !== 0 || outcome.signal !== null) {
        throw new Error(`${request.id} preparation failed with ${outcome.signal ?? `exit ${outcome.exitCode}`}.`);
      }
      result.status = "succeeded";
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      result.status = "failed";
      result.error = error.message;
      failures.push(error);
    } finally {
      result.elapsedMilliseconds = performance.now() - commandStart;
      emit({ phase: "finish", ...result, elapsedMilliseconds: result.elapsedMilliseconds });
      running.delete(index);
      released?.();
    }
  }
  // A failure closes the queue but never abandons an already-started object. An object that does not fit waits for one to
  // finish; one that alone exceeds the budget still runs when nothing else does.
  const started: Promise<void>[] = [];
  const fits = (index: number) => {
    if (!running.size) return true;
    const pids = [...running.values()].filter((pid): pid is number => pid !== undefined), resident = residentBytes(pids);
    let growth = 0;
    for (const [running_, pid] of running) growth += Math.max(0, peaks[running_] - (pid === undefined ? 0 : resident.get(pid) ?? 0));
    return memoryAvailableBytes() - growth - peaks[index] >= memoryFloorBytes;
  };
  const queued = new Set(order);
  while (failures.length === 0 && queued.size) {
    // The heaviest object that fits starts first; a lighter one behind it starts rather than waiting for memory it does not need.
    const index = running.size >= report.concurrency ? undefined : [...queued].find(candidate => fits(candidate));
    if (index === undefined) {
      // Wake when an object finishes, or re-measure after a moment: running objects release memory as they go.
      await new Promise<void>(resolvePromise => { released = resolvePromise; setTimeout(resolvePromise, 2000).unref(); });
      released = null;
      continue;
    }
    queued.delete(index); running.set(index, undefined);
    started.push(run(index));
  }
  await Promise.all(started);
  report.elapsedMilliseconds = performance.now() - start;
  emit({ phase: "complete", report });
  if (failures.length) {
    const error = Object.assign(new AggregateError(failures, "Object preparation failed; all started commands have settled."), {report});
    throw error;
  }
  return report;
}

function printPreparationProgress(event: PreparationEvent) {
  if (event.phase === "queue") {
    console.log(`Preparing ${event.objectIds.length} objects with ${event.concurrency} parallel workers.`);
  } else if (event.phase === "start") {
    console.log(`[prepare ${event.id}] started (${event.index + 1}/${event.total}).`);
  } else if (event.phase === "finish") {
    console.log(`[prepare ${event.id}] ${event.status} in ${(event.elapsedMilliseconds / 1000).toFixed(1)}s` +
      (event.error ? `: ${event.error}` : "."));
  } else if (event.phase === "complete") {
    const counts = Object.fromEntries(["succeeded", "failed", "not-started"].map(status =>
      [status, event.report.results.filter(result => result.status === status).length]));
    console.log(`Preparation finished in ${(event.report.elapsedMilliseconds / 1000).toFixed(1)}s: ` +
      `${counts.succeeded} succeeded, ${counts.failed} failed, ${counts["not-started"]} not started.`);
  }
}

export async function main(mode = process.argv[2]) {
  if (!new Set(["acquire", "prepare", "test", "browser", "assemble"]).has(mode)) {
    throw new TypeError(
      "Usage: node packages/bake/cli/run-implemented-objects.mts " +
      "acquire|prepare|test|browser|assemble",
    );
  }

  if (mode === "browser") {
    await run(process.execPath, [resolve("site/test/dom-cleanliness-browser.mts"), ...process.argv.slice(3)]);
    return;
  }

  if (mode === "prepare") {
    const argumentsList: string[] = [], options: PreparationOptions = {};
    for (const argument of process.argv.slice(3)) {
      if (argument.startsWith("--concurrency=")) options.concurrency = Number(argument.slice("--concurrency=".length));
      else argumentsList.push(argument);
    }
    await runPreparationObjects({ ...options, argumentsList });
    return;
  }

  // An authored body assembles through the shared operations module. Load it once and assemble in this process: a Node
  // start per body cost the deploy build about 110 ms each, four minutes over the catalogue.
  const runOperations = mode === "assemble" ? await loadOperations() : null;
  for (const { id } of SCENE_OBJECTS()) {
    if (runOperations) {
      await runOperations(mode, id, process.argv.slice(3)).catch((cause: unknown) => {
        throw new Error(`Implemented object ${id} failed to ${mode}.`, { cause });
      });
      continue;
    }
    const argumentsList = mode === "test"
      ? ["--test", ...await discoverObjectTests(id)]
      : [await resolveObjectCommand(id, mode), ...(mode !== 'browser' ? [mode, id] : []), ...process.argv.slice(3)];
    await run(process.execPath, argumentsList, mode === "test" ? { ...process.env, CSSEARTH_TEST_OBJECTS: id } : undefined);
  }
}

/** `runOperations` runs an authored body's assembly, loaded as a module. */
async function loadOperations() {
  const specifier = "@cssearth/bake/objects/acquisition", module: unknown = await import(specifier);
  const runOperations = typeof module === "object" && module !== null && "runOperations" in module ? module.runOperations : null;
  if (typeof runOperations !== "function") throw new TypeError(`${specifier} exports no runOperations function; run pnpm build:packages.`);
  return runOperations as (mode: string, id: string, argumentsList: string[]) => Promise<unknown>;
}

function run(command: string, argumentsList: readonly string[], env?: NodeJS.ProcessEnv) {
  return runObjectCommand({ command, argumentsList, env }).then(({ exitCode, signal }) => {
    if (exitCode !== 0 || signal !== null) throw new Error(
      `Implemented object command failed with ${signal ?? `exit ${exitCode}`}.`,
    );
  });
}
