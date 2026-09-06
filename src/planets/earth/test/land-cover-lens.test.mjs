import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { PREPARED_EARTH_LAND_COVER_DESCRIPTOR as descriptor } from "../runtime/preparedLandCover.mjs";
import { PREPARED_GEOGRAPHIC_LENSES, PREPARED_ROOT_GEOGRAPHIC_LENSES } from "../runtime/preparedGeographicLenses.mjs";
import { preparePlaceCatalog } from "../tools/prepare-places.mjs";
import { prepareOverlayCapacity } from "../tools/city/geographic-overlay.mjs";
import { PREPARED_EARTH_SCENE as scene } from "../runtime/preparedScene.mjs";
import { prepareTreeSection } from "../tools/city/prepare-wmts-tree.mjs";
import { prepareWmtsTile } from "../tools/city/wmts-page-geometry.mjs";
import { requireGeographicLensPackage } from "../../../platform/geographic-lens-contract.mjs";
import { requireGeographicRoots, requireGeographicDirectory } from "../../../platform/prepared-map/geographic-index-contract.mjs";
import { readPreparedWmtsBlock } from "../../../platform/prepared-map/prepared-block-transport.mjs";
import { readPreparedJson } from "../../../platform/prepared-json-transport.mjs";
import { bindPreparedWmtsRaster, requireWmtsRasterSource, isPreparedProviderWmtsImage } from "../../../platform/prepared-map/wmts-raster-source.mjs";
import { createApiImageTransport as createTransport } from "../../../platform/prepared-map/api-image-transport.mjs";
const createApiImageTransport = options => createTransport({createImage:page=>({src:"",naturalWidth:page.width,naturalHeight:page.height,async decode(){}}),...options}).createScope({ maximumEntries: 512, maximumDecodedBytes: 128 * 1024 * 1024, idleMilliseconds: 0 });

const publicFile = url => new URL(`../../../../public${url}`, import.meta.url);
const bytes = await readFile(publicFile(descriptor.package.url)), content = JSON.parse(bytes), plan = content.pages;
const rootBytes = await readFile(publicFile(plan.rootDirectory.url));
const roots = JSON.parse(gunzipSync(rootBytes));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

test("Earth owns land cover and no country, region or city inherits it", async () => {
  const catalog = await preparePlaceCatalog();
  assert.equal(catalog.places.length, 38252);
  assert.deepEqual(PREPARED_ROOT_GEOGRAPHIC_LENSES, [descriptor]);
  for (const entity of catalog.places) {
    assert.equal(entity.lenses.some(item => item.id === descriptor.id), false);
    assert.equal(entity.lenses.some(item => item.id === "buenos-aires-noise"), entity.id === "3435910");
    assert.equal(entity.lensIds.includes(descriptor.id), false);
  }
});

test("the small lazy package pins its overview and reuses the existing global geometry directories", async () => {
  assert.equal(hash(bytes), descriptor.package.sha256);
  assert.ok(bytes.length < 16 * 1024);
  assert.deepEqual(content.scope, { objectId: "earth", entityIds: ["earth"] });
  for (const id of ["3435910", "1850147", "country:AR", "admin1:3433955"]) assert.throws(() => requireGeographicLensPackage(content, descriptor, id, prepareOverlayCapacity(), "earth"), /identity/);
  assert.equal(plan.roots.length, 0); assert.equal(plan.poolSize, 32);
  assert.equal(plan.geometryVersion, "fef1519d5f243617");
  assert.equal(requireGeographicLensPackage(content, descriptor, "earth", prepareOverlayCapacity(), "earth"), content);
  assert.deepEqual(await readPreparedJson(new Response(rootBytes), plan.rootDirectory), roots);
  assert.equal(requireGeographicRoots(roots, plan).length, 458);
  assert.equal(content.overview.images.length, 50); assert.equal(content.overview.decodedBytes, 24870912);
  for (const {image} of content.overview.images) {
    const pixels = await readFile(publicFile(image.url));
    assert.equal(pixels.length, image.bytes); assert.equal(hash(pixels), image.sha256);
  }
});

test("indexed observations reject oversized metadata, stale versions, malformed bounds and incompatible providers", async () => {
  for (const mutate of [p => {p.pages.rootDirectory.decodedBytes = 3 * 1024 * 1024;}, p => {p.pages.index.maximumDirectories = 100;},
    p => {p.pages.levels.maximum = 20;}, p => {p.pages.imageSource.urlTemplate += "?token=private";},
    p => {p.pages.imageSource.levels[5] = "06";}, p => {p.overview.decodedBytes++;}, p => {p.overview.images[0].image.width = 8192;},
    p => {p.pages.maximumDecodedBytes = 128 * 1024 * 1024;}, p => {p.scope.objectId = "mars";}]) {
    const value = structuredClone(content); mutate(value);
    assert.throws(() => requireGeographicLensPackage(value, descriptor, "earth", prepareOverlayCapacity(), "earth"));
  }
  for (const mutate of [p => {p.geometryVersion = "0000000000000000";}, p => {p.roots[0].directory.url = p.roots[0].directory.url.replace(plan.geometryVersion,"1111111111111111");},
    p => {p.roots.push(p.roots[0]);}, p => {p.roots[0].corners[0][0] = Infinity;}, p => {p.roots[0].level = 19;}]) {
    const value = structuredClone(roots); mutate(value); assert.throws(() => requireGeographicRoots(value, plan));
  }
  const corrupt = Buffer.from(rootBytes); corrupt[40] ^= 1;
  await assert.rejects(readPreparedJson(new Response(corrupt), plan.rootDirectory), /identity/);
});

test("directory traversal validates the expected root, strict child levels and source grid without changing geometry", async () => {
  const section = prepareTreeSection({zoom:8,x:86,y:154},9,scene,child=>child.zoom <= 9,null,plan.geometryDataset);
  const ref = {...section.ref,url:`/scenes/earth/wmts-${plan.geometryVersion}/8-86-154.pack`,offset:0};
  const data = await readPreparedWmtsBlock(new Response(section.bytes,{status:206,headers:{"Content-Range":`bytes 0-${ref.bytes-1}/${ref.bytes}`}}),ref);
  assert.equal(requireGeographicDirectory(data,ref,plan,new Set([section.root.key])),data);
  assert.throws(() => requireGeographicDirectory(data,ref,plan,new Set(["wrong-root"])), /root/);
  const cyclic = structuredClone(data); cyclic.nodes[0].children = [cyclic.nodes[0].key];
  assert.throws(() => requireGeographicDirectory(cyclic,ref,plan), /Cyclic/);
  const misplaced = structuredClone(data); misplaced.nodes.find(node => node.rasterSource).x++;
  assert.throws(() => requireGeographicDirectory(misplaced,ref,plan), /address/);
  for (const before of data.nodes.filter(page => page.rasterSource)) {
    const after = bindPreparedWmtsRaster(before,plan.imageSource);
    assert.equal(isPreparedProviderWmtsImage(after),true);
    const {url: a,rasterSource: b,provider: c,...geometryAfter} = after;
    const {url: d,rasterSource: e,...geometryBefore} = before;
    assert.deepEqual(geometryAfter,geometryBefore);
  }
});

test("the exact transparent provider sentinel is no-data; different one-pixel bytes are not silently accepted", async () => {
  const bytes = await readFile(new URL("../source/land-cover/empty.png",import.meta.url));
  const page = bindPreparedWmtsRaster(prepareWmtsTile({zoom:14,x:5535,y:9872},scene)[0],plan.imageSource);
  const transport = createApiImageTransport({fetchImage:async(_url,options)=>{assert.equal(options.credentials,"omit");return new Response(bytes,{headers:{"content-type":"image/png"}});}});
  const handle = transport.acquire(page); assert.equal(await handle.ready,null); assert.equal(handle.empty,true);
  assert.equal(transport.stats().residentEncodedBytes,67); handle.release(); assert.equal(transport.stats().residentImages,0); transport.destroy();
  const different = Buffer.from(bytes); different[20] ^= 1;
  const other = createApiImageTransport({fetchImage:async()=>new Response(different,{headers:{"content-type":"image/png"}})});
  const candidate = other.acquire(page); assert.match(await candidate.ready,/^blob:/); assert.equal(candidate.empty,false); candidate.release(); other.destroy();
  for (const mutation of [source=>{source.urlTemplate=source.urlTemplate.replace("https:","http:");},source=>{source.emptyImage.sha256="unverified";}]) {
    const value = structuredClone(plan.imageSource); mutation(value); assert.throws(()=>requireWmtsRasterSource(value));
  }
});
