import {shape,dictionary,text} from "../../../../tools/objects/geographic-pages/source-records.mts";
import {validateSourceManifest, type SourceEntry} from '../../../../src/platform/source-manifest.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { PREPARED_EARTH_SCENE as scene } from "./prepared-fixture.mts";
import { preparePinnedGlobalWmts } from "../../../../tools/objects/geographic-pages/operations/prepare-pinned-global-wmts.mts";
import { prepareWmtsCoverage } from "../../../../tools/objects/geographic-pages/wmts-coverage.mts";
import { cityGeographicFrame } from "../../../../tools/objects/geographic-pages/page-geometry.mts";
import { readWorldCoverCatalog, WORLDCOVER_BUCKET, WORLDCOVER_PREFIX } from "../../../../tools/objects/geographic-pages/worldcover-catalog.mts";
import { sha256 } from '../../../../src/platform/sha256.mts';
import { coverageLookup, prepareRegionPack, prepareTreeSection, tileKey } from "../../../../tools/objects/geographic-pages/prepare-wmts-tree.mts";
import type { WmtsCoverage } from "../../../../tools/objects/geographic-pages/contracts.mts";

const version = "1111111111111111", dataset = "esa-worldcover-rgbnir-2021-v200";
const sourcePath = "src/objects/earth/source/", outputPath = "src/objects/earth/prepared/pages.json";
const records = new Map<string,Uint8Array>(), temporary: string[] = [];
type ReleaseFile={filename:string;bytes:number;sha256:string;tiles:number;leaves:number};
let release:{schema:string;version:string;dataset:string;regions:number;tiles:number;leaves:number;bytes:number;files:ReleaseFile[];qualification:string;sourceSha256?:string};
let sourceManifest:ReturnType<typeof validateSourceManifest>;
const list = (level: WmtsCoverage) => {
  const result = [];
  for (const band of level.bands) for (let y = band.y0; y < band.y1; y++)
    for (const [a, b] of band.ranges) for (let x = a; x < b; x++) result.push({ zoom: level.zoom, x, y });
  return result;
};

before(async () => {
  const catalog = await readWorldCoverCatalog({directory:new URL("../../../../src/objects/earth/source/city/",import.meta.url)}), entry = required(catalog.entries.get("S35W059"));
  const levels = Array.from({ length: 10 }, (_, i) => prepareWmtsCoverage([entry], i + 5, { includePolar: true }));
  const hasTile = coverageLookup(levels), regions = new Map<string,ReturnType<typeof prepareRegionPack>["root"]>(), files: ReleaseFile[] = [];
  const add = (address: {zoom:number;x:number;y:number}, prepared: {bytes:Uint8Array;tiles:number;leaves:number}) => {
    const filename = `${address.zoom}-${address.x}-${address.y}.pack`;
    records.set(`.local/wmts-global/${version}/${filename}`, prepared.bytes);
    files.push({ filename, bytes: prepared.bytes.length, sha256: sha256(prepared.bytes), tiles: prepared.tiles, leaves: prepared.leaves });
  };
  for (const address of list(levels[3])) {
    const pack = prepareRegionPack(address, scene, hasTile, dataset, version, {assetPath:"/scenes/earth/"});
    regions.set(tileKey(address), pack.root); add(address, pack);
  }
  for (const address of list(levels[0])) add(address,
    prepareTreeSection(address, 7, scene, hasTile, child => required(regions.get(tileKey(child))), dataset));
  release = { schema: "cssearth-global-wmts-release@1", version, dataset,
    regions: regions.size, tiles: files.reduce((sum, file) => sum + file.tiles, 0),
    leaves: files.reduce((sum, file) => sum + file.leaves, 0), bytes: files.reduce((sum, file) => sum + file.bytes, 0), files,
    qualification: "Test source footprint; geometry remains a pinned input." };
  const decoded = Buffer.from(JSON.stringify({ schema: "cssearth-worldcover-inventory@1", dataset,
    bucket: WORLDCOVER_BUCKET, prefix: WORLDCOVER_PREFIX, entries: [entry] }));
  const encoded = gzipSync(decoded), catalogPin = { ...catalog.pin, tileCount: 1, sourceBytes: entry.sourceBytes,
    expectedBytes: encoded.length, expectedDecodedBytes: decoded.length, expectedSha256: sha256(encoded) };
  release.sourceSha256 = catalogPin.expectedSha256;
  records.set(sourcePath + "city/wmts-release.json", Buffer.from(JSON.stringify(release)));
  records.set(sourcePath + "city/catalog-pin.json", Buffer.from(JSON.stringify(catalogPin)));
  records.set(sourcePath + "city/worldcover-rgbnir-2021.json.gz", encoded);
  records.set(sourcePath + "city/manifest.json", await readFile(new URL("../../../../src/objects/earth/source/city/manifest.json", import.meta.url)));
  records.set(sourcePath + "preparation/paged-ellipsoid.json", await readFile(new URL("../../../../src/objects/earth/source/preparation/paged-ellipsoid.json", import.meta.url)));
  const actual = validateSourceManifest('earth',JSON.parse((await readFile(new URL("../../../../src/objects/earth/source/manifest.json", import.meta.url))).toString('utf8')));
  const pinned = <T extends SourceEntry,>(values: readonly T[]) => values.filter(value => records.has(sourcePath + value.path)).map(value => ({ ...value,
    expectedBytes: required(records.get(sourcePath + value.path)).length, expectedSha256: sha256(required(records.get(sourcePath + value.path))) }));
  sourceManifest = { ...actual, inputs: pinned(actual.inputs), generatedIntermediates: [], documents: pinned(actual.documents) };
  records.set(sourcePath + "manifest.json", Buffer.from(JSON.stringify(sourceManifest)));
  records.set(outputPath, Buffer.from("previous runtime binding\n"));
});
after(async () => { for (const root of temporary) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-pinned-wmts-")); temporary.push(root);
  for (const [path, bytes] of records) {
    const target = resolve(root, path); await mkdir(resolve(target, ".."), { recursive: true }); await writeFile(target, bytes);
  }
  return root;
}
async function repin(root: string, value: unknown) {
  const bytes = Buffer.from(JSON.stringify(value)), manifest = structuredClone(sourceManifest);
  Object.assign(required(manifest.inputs.find(entry => entry.path === "city/wmts-release.json")),
    { expectedBytes: bytes.length, expectedSha256: sha256(bytes) });
  await writeFile(resolve(root, sourcePath, "city/wmts-release.json"), bytes);
  await writeFile(resolve(root, sourcePath, "manifest.json"), JSON.stringify(manifest));
}

test("ordinary preparation verifies every pinned pack and reproduces runtime binding without an authoring cache", async () => {
  const projectRoot = await fixture(), first = await preparePinnedGlobalWmts({objectId:"earth",scene, projectRoot });
  assert.equal(first.report.packs, release.files.length); assert.equal(first.report.bytes, release.bytes);
  assert.equal(first.report.geometry, "verified-pinned-input-not-regenerated");
  assert.ok(first.plan);assert.ok("jsonSource" in first);
  assert.equal(first.plan.geometryVersion, version); assert.equal(first.plan.roots.length, release.files.filter((f: { filename: string; }) => f.filename.startsWith("5-")).length);
  assert.equal(await readFile(resolve(projectRoot, outputPath), "utf8"), first.jsonSource);
  await rm(resolve(projectRoot, outputPath));
  const second = await preparePinnedGlobalWmts({objectId:"earth",scene, projectRoot });
  assert.ok("jsonSource" in second);assert.equal(second.jsonSource, first.jsonSource); assert.deepEqual(second.report, first.report);
  assert.deepEqual(await readFile(resolve(projectRoot, sourcePath, "city/wmts-release.json")), records.get(sourcePath + "city/wmts-release.json"));
  const verified = await preparePinnedGlobalWmts({objectId:"earth",scene, projectRoot, verifyOnly: true });
  assert.equal(verified.plan, null); assert.equal(verified.report.runtimeBinding, "not-written");
});

test("missing or corrupt source pins fail before replacing the committed binding", async () => {
  for (const kind of ["missing", "corrupt", "undeclared"]) {
    const projectRoot = await fixture(), path = resolve(projectRoot, sourcePath, "city/wmts-release.json");
    if (kind === "missing") await rm(path);
    else if (kind === "corrupt") { const bytes = await readFile(path); bytes[20] ^= 1; await writeFile(path, bytes); }
    else { const manifest = structuredClone(sourceManifest); manifest.inputs[0].path = "city/other.json";
      await writeFile(resolve(projectRoot, sourcePath, "manifest.json"), JSON.stringify(manifest)); }
    await assert.rejects(preparePinnedGlobalWmts({objectId:"earth",scene, projectRoot }));
    assert.deepEqual(await readFile(resolve(projectRoot, outputPath)), records.get(outputPath));
  }
});

test("missing and corrupt packs cannot silently regenerate or fall back", async () => {
  for (const kind of ["missing", "corrupt"]) {
    const projectRoot = await fixture(), file = release.files[0], path = resolve(projectRoot, `.local/wmts-global/${version}`, file.filename);
    if (kind === "missing") await rm(path);
    else { const bytes = await readFile(path); bytes[bytes.length - 1] ^= 1; await writeFile(path, bytes); }
    await assert.rejects(preparePinnedGlobalWmts({objectId:"earth",scene, projectRoot }));
    assert.deepEqual(await readFile(resolve(projectRoot, outputPath)), records.get(outputPath));
  }
});

test("a repinned version cannot reuse packs containing references to another release", async () => {
  const projectRoot = await fixture(), replacement = "2222222222222222";
  await repin(projectRoot, { ...release, version: replacement });
  await rename(resolve(projectRoot, `.local/wmts-global/${version}`), resolve(projectRoot, `.local/wmts-global/${replacement}`));
  await assert.rejects(preparePinnedGlobalWmts({objectId:"earth",scene, projectRoot }), /region version changed/);
  assert.deepEqual(await readFile(resolve(projectRoot, outputPath)), records.get(outputPath));
});

test("a repinned release must still match the catalog and complete source footprint", async () => {
  for (const value of [{ ...release, sourceSha256: "0".repeat(64) }, { ...release, regions: release.regions + 1 },
    { ...release, files: release.files.slice(1), bytes: release.bytes - release.files[0].bytes }]) {
    const projectRoot = await fixture(); await repin(projectRoot, value);
    await assert.rejects(preparePinnedGlobalWmts({objectId:"earth",scene, projectRoot }));
    assert.deepEqual(await readFile(resolve(projectRoot, outputPath)), records.get(outputPath));
  }
});

test("changed prepared face geometry cannot acquire the identity of the pinned release", async () => {
  const projectRoot = await fixture(), changed = structuredClone(scene);
  for (const band of changed.body.bands) for (const leaf of band.leaves) {
    const matrix = cityGeographicFrame(leaf).split(",").map(Number); matrix[12] += 10; leaf.geographicFrameMatrix = matrix.join(",");
  }
  await assert.rejects(preparePinnedGlobalWmts({objectId:"earth", projectRoot, scene: changed }), /faces do not match/);
  assert.deepEqual(await readFile(resolve(projectRoot, outputPath)), records.get(outputPath));
});

test("ordinary preparation binds the acquired release while explicit authoring retains the full generator", async () => {
  const prepare = await readFile(new URL("../../../../tools/objects/paged-ellipsoid/index.mts", import.meta.url), "utf8");
  assert.ok(prepare.includes("preparePinnedGlobalWmts"));
  assert.ok(!prepare.includes("operations/prepare-global-wmts.mjs"));
  const {geographicPreparationInputs}=await import("../../../../tools/objects/geographic-pages/operations/preparation-inputs.mts");
  const {createOperationContext}=await import("../../../../tools/objects/geographic-pages/operations/context.mts");
  const context=createOperationContext({objectId:"earth"}),inputs=geographicPreparationInputs(context);
  for (const path of inputs) await readFile(context.projectUrl(path));
  assert.ok(inputs.includes("src/platform/prepared-map/prepared-block.mts"));
  const pkg = shape({scripts:dictionary(text)})(JSON.parse((await readFile(new URL("../../../../package.json", import.meta.url))).toString('utf8')));
  assert.equal(pkg.scripts["prepare:earth-global"], "node tools/objects/geographic-pages/operations/prepare-global-wmts.mts --object=earth && node tools/objects/geographic-pages/operations/integrate-global-wmts.mts --object=earth --latest");
});
