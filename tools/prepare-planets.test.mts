import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { preparationDependencies, preparationFileSets, runCachedPreparationObjects, sharedPreparationFiles, objectPreparationFiles } from "./prepare-planets.mts";
import type { CachedPreparationOptions, PreparationFileSet } from './prepare-planets.mts';
import type { ObjectCommandOutcome, PreparationCommand, PreparationOptions, PreparationReport } from './run-implemented-planets.mts';

type FixtureOptions = CachedPreparationOptions & Required<Pick<PreparationOptions, 'projectRoot' | 'objectIds' | 'runCommand' | 'onEvent'>>;
interface Fixture { root: string; options: FixtureOptions; started: string[]; }

async function fixture(run: (fixture: Fixture) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "cssearth-prepare-planets-"));
  try {
    await writeFile(join(root, "shared"), "shared generator");
    for (const id of ["moon", "pluto"]) {
      await writeFile(join(root, `${id}-input`), id);
      await writeFile(join(root, `${id}-output`), `prepared ${id}`);
    }
    const started: string[] = [];
    const options: FixtureOptions = {
      projectRoot: root, objectIds: ["moon", "pluto"], environment: async () => ({ version: "pinned" }),
      sharedFiles: async () => ["shared"],
      packageFiles: async (_root: string, id: string): Promise<PreparationFileSet> => ({ inputs: [`${id}-input`], outputs: [`${id}-output`] }),
      onEvent: () => {},
      schedule: async ({ objectIds, runCommand }: PreparationOptions = {}): Promise<PreparationReport> => {
        if (!objectIds || !runCommand) throw new TypeError('Fixture schedule requires its queue and command.');
        for (const id of objectIds) {
          const outcome = await runCommand({ id, command: process.execPath, argumentsList: [], cwd: root });
          assert.equal(outcome.exitCode, 0);
        }
        return { mode: 'prepare', startedAt: new Date().toISOString(), requestedConcurrency: 1, concurrency: 1, elapsedMilliseconds: 0,
          results: objectIds.map(id => ({ id, script: 'fixture', status: "succeeded" })) };
      },
      runCommand: async ({ id }: PreparationCommand): Promise<ObjectCommandOutcome> => {
        started.push(id);
        await writeFile(join(root, `${id}-output`), `prepared ${await readFile(join(root, `${id}-input`), "utf8")}`);
        return { exitCode: 0, signal: null };
      },
    };
    await run({ root, options, started });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("unchanged existing objects reuse verified files without starting their producers", async () => fixture(async ({ options, started }) => {
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ["moon", "pluto"]);
  started.length = 0;
  assert.deepEqual((await runCachedPreparationObjects(options)).cached, ["moon", "pluto"]);
  assert.deepEqual(started, []);
}));
test("one package edit or damaged output rebuilds only that object", async () => fixture(async ({ root, options, started }) => {
  await runCachedPreparationObjects(options); started.length = 0;
  await writeFile(join(root, "moon-input"), "changed moon");
  await runCachedPreparationObjects(options);
  assert.deepEqual(started, ["moon"]); started.length = 0;
  await writeFile(join(root, "pluto-output"), "damaged");
  await runCachedPreparationObjects(options);
  assert.deepEqual(started, ["pluto"]);
}));
test("shared generator or actual toolchain changes invalidate every affected cache", async () => fixture(async ({ root, options, started }) => {
  await runCachedPreparationObjects(options); started.length = 0;
  await writeFile(join(root, "shared"), "changed generator");
  await runCachedPreparationObjects(options);
  assert.deepEqual(started, ["moon", "pluto"]); started.length = 0;
  await runCachedPreparationObjects({ ...options, environment: async () => ({ version: "changed" }) });
  assert.deepEqual(started, ["moon", "pluto"]);
}));
test("runtime and shell edits do not prepare objects; imported generators and source edits do", async () => fixture(async ({ root, options, started }) => {
  for (const directory of ["site", "src/platform", "tools"]) await mkdir(join(root, directory), { recursive: true });
  await writeFile(join(root, "package.json"), "{}");
  await writeFile(join(root, "pnpm-lock.yaml"), "lock");
  await writeFile(join(root, "tools/generator.mjs"), "export const value = 1;");
  for (const id of ["moon", "pluto"]) {
    const base = `src/planets/${id}`;
    for (const directory of ["tools", "site", "source", "runtime"]) await mkdir(join(root, base, directory), { recursive: true });
    await writeFile(join(root, base, "source/manifest.json"), JSON.stringify({ generatedIntermediates: [] }));
    await writeFile(join(root, base, "site/control-content.source.mjs"), "export const objectControls = {};");
    await writeFile(join(root, base, "tools/prepare.mjs"), 'const steps = [["generate.mjs"]];');
    await writeFile(join(root, base, "runtime/preparedOutput.mjs"), "export const VALUE = 1;");
    await writeFile(join(root, base, "tools/generate.mjs"), "import { value } from '../../../../tools/generator.mjs';");
    await writeFile(join(root, base, "runtime/client.mjs"), "// runtime");
  }
  const actual = { ...options, sharedFiles: sharedPreparationFiles, packageFiles: objectPreparationFiles };
  await runCachedPreparationObjects(actual); started.length = 0;
  for (const path of ["site/runtime-policy.mts", "site/shell.mjs", "src/platform/camera-input.mts", "tools/audit.mjs", "src/planets/moon/runtime/client.mjs"]) {
    await writeFile(join(root, path), "// changed runtime or audit code");
  }
  assert.deepEqual((await runCachedPreparationObjects(actual)).cached, ["moon", "pluto"]);
  assert.deepEqual(started, []);
  await writeFile(join(root, "tools/generator.mjs"), "export const value = 2;");
  await runCachedPreparationObjects(actual); assert.deepEqual(started, ["moon", "pluto"]); started.length = 0;
  await writeFile(join(root, "src/planets/moon/source/texture.bin"), "changed source");
  await runCachedPreparationObjects(actual); assert.deepEqual(started, ["moon"]);
}));
test("full rebuild bypasses a valid cache and failed producers cannot seal outputs", async () => fixture(async ({ options, root, started }) => {
  await runCachedPreparationObjects(options); started.length = 0;
  await runCachedPreparationObjects({ ...options, force: true });
  assert.deepEqual(started, ["moon", "pluto"]);
  await rm(join(root, ".local/preparation/moon.json"));
  await assert.rejects(runCachedPreparationObjects({ ...options, runCommand: async () => ({ exitCode: 2, signal: null }) }));
  await assert.rejects(readFile(join(root, ".local/preparation/moon.json")), { code: "ENOENT" });
}));
test("cache selection rejects unknown or duplicate registry objects", async () => fixture(async ({ options }) => {
  await assert.rejects(runCachedPreparationObjects({ ...options, objectIds: ["moon", "moon"] }), /unique IDs/);
  await assert.rejects(runCachedPreparationObjects({ ...options, objectIds: ["invented-object"] }), /unique IDs/);
}));
test("external prepared inputs are declared as data and cannot escape the project", async () => fixture(async ({ root }) => {
  await mkdir(join(root, "src/planets/earth"), { recursive: true });
  const declaration = join(root, "src/planets/earth/preparation.json");
  await writeFile(join(root, "release.json"), JSON.stringify({ version: "v1", files: [{ filename: "tile.pack" }] }));
  await writeFile(declaration, JSON.stringify({ schema: "cssearth-preparation-inputs@1",
    fileSets: [{ manifest: "release.json", directory: ".local/geometry" }] }));
  assert.deepEqual(await preparationFileSets(root, "earth"), ["src/planets/earth/preparation.json", "release.json", ".local/geometry/v1/tile.pack"]);
  await writeFile(join(root, "release.json"), JSON.stringify({ version: "../escape", files: [{ filename: "tile.pack" }] }));
  await assert.rejects(preparationFileSets(root, "earth"));
}));

// Type-only imports cannot affect generated bytes; executable typed helpers do.
test("preparation closure follows executable TypeScript and resolves source .js specifiers", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-typed-preparation-"));
  try {
    await writeFile(join(root, 'entry.mts'), "import type { Absent } from './type-only.mts';\nimport { prepare } from './helper.js';\nexport const value: number = prepare();\n");
    await writeFile(join(root, 'helper.ts'), "export const prepare = (): number => 42;\n");
    assert.deepEqual(await preparationDependencies(root, ['entry.mts']), ['entry.mts', 'helper.ts']);
    await writeFile(join(root, 'helper.ts'), "export { value } from './missing.mts';\n");
    await assert.rejects(preparationDependencies(root, ['entry.mts']), /missing\.mts/);
  } finally { await rm(root, {recursive: true, force: true}); }
});
