import {authoredObject} from '../sources/authored-object.mts';
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { setImmediate } from "node:timers/promises";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import type { ObjectCommandOutcome, PreparationCommand, PreparationEvent, PreparationReport } from './run-implemented-planets.mts';

import { SCENE_OBJECTS } from "../../site/objects.mts";
import {
  defaultPreparationConcurrency,
  discoverPlanetTests,
  resolvePlanetCommand,
  runObjectCommand,
  runPreparationObjects,
} from "./run-implemented-planets.mts";

const root = resolve(import.meta.dirname, "../..");
const ids = SCENE_OBJECTS.map(({ id }) => id);
const success = Object.freeze({ exitCode: 0, signal: null });
const quiet = () => {};
const hasPreparationReport = (error: AggregateError): error is AggregateError & { report: PreparationReport } =>
  'report' in error && typeof error.report === 'object' && error.report !== null;

test("object discovery retains unit tests, appends the shared contract runners and uses the shared browser entry", async () => {
  const shared = resolve(root, 'tests/objects/unit');
  const isTest = (filename: unknown): filename is string => typeof filename === 'string' && /\.test\.m(?:j|t)s$/u.test(filename);
  const runners = (await readdir(shared)).filter(isTest).map(filename => resolve(shared, filename)).sort();
  assert.ok(runners.length > 0, 'shared contract runners exist');
  for (const id of ids) {
    const directory = resolve(root, 'tests/objects/unit', id);
    const own = await readdir(directory, { recursive: true }).then(names => names.filter(isTest).map(filename => resolve(directory, filename)).sort(), () => []);
    const expected = [...own, ...runners];
    assert.deepEqual(await discoverPlanetTests(id, { projectRoot: root }), expected);
    assert.equal(await resolvePlanetCommand(id, 'browser', { projectRoot: root }),
      resolve(root, 'site/test/dom-cleanliness-browser.mts'));
  }
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>(resolve => { resolvePromise = resolve; });
  const resolve = (): void => { if (!resolvePromise) throw new Error('Deferred promise is not initialized.'); resolvePromise(); };
  return { promise, resolve };
}

test("preparation defaults leave headroom for image workers on small and large hosts", () => {
  const gibibyte = 1024 ** 3;
  assert.equal(defaultPreparationConcurrency({ cores: 2, memoryBytes: 64 * gibibyte }), 1);
  assert.equal(defaultPreparationConcurrency({ cores: 16, memoryBytes: 8 * gibibyte }), 2);
  assert.equal(defaultPreparationConcurrency({ cores: 8, memoryBytes: 16 * gibibyte }), 4);
  assert.equal(defaultPreparationConcurrency({ cores: 14, memoryBytes: 36 * gibibyte }), 9);
  assert.equal(defaultPreparationConcurrency({ cores: 128, memoryBytes: 1024 * gibibyte }), 126);
  assert.throws(() => defaultPreparationConcurrency({ cores: 0, memoryBytes: gibibyte }), /capacity/);
});

test("default preparation covers every actual SCENE_OBJECTS package exactly once", async () => {
  const calls: PreparationCommand[] = [], events: PreparationEvent[] = [];
  const report = await runPreparationObjects({
    projectRoot: root, concurrency: 3,
    argumentsList: ["--fixture-forwarded-argument"],
    onEvent: event => events.push(event),
    async runCommand(call) { calls.push(call); return success; },
  });
  assert.deepEqual(calls.map(call => call.id), ids);
  assert.deepEqual(report.results.map(result => result.id), ids);
  for (const call of calls) {
    assert.equal(call.command, process.execPath);
    assert.equal(call.cwd, root);
    assert.deepEqual(call.argumentsList, [
      ...(await authoredObject(call.id, root) ? [resolve(root, 'tools/objects/dist/prepare-authored.js'), call.id, '--write'] : [resolve(root, `src/objects/${call.id}/tools/prepare.mjs`)]),
      "--fixture-forwarded-argument",
    ]);
  }
  assert.ok(report.results.every(result => result.status === "succeeded" && result.exitCode === 0 && (result.elapsedMilliseconds ?? -1) >= 0));
  assert.equal(events.filter(event => event.phase === "start").length, ids.length);
  assert.equal(events.filter(event => event.phase === "finish").length, ids.length);
  assert.equal(events.at(-1)?.phase, "complete");
});

test("parallel preparation refills a bounded queue while preserving selected result order", async () => {
  const selected = ids.slice(0, 4), gates = new Map<string, ReturnType<typeof deferred>>(selected.map(id => [id, deferred()]));
  const started: string[] = [], firstTwo = deferred(), third = deferred();
  let active = 0, maximumActive = 0;
  const pending = runPreparationObjects({
    projectRoot: root, objectIds: selected, concurrency: 2, onEvent: quiet,
    async runCommand({ id }) {
      started.push(id); active++; maximumActive = Math.max(maximumActive, active);
      if (started.length === 2) firstTwo.resolve();
      if (started.length === 3) third.resolve();
      await gates.get(id)?.promise;
      active--; return success;
    },
  });
  await firstTwo.promise;
  assert.deepEqual(started, selected.slice(0, 2));
  gates.get(selected[1])?.resolve();
  await third.promise;
  assert.deepEqual(started, selected.slice(0, 3));
  assert.equal(active, 2);
  for (const gate of gates.values()) gate.resolve();
  const report = await pending;
  assert.equal(maximumActive, 2);
  assert.equal(active, 0);
  assert.deepEqual(report.results.map(result => result.id), selected);
  assert.ok(report.results.every(result => result.status === "succeeded"));
});

test("a failed object closes the queue and drains started commands before rejecting", async () => {
  const selected = ids.slice(0, 4), failure = deferred(), remaining = deferred(), firstTwo = deferred();
  const started: string[] = [];
  let settled = false;
  const pending = runPreparationObjects({
    projectRoot: root, objectIds: selected, concurrency: 2, onEvent: quiet,
    async runCommand({ id }) {
      started.push(id);
      if (started.length === 2) firstTwo.resolve();
      if (id === selected[0]) { await failure.promise; return { exitCode: 7, signal: null }; }
      await remaining.promise; return success;
    },
  }).then(() => { settled = true; return null; }, error => { settled = true; return error; });
  await firstTwo.promise;
  failure.resolve();
  await setImmediate();
  assert.equal(settled, false, "the already-started object must be awaited");
  assert.deepEqual(started, selected.slice(0, 2));
  remaining.resolve();
  const error = await pending;
  assert.ok(error instanceof AggregateError && hasPreparationReport(error));
  assert.deepEqual(error.report.results.map(result => result.status), ["failed", "succeeded", "not-started", "not-started"]);
  assert.equal(error.report.results[0]?.exitCode, 7);
  assert.match(error.errors[0].message, /exit 7/);
});

test("spawn rejection and missing exit receipts fail without launching later objects", async () => {
  for (const outcome of [new Error("injected spawn failure"), undefined]) {
    const started: string[] = [];
    await assert.rejects(runPreparationObjects({
      projectRoot: root, objectIds: ids.slice(0, 2), concurrency: 1, onEvent: quiet,
      async runCommand({ id }): Promise<ObjectCommandOutcome> {
        started.push(id);
        if (outcome instanceof Error) throw outcome;
        return Reflect.apply(Array.prototype.pop, [outcome], []);
      },
    }), error => {
      assert.ok(error instanceof AggregateError && hasPreparationReport(error));
      assert.deepEqual(error.report.results.map(result => result.status), ["failed", "not-started"]);
      return true;
    });
    assert.deepEqual(started, [ids[0]]);
  }
});

test("preparation validates selected registry IDs, capacities, and all scripts before starting", async () => {
  let calls = 0;
  const options = { projectRoot: root, onEvent: quiet, runCommand: async (): Promise<ObjectCommandOutcome> => { calls++; return success; } };
  for (const objectIds of [[ids[0], ids[0]], ["not-an-object"], ["../escape"]]) {
    await assert.rejects(runPreparationObjects({ ...options, objectIds }), /SCENE_OBJECTS/);
  }
  for (const concurrency of [0, -1, 1.5, Infinity]) {
    await assert.rejects(runPreparationObjects({ ...options, concurrency }), /scheduling options/);
  }
  const directory = await mkdtemp(resolve(tmpdir(), "cssearth-preparation-missing-"));
  try {
    await assert.rejects(runPreparationObjects({ ...options, projectRoot: directory }), /script is missing/);
  } finally { await rm(directory, { recursive: true, force: true }); }
  assert.equal(calls, 0);
});

test("an empty verified selection runs no commands", async () => {
  const report = await runPreparationObjects({
    projectRoot: root, objectIds: [], onEvent: quiet,
    async runCommand() { assert.fail("an empty queue must not spawn"); },
  });
  assert.deepEqual(report.results, []);
  assert.equal(report.concurrency, 0);
});

test("the native command interface retains actual process exits and signals", async () => {
  assert.deepEqual(await runObjectCommand({
    command: process.execPath, argumentsList: ["-e", "process.exitCode = 7"], cwd: root,
  }), { exitCode: 7, signal: null });
  assert.deepEqual(await runObjectCommand({
    command: process.execPath, argumentsList: ["-e", "process.kill(process.pid, 'SIGTERM')"], cwd: root,
  }), { exitCode: null, signal: "SIGTERM" });
  await assert.rejects(runObjectCommand({
    command: resolve(root, "definitely-missing-preparation-command"), argumentsList: [], cwd: root,
  }), /ENOENT/);
});

test("objects start heaviest first and only while their expected growth fits the available memory", async () => {
  const selected = ids.slice(0, 5), peaks = new Map(selected.map((id, i) => [id, i === 3 ? 4 : 1]));
  const gates = new Map(selected.map(id => [id, deferred()])), started: string[] = [];
  let reserved = 0, maximumReserved = 0, launched = deferred();
  const pending = runPreparationObjects({
    projectRoot: root, objectIds: selected, concurrency: 4, onEvent: quiet, memoryAvailableBytes: () => 5, memoryFloorBytes: 0,
    peakMemoryBytes: async id => peaks.get(id) ?? 0, residentBytes: () => new Map(),
    async runCommand({ id }) {
      started.push(id); reserved += peaks.get(id) ?? 0; maximumReserved = Math.max(maximumReserved, reserved);
      launched.resolve();
      await gates.get(id)?.promise;
      reserved -= peaks.get(id) ?? 0; return success;
    },
  });
  await launched.promise; await setImmediate();
  assert.deepEqual(started, [selected[3], selected[0]]);
  launched = deferred(); gates.get(selected[3])?.resolve(); await launched.promise; await setImmediate();
  assert.deepEqual(started, [selected[3], selected[0], selected[1], selected[2], selected[4]]);
  for (const gate of gates.values()) gate.resolve();
  const report = await pending;
  assert.ok(maximumReserved <= 5);
  assert.deepEqual(report.results.map(result => result.id), selected);
});
