import assert from "node:assert/strict";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import { createSourceManifest, assertSourceBytes } from "../../../platform/source-manifest.mjs";
import { createPreparedBlockDecoder, PREPARED_BLOCK_LIMITS } from "../../../platform/prepared-map/prepared-block.mjs";
import { isPreparedBlockReference, PREPARED_BLOCK_ENCODING } from "../../../platform/prepared-map/prepared-block-transport.mjs";
import { normalizeCityAssetOrigin } from "../../../platform/prepared-map/city-asset-url.mjs";
import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";
import { readWorldCoverCatalog } from "./city/worldcover-catalog.mjs";
import { prepareWmtsCoverage } from "./city/wmts-coverage.mjs";
import { hashBytes, prepareTileNode, tileKey } from "./city/prepare-wmts-tree.mjs";
import { prepareWmtsTile, wmtsAddress } from "./city/wmts-page-geometry.mjs";
import { releaseFiles, verifyLocalPack } from "./city/wmts-release.mjs";

const projectDirectory = resolve(import.meta.dirname, "../../../..");
const sourcePaths = ["city/wmts-release.json", "city/catalog-pin.json", "city/worldcover-rgbnir-2021.json.gz", "city/manifest.json"];
const addresses = level => level.bands.flatMap(band => Array.from({ length: band.y1 - band.y0 }, (_, dy) =>
  band.ranges.flatMap(([a, b]) => Array.from({ length: b - a }, (_, dx) => ({ zoom: level.zoom, x: a + dx, y: band.y0 + dy })))).flat());

// A published worldwide release is a pinned acquired input, like source imagery.
// Rebuild its small runtime binding; author a new geometry release only through
// prepare:earth-global. Neither a missing pack nor a changed version falls back
// to runtime data, an authoring cache, the network, or an incomplete globe.
export async function preparePinnedGlobalWmts({ projectRoot = projectDirectory, scene = PREPARED_EARTH_SCENE,
  writeOutput = true, verifyOnly = false, onProgress = () => {} } = {}) {
  const objectRoot = resolve(projectRoot, "src/planets/earth"), sourceRoot = resolve(objectRoot, "source");
  const source = await createSourceManifest({ planetId: "earth", planetName: "Earth", sourceRoot });
  const declarations = new Map([source.manifest.inputs, source.manifest.generatedIntermediates, source.manifest.documents]
    .flat().map(entry => [entry.path, entry]));
  const pinned = new Map(), sourceHashes = {};
  for (const path of sourcePaths) {
    const entry = declarations.get(path);
    if (!entry) throw new Error(`Earth worldwide source is not declared: ${path}`);
    const bytes = await readFile(resolve(sourceRoot, path));
    sourceHashes[path] = assertSourceBytes({ entry, bytes, planetName: "Earth" });
    pinned.set(path, bytes);
  }
  const release = JSON.parse(pinned.get("city/wmts-release.json")), content = JSON.parse(pinned.get("city/manifest.json"));
  const files = releaseFiles(release), byName = new Map(files.map(file => [file.filename, file]));
  const catalog = await readWorldCoverCatalog({ directory: pathToFileURL(resolve(sourceRoot, "city") + "/") });
  assert.equal(release.sourceSha256, catalog.pin.expectedSha256, "Worldwide release uses another source catalog");
  assert.equal(release.dataset, catalog.pin.dataset, "Worldwide release dataset changed");
  assert.equal(content.dataset, release.dataset, "Worldwide control content uses another dataset");
  const entries = [...catalog.entries.values()];
  const levels = Array.from({ length: 10 }, (_, i) => prepareWmtsCoverage(entries, i + 5, { includePolar: true }));
  const coarse = addresses(levels[0]), regions = addresses(levels[3]);
  const expectedNames = [...regions, ...coarse].map(({ zoom, x, y }) => `${zoom}-${x}-${y}.pack`).sort();
  assert.deepEqual([...byName.keys()].sort(), expectedNames, "Worldwide release pack coverage is incomplete");
  assert.equal(release.regions, regions.length, "Worldwide release region count changed");
  assert.equal(release.tiles, levels.reduce((sum, level) => sum + level.tileCount, 0), "Worldwide release tile count changed");
  for (const file of files) {
    assert.ok(Number.isSafeInteger(file.tiles) && file.tiles > 0, "Invalid prepared pack tile total");
    assert.ok(Number.isSafeInteger(file.leaves) && file.leaves >= 0, "Invalid prepared pack leaf total");
  }
  assert.equal(release.tiles, files.reduce((sum, file) => sum + file.tiles, 0), "Worldwide pack tile totals disagree");
  assert.equal(release.leaves, files.reduce((sum, file) => sum + file.leaves, 0), "Worldwide pack leaf totals disagree");
  assert.equal(typeof release.qualification, "string", "Worldwide release qualification is missing");
  const directory = resolve(projectRoot, ".local/wmts-global", release.version);
  let verified = 0;
  for (const file of files) {
    await verifyLocalPack(directory, file);
    if (++verified % 1000 === 0 || verified === files.length) onProgress({ verifiedPacks: verified, totalPacks: files.length });
  }
  const report = { schema: "cssearth-pinned-wmts-preparation@1", version: release.version, dataset: release.dataset,
    sourceHashes, packs: files.length, bytes: release.bytes, tiles: release.tiles, leaves: release.leaves,
    packInventorySha256: hashBytes(JSON.stringify(files)), geometry: "verified-pinned-input-not-regenerated" };
  if (verifyOnly) return { report: { ...report, runtimeBinding: "not-written" }, plan: null };

  const roots = [], referencedRegions = new Set();
  for (const address of coarse) {
    const filename = `${address.zoom}-${address.x}-${address.y}.pack`, file = byName.get(filename);
    const bytes = await readFile(resolve(directory, filename));
    // Bind these exact bytes again before decoding, including a replacement
    // between the complete pack verification and publication preparation.
    assert.equal(bytes.length, file.bytes, `Prepared coarse pack size changed: ${filename}`);
    assert.equal(hashBytes(bytes), file.sha256, `Prepared coarse pack changed: ${filename}`);
    const decoded = gunzipSync(bytes, { maxOutputLength: PREPARED_BLOCK_LIMITS.bytes });
    const decoder = createPreparedBlockDecoder(decoded);
    while (!decoder.step()) { /* Offline bounded decode. */ }
    decoder.result();
    const envelope = decoder.envelope;
    assert.equal(envelope?.schema, "cssearth-city-index@1", "Invalid pinned coarse index");
    assert.equal(envelope.dataset, release.dataset, "Pinned coarse dataset changed");
    assert.ok(Array.isArray(envelope.nodes) && Array.isArray(envelope.external), "Incomplete pinned coarse index");
    assert.equal(envelope.nodes[0]?.key, tileKey(address), "Pinned coarse root address changed");
    for (const stub of envelope.external) {
      const ref = stub.directory;
      assert.ok(stub.stub && stub.level === 8 && isPreparedBlockReference(ref, "/scenes/earth/"), "Invalid pinned region reference");
      assert.ok(ref.url.startsWith(`/scenes/earth/wmts-${release.version}/`), "Pinned region version changed");
      const name = ref.url.split("/").at(-1), target = byName.get(name);
      assert.ok(target && name === stub.key.replace("wmts-tile-", "") + ".pack" && ref.offset + ref.bytes <= target.bytes,
        "Pinned region reference escapes its pack");
      assert.ok(!referencedRegions.has(name), "Pinned region is referenced twice");
      referencedRegions.add(name);
    }
    const { pages, children, ...bounds } = prepareTileNode(address, scene).node;
    const { pages: preparedPages, children: preparedChildren, ...preparedBounds } = envelope.nodes[0];
    assert.deepEqual(bounds, preparedBounds, "Current Earth faces do not match the pinned coarse geometry");
    const groups = new Map();
    for (const page of prepareWmtsTile(address, scene)) {
      if (!groups.has(page.coarseKey)) groups.set(page.coarseKey, { normal: page.normal, lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] });
      const group = groups.get(page.coarseKey);
      for (const point of page.corners) for (let i = 0; i < 3; i++) {
        group.lo[i] = Math.min(group.lo[i], point[i]); group.hi[i] = Math.max(group.hi[i], point[i]);
      }
    }
    const coverageParts = [...groups.values()].map(({ normal, lo, hi }) => ({ normal,
      corners: Array.from({ length: 8 }, (_, i) => [0, 1, 2].map(axis => (i >> axis & 1 ? hi : lo)[axis])) }));
    roots.push({ ...bounds, coverageParts, stub: true, directory: { encoding: PREPARED_BLOCK_ENCODING,
      bytes: bytes.length, sha256: file.sha256, decodedBytes: decoded.length, decodedSha256: hashBytes(decoded),
      url: `/scenes/earth/wmts-${release.version}/${filename}`, offset: 0 } });
  }
  assert.equal(referencedRegions.size, regions.length, "Pinned coarse indexes do not reach every region");
  const assetOrigin = normalizeCityAssetOrigin(content.delivery?.assetOrigin);
  const plan = { schema: "cssearth-earth-city-pages@1", dataset: release.dataset, qualification: release.qualification,
    credit: content.credit, sourcePage: content.sourcePage, canonicalDprIndependent: true, assetOrigin, geometryOrigin: assetOrigin,
    topology: "wmts-quadtree@1", geometryVersion: release.version, roots,
    initialLayer: prepareWmtsTile(wmtsAddress(-58.38, -34.6, 14), scene)[0], rasterScale: 8, pageTemplate: "clipped-projective",
    poolSize: 512, decodedPageBytes: 256 * 256 * 4, maximumDecodedBytes: 512 * 256 * 256 * 4,
    maximumConcurrentLoads: 4, minimumZoom: 8, maximumZoom: 4096, targetCssPixels: 384,
    index: { maximumDirectories: 96, maximumBytes: 12 * 1024 * 1024, maximumDirectoryBytes: 2 * 1024 * 1024, maximumConcurrentLoads: 3 } };
  const moduleSource = `// Generated from the complete pinned WorldCover geometry hierarchy.\nexport const PREPARED_EARTH_CITY_PAGES=Object.freeze(${JSON.stringify(plan)});\n`;
  if (writeOutput) {
    const output = resolve(objectRoot, "runtime/preparedCityPages.mjs"), temporary = `${output}.partial-${process.pid}`;
    try { await writeFile(temporary, moduleSource, { flag: "wx" }); await rename(temporary, output); }
    finally { await rm(temporary, { force: true }); }
  }
  return { report: { ...report, roots: roots.length, runtimeBinding: "regenerated-from-pinned-coarse-packs",
    moduleSha256: hashBytes(moduleSource) }, plan, moduleSource };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--verify-only")) throw new Error("Use prepare-pinned-global-wmts.mjs [--verify-only].");
  const result = await preparePinnedGlobalWmts({ verifyOnly: args.includes("--verify-only"),
    onProgress: progress => console.log(JSON.stringify(progress)) });
  console.log(JSON.stringify(result.report));
}
