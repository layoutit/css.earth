import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {gzipSync,gunzipSync} from "node:zlib";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import sharp from "sharp";
import {preparePolarAtlas} from "./operations/polar-raster.mjs";
import {requireGeographicLensPackage,requireGeographicScope} from "../../../src/platform/geographic-lens-contract.mjs";
import {requireGeographicRoots} from "../../../src/platform/prepared-map/geographic-index-contract.mjs";

export async function prepareLandCover({sourceDirectory,publicDirectory,config,geometry,surfaceRasterPlan,raster,ownership:scope}) {
const ownership=requireGeographicScope(scope);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const root = pathToFileURL(resolve(sourceDirectory, "land-cover")+"/");
const manifestBytes = await readFile(new URL("manifest.json", root)), pin = JSON.parse(manifestBytes);
for (const input of pin.inputs) {
  const bytes = await readFile(new URL(input.path, root));
  if (bytes.length !== input.bytes || hash(bytes) !== input.sha256) throw new Error(`Land-cover source drifted: ${input.path}`);
}
const sourceBytes = await readFile(new URL(pin.overview.source, root));
const source = JSON.parse(gunzipSync(sourceBytes, { maxOutputLength: 4 * 1024 * 1024 }));
if (source.schema !== "cssearth-wmts-source-tiles@1" || source.zoom !== 3 || source.dataset !== pin.dataset || source.tiles.length !== 64 ||
    geometry.geometryVersion !== pin.geometry.release) throw new Error("Land-cover source or prepared geometry is incompatible.");
const mercator = Buffer.alloc(2048 * 2048 * 4), addresses = new Set();
for (const tile of source.tiles) {
  if (tile.zoom !== 3 || ![tile.x, tile.y].every(value => Number.isInteger(value) && value >= 0 && value < 8) || addresses.has(`${tile.x}/${tile.y}`)) throw new Error("Invalid overview source address.");
  addresses.add(`${tile.x}/${tile.y}`);
  const bytes = Buffer.from(tile.base64, "base64");
  if (bytes.length !== tile.bytes || hash(bytes) !== tile.sha256) throw new Error("Overview source tile drifted.");
  if (tile.sha256 === pin.service.emptyImage.sha256) continue;
  const image = await sharp(bytes, { limitInputPixels: 65536 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (image.info.width !== 256 || image.info.height !== 256) throw new Error("Invalid overview source dimensions.");
  for (let row = 0; row < 256; row++) image.data.copy(mercator, ((tile.y * 256 + row) * 2048 + tile.x * 256) * 4, row * 1024, (row + 1) * 1024);
}
// Only this bounded overview is sampled offline. At detail scale the browser
// requests original provider PNGs over the existing immutable geographic frames.
const data = Buffer.alloc(2048 * 1024 * 4), info = { width: 2048, height: 1024, channels: 4 };
for (let y = 0; y < 1024; y++) {
  const latitude = 90 - (y + .5) / 1024 * 180;
  if (Math.abs(latitude) > pin.service.extent[3]) continue;
  const row = Math.floor((1 - Math.asinh(Math.tan(latitude * Math.PI / 180)) / Math.PI) / 2 * 2048);
  mercator.copy(data, y * 2048 * 4, row * 2048 * 4, (row + 1) * 2048 * 4);
}
const palette = [...(await readFile(new URL(pin.legend.path, root), "utf8")).matchAll(/<item\s+([^>]+)\/>/gu)].map(match => {
  const attributes = Object.fromEntries([...match[1].matchAll(/([a-z]+)="([^"]*)"/gu)].map(m => [m[1], m[2]]));
  if (!/^#[a-f0-9]{6}$/iu.test(attributes.color) || attributes.alpha !== "255") throw new Error("Unexpected source category symbology.");
  return { label: attributes.label, color: `rgb(${[1,3,5].map(i => parseInt(attributes.color.slice(i, i + 2), 16)).join(",")})`, description: "", value: Number(attributes.value) };
});
if (palette.length !== 11) throw new Error("WorldCover requires its eleven sourced categories.");
const colors = new Set(palette.map(item => item.color));
for (let i = 0; i < data.length; i += 4) if (data[i + 3] && !colors.has(`rgb(${data[i]},${data[i+1]},${data[i+2]})`)) throw new Error("Overview includes an unclassified source color.");
await mkdir(publicDirectory,{recursive:true});
const assets = [], overview = [];
async function imageAsset(label, image) {
  const bytes = await sharp(image.data, { raw: image }).webp({ lossless: true, effort: 6 }).toBuffer();
  const sha256 = hash(bytes), url = `${config.publicBase}${label}-${sha256.slice(0,16)}.webp`;
  await writeFile(`${publicDirectory}/${url.split("/").at(-1)}`, bytes); assets.push(url);
  return { url, sha256, bytes: bytes.length, width: image.width, height: image.height };
}
const rasterPlan = surfaceRasterPlan;
for (let page = 0; page < rasterPlan.pages.length; page++) {
  const image = raster.bakeSurfaceRaster(data, info, rasterPlan.cells, 2, page, "nearest");
  overview.push({ slot: `surface:${page}`, image: await imageAsset(`earth-land-cover-overview-${page}`, image) });
}
const poles = preparePolarAtlas(data, { ...info, tileSize: 256, boundaryLatitudeRadians: 78.75 * Math.PI / 180,
  longitudeOffsetRadians: 0, sampling: "nearest", supersampling: 1 });
overview.push({ slot: "poles", image: await imageAsset("earth-land-cover-poles", { data: poles, width: 1024, height: 256, channels: 4 }) });
const thumbnail = await sharp(data, { raw: info }).resize(96, 48, { kernel: "nearest" }).extend({ top: 24, bottom: 24, left: 0, right: 0, background: "#171719" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const thumb = await imageAsset("earth-lens-land-cover", { data: thumbnail.data, ...thumbnail.info });
const rootData = { schema: "cssearth-geographic-roots@1", dataset: geometry.dataset, geometryVersion: geometry.geometryVersion, roots: geometry.roots };
const decoded = Buffer.from(JSON.stringify(rootData)), encoded = gzipSync(decoded, { level: 9 }), rootHash = hash(encoded);
const rootDirectory = { url: `${config.publicBase}geographic-roots-${rootHash.slice(0,16)}.pack`, encoding: "gzip", bytes: encoded.length,
  sha256: rootHash, decodedBytes: decoded.length, decodedSha256: hash(decoded) };
await writeFile(`${publicDirectory}/${rootDirectory.url.split("/").at(-1)}`, encoded); assets.push(rootDirectory.url);
const capacity = config.geographic.observation;
const pages = { ...capacity, dataset: pin.dataset, geometryDataset: geometry.dataset, geometryVersion: geometry.geometryVersion,
  geometryOrigin: geometry.geometryOrigin, topology: "wmts-quadtree@1", rootDirectory, levels: { minimum: 5, maximum: 14 }, rasterScale: 8,
  decodedPageBytes: 256 * 256 * 4, maximumDecodedBytes: 96 * 1024 * 1024, minimumZoom: 8, targetCssPixels: 384,
  imageSource: { schema: "cssearth-wmts-raster-source@1", identity: "versioned-provider", dataset: pin.dataset, version: `${pin.year}-${pin.algorithm}`,
    urlTemplate: pin.service.urlTemplate.replace("{TileMatrixSet}", pin.service.matrixSet), matrixSet: pin.service.matrixSet,
    tileSize: pin.service.tileSize, levels: pin.service.levels.map(value => String(value).padStart(2,"0")), extent: pin.service.extent,
    emptyImage: Object.fromEntries(Object.entries(pin.service.emptyImage).filter(([key]) => ["bytes","sha256","width","height"].includes(key))) } };
const content = { schema: "cssearth-geographic-lens@2", id: "worldcover-land-cover", label: "Land cover", scope: ownership, baseLensId: "normal",
  qualification: pin.qualification, coverage: { extent: pin.service.extent, qualification: "Source gaps retain the base map. The overview is sampled from level 3; available detail uses prepared levels 5–14." },
  source: { publisher: pin.publisher, year: pin.year, units: "Land-cover categories", url: pin.sourcePage, license: pin.license, licenseUrl: pin.licenseUrl, sha256: hash(manifestBytes) },
  legend: { kind: "categories", title: "Land cover", meta: `${pin.year} · ${pin.algorithm}`, items: palette.map(({value,...item}) => item) },
  overview: { schema: "cssearth-geographic-overview@1", images: overview, decodedBytes: overview.reduce((sum, item) => sum + item.image.width * item.image.height * 4, 0) }, pages };
const packageBytes = Buffer.from(JSON.stringify(content)), sha256 = hash(packageBytes), packageUrl = `${config.publicBase}geographic-lens-${content.id}-${sha256.slice(0,16)}.json`;
const descriptor = { id: content.id, label: content.label, thumbnailUrl: thumb.url, package: { url: packageUrl, bytes: packageBytes.length, sha256 } };
requireGeographicLensPackage(content, descriptor, config.namespace, capacity, config.namespace);
requireGeographicRoots(rootData, pages);
await writeFile(`${publicDirectory}/${packageUrl.split("/").at(-1)}`, packageBytes); assets.push(packageUrl);
const receipt = { dataset: pin.dataset, sourceSha256: hash(sourceBytes), roots: geometry.roots.length, rootDirectory, descriptor,
  reusedGeometryVersion: geometry.geometryVersion, copiedGeometryPacks: 0, overviewImages: overview.length, overviewDecodedBytes: content.overview.decodedBytes,
  overviewEncodedBytes: overview.reduce((sum, item) => sum + item.image.bytes, 0), assets, overview };
return {descriptor,assets,receipt};
}
