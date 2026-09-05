import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { preparationFileSets, runCachedPreparationObjects, sharedPreparationFiles } from "./prepare-planets.mjs";

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "cssearth-prepare-planets-"));
  try {
    await writeFile(join(root, "shared"), "shared generator");
    for (const id of ["moon", "pluto"]) {
      await writeFile(join(root, `${id}-input`), id);
      await writeFile(join(root, `${id}-output`), `prepared ${id}`);
    }
    const started = [];
    const options = {
      projectRoot: root, objectIds: ["moon", "pluto"], environment: async () => ({ version: "pinned" }),
      sharedFiles: async () => ["shared"],
      packageFiles: async (_, id) => ({ inputs: [`${id}-input`], outputs: [`${id}-output`] }),
      onEvent: () => {},
      schedule: async ({ objectIds, runCommand }) => {
        for (const id of objectIds) {
          const outcome = await runCommand({ id });
          assert.equal(outcome.exitCode, 0);
        }
        return { results: objectIds.map(id => ({ id, status: "succeeded" })) };
      },
      runCommand: async ({ id }) => {
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
test("actual shared site preparation dependencies invalidate a verified warm cache", async () => fixture(async ({ root, options, started }) => {
  const dependencies = ["site/runtime-policy.mjs", "site/scene-contract.mjs",
    "site/destination-search.mjs", "site/prepared-shell-titles.mjs"];
  await mkdir(join(root, "site/test"), { recursive: true });
  await writeFile(join(root, "package.json"), "{}");
  await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  for (const path of dependencies) await writeFile(join(root, path),
    await readFile(new URL(`../${path}`, import.meta.url)));
  const actualOptions = { ...options, sharedFiles: sharedPreparationFiles };
  await runCachedPreparationObjects(actualOptions);
  started.length = 0;
  assert.deepEqual((await runCachedPreparationObjects(actualOptions)).cached, ["moon", "pluto"]);
  for (const path of dependencies) {
    await writeFile(join(root, path), `${await readFile(join(root, path), "utf8")}\n// Changed preparation dependency.\n`);
    await runCachedPreparationObjects(actualOptions);
    assert.deepEqual(started, ["moon", "pluto"], `${path} must invalidate existing receipts`);
    started.length = 0;
    assert.deepEqual((await runCachedPreparationObjects(actualOptions)).cached, ["moon", "pluto"]);
  }
  await writeFile(join(root, "site/new-shared-policy.mjs"), "export const setting = 1;\n");
  await runCachedPreparationObjects(actualOptions);
  assert.deepEqual(started, ["moon", "pluto"], "New shared dependencies change the bound input set");
  started.length = 0;
  await writeFile(join(root, "site/test/source.test.mjs"), "// Browser-only test change.\n");
  assert.deepEqual((await runCachedPreparationObjects(actualOptions)).cached, ["moon", "pluto"]);
  assert.deepEqual(started, [], "Test-only edits cannot force production preparation");
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
