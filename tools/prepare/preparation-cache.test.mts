import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { observePreparationPath, readPreparationReceipt, readPreparationTraces, writePreparationReceipt } from "./preparation-cache.mts";
import type { PreparationTraces } from "./preparation-cache.mts";
import { PREPARATION_TRACE_SCHEMA, REGISTRY_MODULE, descriptorDigest } from "./preparation-trace-format.mts";
import type { PreparationAccess, TracedCommand, TracedState } from "./preparation-trace-format.mts";

async function fixture(run: (root: string) => Promise<void>) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "cssearth-preparation-cache-")));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function put(root: string, path: string, contents: string) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), contents);
}
/** What the trace records when a process first touches a path. */
async function firstState(root: string, path: string): Promise<TracedState> {
  const entry = await lstat(join(root, path)).catch(() => null);
  if (!entry) return { missing: true };
  const state: TracedState = { size: entry.size, modified: entry.mtimeMs, ...(entry.isDirectory() ? { directory: true as const } : {}) };
  if (path.endsWith("/object.json")) {
    const text = await readFile(join(root, path), "utf8");
    state.views = { registry: descriptorDigest(text, "registry"), recipe: descriptorDigest(text, "recipe"), pins: descriptorDigest(text, "pins") };
  }
  return state;
}
/** A merged trace, observed before the simulated preparation writes anything. */
async function observed(root: string, accesses: Record<string, PreparationAccess[]>, extra: { commands?: TracedCommand[]; catalogImporters?: string[]; unsupported?: string[] } = {}): Promise<PreparationTraces> {
  const files: PreparationTraces["files"] = new Map();
  for (const [path, kinds] of Object.entries(accesses)) {
    files.set(join(root, path), { accesses: new Set(kinds), first: [kinds[0] === "write" ? {} : await firstState(root, path)] });
  }
  return { files, commands: extra.commands ?? [], catalogImporters: new Set(extra.catalogImporters ?? []), unsupported: new Set(extra.unsupported ?? []) };
}
const receiptAt = (root: string) => ({ root, path: "receipt.json" });
const seal = (root: string, traces: PreparationTraces, sharedFiles: string[] = []) =>
  writePreparationReceipt({ root, path: "receipt.json", objectId: "moon", traces, sharedFiles, metadata: { toolchain: "fixture" } });
const evidence = (records: Record<string, { evidence: string }>) => Object.fromEntries(Object.entries(records).map(([path, record]) => [path, record.evidence]));

test("a receipt verifies what preparation read, probed, listed and wrote, and nothing else", async () => fixture(async root => {
  await put(root, "input.json", "source");
  await put(root, "listed/a.txt", "a");
  await put(root, "unread.txt", "unread");
  await put(root, "package.json", "{}");
  await mkdir(join(root, "probed"));
  const traces = await observed(root, { "input.json": ["read"], "missing.json": ["probe"], probed: ["probe"], listed: ["list"], "output.txt": ["write"] });
  await put(root, "output.txt", "prepared");
  await put(root, "probed/written-later.txt", "a directory's contents do not matter to a probe");
  const { receipt, refusal } = await seal(root, traces, ["package.json"]);
  assert.equal(refusal, null);
  assert.deepEqual(evidence(receipt?.inputs ?? {}), { "input.json": "bytes", listed: "names", "missing.json": "absent", "package.json": "bytes", probed: "directory" });
  assert.deepEqual(evidence(receipt?.outputs ?? {}), { "output.txt": "bytes" });
  const bytes = await readFile(join(root, "receipt.json"), "utf8");
  await seal(root, traces, ["package.json"]);
  assert.equal(await readFile(join(root, "receipt.json"), "utf8"), bytes, "receipts are deterministic");
  assert.deepEqual(await readPreparationReceipt(receiptAt(root)), receipt);
  await put(root, "unread.txt", "changed");
  await put(root, "listed/a.txt", "other contents, same names");
  assert.deepEqual(await readPreparationReceipt(receiptAt(root)), receipt);
  const changes: [string, () => Promise<unknown>, () => Promise<unknown>][] = [
    ["a read input", () => put(root, "input.json", "changed"), () => put(root, "input.json", "source")],
    ["a probed path that appears", () => put(root, "missing.json", "{}"), () => rm(join(root, "missing.json"))],
    ["a listed directory's names", () => put(root, "listed/b.txt", "b"), () => rm(join(root, "listed/b.txt"))],
    ["a shared file", () => put(root, "package.json", '{"changed":true}'), () => put(root, "package.json", "{}")],
    ["a damaged output", () => put(root, "output.txt", "damaged"), () => put(root, "output.txt", "prepared")],
    ["a missing output", () => rm(join(root, "output.txt")), () => put(root, "output.txt", "prepared")],
  ];
  for (const [name, change, restore] of changes) {
    await change();
    assert.equal(await readPreparationReceipt(receiptAt(root)), null, name);
    await restore();
    assert.deepEqual(await readPreparationReceipt(receiptAt(root)), receipt, `${name} restored`);
  }
}));

const descriptor = (id: string) => ({ schema: "cssearth-object@1", id, type: "moon",
  properties: { catalog: { name: id, description: "Card" }, recipe: { radius: 1 }, page: { metadata: { sha256: "a" } }, worldFrame: { radius: 1 } },
  prepared: { url: "prepared/b.json" } });
type Descriptor = ReturnType<typeof descriptor>;
async function editDescriptor(root: string, id: string, change: (value: Descriptor) => void) {
  const path = join(root, `src/objects/${id}/object.json`), value = JSON.parse(await readFile(path, "utf8"));
  change(value);
  await writeFile(path, JSON.stringify(value, null, 2));
}

test("object descriptors count only the fields each owner can change", async () => fixture(async root => {
  for (const id of ["moon", "pluto"]) await put(root, `src/objects/${id}/object.json`, JSON.stringify(descriptor(id), null, 2));
  const traces = await observed(root, { "src/objects/moon/object.json": ["read", "write"], "src/objects/pluto/object.json": ["load"] },
    { catalogImporters: [join(root, REGISTRY_MODULE)] });
  await editDescriptor(root, "moon", value => { value.prepared.url = "prepared/c.json"; });
  const { receipt, refusal } = await seal(root, traces);
  assert.equal(refusal, null);
  assert.deepEqual(evidence(receipt?.inputs ?? {}), { "src/objects/moon/object.json": "descriptor-recipe", "src/objects/pluto/object.json": "descriptor-registry" });
  assert.deepEqual(evidence(receipt?.outputs ?? {}), { "src/objects/moon/object.json": "descriptor-pins" });
  await editDescriptor(root, "moon", value => { value.properties.catalog.description = "A card from prepare:text"; });
  await editDescriptor(root, "pluto", value => {
    value.properties.catalog.description = "Another card";
    value.properties.recipe.radius = 9;
    value.prepared.url = "prepared/e.json";
  });
  assert.ok(await readPreparationReceipt(receiptAt(root)), "cards and another object's recipe and pins leave the receipt valid");
  const changes: [string, string, (value: Descriptor) => void, (value: Descriptor) => void][] = [
    ["the object's recipe", "moon", value => { value.properties.recipe.radius = 2; }, value => { value.properties.recipe.radius = 1; }],
    ["the object's preparation pins", "moon", value => { value.prepared.url = "prepared/z.json"; }, value => { value.prepared.url = "prepared/c.json"; }],
    ["another object's catalogue entry", "pluto", value => { value.properties.catalog.name = "Charon"; }, value => { value.properties.catalog.name = "pluto"; }],
    ["another object's world frame", "pluto", value => { value.properties.worldFrame.radius = 2; }, value => { value.properties.worldFrame.radius = 1; }],
  ];
  for (const [name, id, change, restore] of changes) {
    await editDescriptor(root, id, change);
    assert.equal(await readPreparationReceipt(receiptAt(root)), null, name);
    await editDescriptor(root, id, restore);
    assert.ok(await readPreparationReceipt(receiptAt(root)), `${name} restored`);
  }
  const writtenFirst = await observed(root, { "src/objects/moon/object.json": ["write", "read"] });
  assert.equal((await seal(root, writtenFirst)).refusal, null, "a descriptor a process wrote before reading has no first state to compare");
  const wider = await seal(root, await observed(root, { "src/objects/moon/object.json": ["read", "write"], "src/objects/pluto/object.json": ["load"] },
    { catalogImporters: [join(root, REGISTRY_MODULE), join(root, "site/prepared-context-objects.mts")] }));
  assert.equal(wider.receipt?.inputs["src/objects/pluto/object.json"]?.evidence, "bytes", "a module reading whole descriptors makes them whole inputs");
}));

test("an incomplete or changing trace refuses the receipt and removes the previous one", async () => fixture(async root => {
  await put(root, "input", "source");
  await put(root, "output", "prepared");
  await put(root, "src/objects/pluto/object.json", JSON.stringify(descriptor("pluto")));
  const base = { input: ["read"], output: ["write"] } satisfies Record<string, PreparationAccess[]>;
  const refused: [RegExp, () => Promise<PreparationTraces>][] = [
    [/worker thread/, () => observed(root, base, { unsupported: ["worker thread"] })],
    [/shell command \(sh\)/, () => observed(root, base, { commands: [{ command: "/bin/sh", args: ["-c", "true"], cwd: root, shell: true }] })],
    [/starts convert, whose file access is not recorded/, () => observed(root, base, { commands: [{ command: "/usr/bin/convert", args: ["input"], cwd: root, shell: false }] })],
    [/src\/objects\/pluto\/object\.json, which belongs to another object/, () => observed(root, { ...base, "src/objects/pluto/object.json": ["write"] })],
    [/wrote no files/, () => observed(root, { input: ["read"] })],
  ];
  for (const [reason, traces] of refused) {
    assert.equal((await seal(root, await observed(root, base))).refusal, null);
    const result = await seal(root, await traces());
    assert.match(result.refusal ?? "", reason);
    assert.equal(await readPreparationReceipt(receiptAt(root)), null);
  }
  const traces = await observed(root, base);
  await put(root, "input", "edited while preparing");
  const result = await seal(root, traces);
  assert.deepEqual(result.changed, ["input"]);
  assert.match(result.refusal ?? "", /input changed during preparation/);
}));

test("process records merge, and a process that left no record makes the trace incomplete", async () => fixture(async root => {
  const record = (pid: number, accesses: PreparationAccess[]) => JSON.stringify({ schema: PREPARATION_TRACE_SCHEMA, pid, argv: [],
    files: { [join(root, "input")]: { accesses, first: { size: 1, modified: pid } } }, commands: [], catalogImporters: [], unsupported: [] });
  await put(root, "traces/1.started", "");
  await put(root, "traces/1.json", record(1, ["read"]));
  await put(root, "traces/2.started", "");
  await put(root, "traces/2.json", record(2, ["probe"]));
  const merged = await readPreparationTraces(join(root, "traces"));
  assert.deepEqual([...merged.files.get(join(root, "input"))?.accesses ?? []].sort(), ["probe", "read"]);
  assert.equal(merged.files.get(join(root, "input"))?.first.length, 2);
  assert.deepEqual([...merged.unsupported], []);
  await put(root, "traces/3.started", "");
  assert.deepEqual([...(await readPreparationTraces(join(root, "traces"))).unsupported], ["process 3 left no preparation record"]);
}));

test("archives named to unzip become inputs, and Playwright's browser needs no checkout files", async () => fixture(async root => {
  await put(root, "data/archive.zip", "zip");
  await put(root, "output", "prepared");
  const { receipt, refusal } = await seal(root, await observed(root, { output: ["write"] }, { commands: [
    { command: "/usr/bin/unzip", args: ["-p", "data/archive.zip", "member.txt"], cwd: root, shell: false },
    { command: "/Users/someone/Library/Caches/ms-playwright/chromium_headless_shell-1/chrome-mac/headless_shell", args: ["--headless"], cwd: root, shell: false },
  ] }));
  assert.equal(refusal, null);
  assert.deepEqual(evidence(receipt?.inputs ?? {}), { "data/archive.zip": "bytes" });
  assert.deepEqual(receipt?.programs, ["headless_shell", "unzip"]);
}));

test("receipts reject path traversal and observe links through their targets", async () => fixture(async root => {
  await assert.rejects(observePreparationPath(root, "../outside", "bytes"), /Unsafe preparation path/);
  const outside = await realpath(await mkdtemp(join(tmpdir(), "cssearth-preparation-link-")));
  try {
    await writeFile(join(outside, "bundle.js"), "export {};");
    await symlink(outside, join(root, "dist"));
    const linked = await observePreparationPath(root, "dist/bundle.js", "bytes");
    assert.equal(linked?.bytes, 10);
    await writeFile(join(outside, "bundle.js"), "export const changed = true;");
    assert.notDeepEqual(await observePreparationPath(root, "dist/bundle.js", "bytes"), linked);
    await rm(join(outside, "bundle.js"));
    assert.equal(await observePreparationPath(root, "dist/bundle.js", "bytes"), null);
  } finally { await rm(outside, { recursive: true, force: true }); }
}));
