import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { runCachedPreparationObjects, tracedPreparationEnvironment } from "./prepare-objects.mts";
import type { CachedPreparationOptions } from './prepare-objects.mts';
import { PREPARATION_TRACE_VARIABLE } from './preparation-trace-format.mts';
import { runObjectCommand } from '../cli/run-implemented-objects.mts';
import type { PreparationCommand, PreparationOptions, PreparationReport } from '../cli/run-implemented-objects.mts';

type FixtureOptions = CachedPreparationOptions & Required<Pick<PreparationOptions, 'projectRoot' | 'objectIds' | 'runCommand'>>;
interface Fixture { root: string; options: FixtureOptions; started: string[]; events: { phase: string; id?: string; reason?: string }[]; }

// Each producer is a real Node process under the preparation trace: it reads its input and the shared generator,
// writes its output, and runs a shell command when asked.
const producer = `import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const [id, command] = process.argv.slice(2);
writeFileSync(id + '-output', 'prepared ' + readFileSync(id + '-input', 'utf8') + ' with ' + readFileSync('shared', 'utf8'));
if (command) execSync(command);
`;

async function fixture(run: (fixture: Fixture) => Promise<void>) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "cssearth-prepare-objects-")));
  try {
    await writeFile(join(root, "shared"), "shared generator");
    await writeFile(join(root, "producer.mjs"), producer);
    for (const id of ["moon", "pluto"]) await writeFile(join(root, `${id}-input`), id);
    const started: string[] = [], events: Fixture['events'] = [];
    const options: FixtureOptions = {
      projectRoot: root, objectIds: ["moon", "pluto"], environment: async () => ({ version: "pinned" }),
      sharedFiles: async () => [], onEvent: event => { events.push(event); },
      schedule: async ({ objectIds, runCommand }: PreparationOptions = {}): Promise<PreparationReport> => {
        if (!objectIds || !runCommand) throw new TypeError('Fixture schedule requires its queue and command.');
        for (const id of objectIds) {
          const outcome = await runCommand({ id, command: process.execPath, argumentsList: [], cwd: root });
          assert.equal(outcome.exitCode, 0);
        }
        return { mode: 'prepare', startedAt: new Date().toISOString(), requestedConcurrency: 1, concurrency: 1, elapsedMilliseconds: 0,
          results: objectIds.map(id => ({ id, script: 'fixture', status: "succeeded" })) };
      },
      runCommand: async ({ id, env }: PreparationCommand) => {
        started.push(id);
        return runObjectCommand({ command: process.execPath, argumentsList: ["producer.mjs", id], cwd: root, env });
      },
    };
    await run({ root, options, started, events });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("unchanged objects reuse verified files without starting their producers", async () => fixture(async ({ options, started }) => {
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ["moon", "pluto"]);
  started.length = 0;
  assert.deepEqual((await runCachedPreparationObjects(options)).cached, ["moon", "pluto"]);
  assert.deepEqual(started, []);
}));
test("one input edit or damaged output rebuilds only that object", async () => fixture(async ({ root, options, started }) => {
  await runCachedPreparationObjects(options); started.length = 0;
  await writeFile(join(root, "moon-input"), "changed moon");
  await runCachedPreparationObjects(options);
  assert.deepEqual(started, ["moon"]); started.length = 0;
  await writeFile(join(root, "pluto-output"), "damaged");
  await runCachedPreparationObjects(options);
  assert.deepEqual(started, ["pluto"]);
}));
test("a changed generator both producers read, or a changed toolchain, rebuilds both", async () => fixture(async ({ root, options, started }) => {
  await runCachedPreparationObjects(options); started.length = 0;
  await writeFile(join(root, "shared"), "changed generator");
  await runCachedPreparationObjects(options);
  assert.deepEqual(started, ["moon", "pluto"]); started.length = 0;
  await runCachedPreparationObjects({ ...options, environment: async () => ({ version: "changed" }) });
  assert.deepEqual(started, ["moon", "pluto"]);
}));
test("files a preparation never read leave its receipt valid", async () => fixture(async ({ root, options, started }) => {
  await runCachedPreparationObjects(options); started.length = 0;
  for (const path of ["site/runtime-policy.mts", "tools/audit.mjs", "src/objects/moon/text.json", "pluto-notes.md"]) {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), "// changed runtime, audit or reader text");
  }
  assert.deepEqual((await runCachedPreparationObjects(options)).cached, ["moon", "pluto"]);
  assert.deepEqual(started, []);
}));
test("full rebuild bypasses a valid cache and failed producers cannot seal outputs", async () => fixture(async ({ options, root, started }) => {
  await runCachedPreparationObjects(options); started.length = 0;
  await runCachedPreparationObjects({ ...options, force: true });
  assert.deepEqual(started, ["moon", "pluto"]);
  await assert.rejects(runCachedPreparationObjects({ ...options, force: true, runCommand: async () => ({ exitCode: 2, signal: null }) }));
  await assert.rejects(readFile(join(root, ".local/preparation/moon.json")), { code: "ENOENT" });
}));
test("a program the trace cannot follow leaves its object to rebuild", async () => fixture(async ({ root, options, started, events }) => {
  const unrecorded = { ...options, runCommand: async ({ id, env }: PreparationCommand) => {
    started.push(id);
    return runObjectCommand({ command: process.execPath, argumentsList: ["producer.mjs", id, "true"], cwd: root, env });
  } };
  await runCachedPreparationObjects(unrecorded);
  assert.deepEqual(events.filter(event => event.phase === "receipt-refused").map(event => [event.id, /shell command/.test(event.reason ?? "")]), [["moon", true], ["pluto", true]]);
  started.length = 0;
  await runCachedPreparationObjects(unrecorded);
  assert.deepEqual(started, ["moon", "pluto"]);
}));
test("cache selection rejects unknown or duplicate registry objects", async () => fixture(async ({ options }) => {
  await assert.rejects(runCachedPreparationObjects({ ...options, objectIds: ["moon", "moon"] }), /unique IDs/);
  await assert.rejects(runCachedPreparationObjects({ ...options, objectIds: ["invented-object"] }), /unique IDs/);
}));
test("the traced environment adds the trace once and keeps other Node options", () => {
  const environment = tracedPreparationEnvironment("/traces", { NODE_OPTIONS: "--max-old-space-size=4096", PATH: "/bin" });
  assert.equal(environment[PREPARATION_TRACE_VARIABLE], "/traces");
  assert.equal(environment.PATH, "/bin");
  assert.match(environment.NODE_OPTIONS ?? "", /^--max-old-space-size=4096 --import=file:\S+\/tools\/prepare\/preparation-trace\.mts$/u);
  assert.equal(tracedPreparationEnvironment("/traces", environment).NODE_OPTIONS, environment.NODE_OPTIONS);
});
