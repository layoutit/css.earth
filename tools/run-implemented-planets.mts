import { isArray } from '../src/platform/is-array.mts';
import { spawn } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import { availableParallelism, totalmem } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { SCENE_OBJECTS } from "../site/objects.mts";
import { authoredObject } from './authored-object.mts';

export interface ObjectCommand {command: string; argumentsList: readonly string[]; cwd?: string; env?: Readonly<Record<string, string | undefined>>;}
export interface PreparationCommand extends ObjectCommand {id: string; cwd: string;}
export interface ObjectCommandOutcome {exitCode: number | null; signal: string | null;}
export interface PreparationResult {id: string; script: string; status: 'not-started' | 'running' | 'succeeded' | 'failed'; startedAt?: string; exitCode?: number | null; signal?: string | null; error?: string; elapsedMilliseconds?: number;}
export interface PreparationReport {mode: 'prepare'; startedAt: string; requestedConcurrency: number; concurrency: number; elapsedMilliseconds: number; results: PreparationResult[];}
export type PreparationEvent = {phase: 'queue'; objectIds: string[]; concurrency: number}
  | {phase: 'start'; id: string; index: number; total: number}
  | ({phase: 'finish'; elapsedMilliseconds: number} & PreparationResult)
  | {phase: 'complete'; report: PreparationReport};
export interface PreparationOptions {projectRoot?: string; objectIds?: readonly string[]; concurrency?: number; argumentsList?: readonly string[]; runCommand?: (request: PreparationCommand) => Promise<ObjectCommandOutcome>; onEvent?: (event: PreparationEvent) => void;}
interface ResolveOptions {projectRoot?: string; accessFile?: typeof access;}

export function planetTestDirectory(id: string, projectRoot = process.cwd()) {
  return resolve(projectRoot, "src", "objects", id, "test");
}

export async function discoverPlanetTests(
  id: string,
  { projectRoot = process.cwd(), readDirectory = readdir }: {projectRoot?: string; readDirectory?: (directory: string) => Promise<string[]>} = {},
) {
  const directory = await authoredObject(id, projectRoot)
    ? resolve(projectRoot, 'tests/objects/unit', id) : planetTestDirectory(id, projectRoot);
  let filenames;
  try {
    filenames = await readDirectory(directory);
  } catch (cause) {
    throw new Error(`Implemented planet ${id} test directory is missing.`, { cause });
  }
  const tests = filenames
    .filter((filename) => /\.test\.m(?:j|t)s$/u.test(filename))
    .sort()
    .map((filename) => resolve(directory, filename));
  if (tests.length === 0) {
    throw new Error(`Implemented planet ${id} has no tests.`);
  }
  return tests;
}

export function planetAssembleScript(id: string, projectRoot = process.cwd()) {
  return planetOwnedScript(id, "tools/compact-production-assets.mjs", projectRoot);
}

export function planetAcquireScript(id: string, projectRoot = process.cwd()) {
  return planetOwnedScript(id, "tools/acquire.mjs", projectRoot);
}

export function planetPrepareScript(id: string, projectRoot = process.cwd()) {
  return planetOwnedScript(id, "tools/prepare.mjs", projectRoot);
}

export async function resolvePlanetAssembly(
  id: string,
  { projectRoot = process.cwd(), accessFile = access }: ResolveOptions = {},
) {
  const script = await authoredObject(id, projectRoot)
    ? resolve(projectRoot, 'tools/objects/dist/operations.js') : planetAssembleScript(id, projectRoot);
  try {
    await accessFile(script);
  } catch (cause) {
    throw new Error(`Implemented planet ${id} assembly script is missing.`, { cause });
  }
  return script;
}

export async function resolvePlanetCommand(
  id: string,
  mode: string,
  { projectRoot = process.cwd(), accessFile = access }: ResolveOptions = {},
) {
  const resolvers: Readonly<Partial<Record<string, (id: string, root: string) => string>>> = Object.freeze({
    acquire: planetAcquireScript,
    prepare: planetPrepareScript,
    browser: () => resolve(projectRoot, "site/test/dom-cleanliness-browser.mts"),
    assemble: planetAssembleScript,
  });
  const resolveScript = resolvers[mode];
  if (!resolveScript) throw new TypeError(`Unknown planet command mode: ${mode}.`);
  const authored = await authoredObject(id, projectRoot);
  const script = authored
    ? mode === 'browser' ? resolveScript(id, projectRoot)
      : resolve(projectRoot, 'tools/objects/dist', mode === 'prepare' ? 'prepare-authored.js' : 'operations.js')
    : resolveScript(id, projectRoot);
  try {
    await accessFile(script);
  } catch (cause) {
    throw new Error(`Implemented planet ${id} ${mode} script is missing.`, {
      cause,
    });
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
  // Each object has its own Sharp/libvips workers and decoded image buffers.
  // Leave capacity for the browser and avoid a worker per logical CPU.
  const gibibyte = 1024 ** 3;
  if (cores >= 12 && memoryBytes >= 32 * gibibyte) return 3;
  if (cores >= 4 && memoryBytes >= 16 * gibibyte) return 2;
  return 1;
}

export async function runObjectCommand({ command, argumentsList, cwd, env }: ObjectCommand): Promise<ObjectCommandOutcome> {
  return new Promise<ObjectCommandOutcome>((resolvePromise, reject) => {
    const child = spawn(command, argumentsList, { cwd, env, stdio: "inherit" });
    child.once("error", reject);
    // close follows process exit and closure of its inherited output streams.
    child.once("close", (exitCode, signal) => resolvePromise({ exitCode, signal }));
  });
}

export async function runPreparationObjects({
  projectRoot = process.cwd(),
  objectIds = SCENE_OBJECTS.map(({ id }) => id),
  concurrency = defaultPreparationConcurrency(),
  argumentsList = [],
  runCommand = runObjectCommand,
  onEvent = printPreparationProgress,
}: PreparationOptions = {}) {
  const knownIds = new Set(SCENE_OBJECTS.map(({ id }) => id));
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
    argumentsList: [await resolvePlanetCommand(id, "prepare", { projectRoot: cwd }),
      ...(await authoredObject(id, cwd) ? [id, '--write'] : []), ...argumentsList],
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
  let next = 0;
  function emit(event: PreparationEvent) {
    try { onEvent(event); }
    catch (cause) { failures.push(new Error("Preparation progress reporting failed.", { cause })); }
  }
  emit({ phase: "queue", objectIds: [...objectIds], concurrency: report.concurrency });
  async function worker() {
    while (failures.length === 0 && next < commands.length) {
      const index = next++, request = commands[index], result = report.results[index];
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
      }
    }
  }
  // A failure closes the queue but never abandons an already-started object.
  await Promise.all(Array.from({ length: report.concurrency }, worker));
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

async function main(mode = process.argv[2]) {
  if (!new Set(["acquire", "prepare", "test", "browser", "assemble"]).has(mode)) {
    throw new TypeError(
      "Usage: node tools/run-implemented-planets.mts " +
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

  for (const { id } of SCENE_OBJECTS) {
    const argumentsList = mode === "test"
      ? ["--test", ...await discoverPlanetTests(id)]
      : [await resolvePlanetCommand(id, mode), ...(await authoredObject(id) && mode !== 'browser' ? [mode, id] : []), ...process.argv.slice(3)];
    await run(process.execPath, argumentsList);
  }
}

function planetOwnedScript(id: string, path: string, projectRoot: string) {
  return resolve(projectRoot, "src", "objects", id, ...path.split("/"));
}

function run(command: string, argumentsList: readonly string[]) {
  return runObjectCommand({ command, argumentsList }).then(({ exitCode, signal }) => {
    if (exitCode !== 0 || signal !== null) throw new Error(
      `Implemented planet command failed with ${signal ?? `exit ${exitCode}`}.`,
    );
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
