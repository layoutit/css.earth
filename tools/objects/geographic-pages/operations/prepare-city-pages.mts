#!/usr/bin/env node
import { sha256 } from '../../../../src/platform/sha256.mts';
import { parseGeographicScene, parseCitySource } from '../source-records.mts';
import {commandContext} from './context.mts';
const context=commandContext();
const PREPARED_SCENE=await context.readPrepared('scene',parseGeographicScene);
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

import { readWorldCoverRegion } from "./worldcover-source.mts";
import { resampleMappedPageRgba } from "./resample-page.mts";
import { prepareCityIndex } from "./prepare-index.mts";
import { prepareCityParentPages, writeCityCore } from "./prepare-parent-pages.mts";
import { assembleCityCoveragePlan, readPublishedCoverage } from "./published-coverage.mts";
import { normalizeCityAssetOrigin, preparedCityAssetUrl } from "../../../../src/platform/prepared-map/city-asset-url.mts";
import { childAddresses, createCityGeographicSampler, createCityCoverageSampler, cityPageRasterDensity, pageKey, prepareCityPageGeometry,
  CITY_PAGE_LAST_LEVEL, CITY_POLAR_PAGE_LAST_LEVEL, CITY_PAGE_RASTER_SCALE } from "../page-geometry.mts";

const source = parseCitySource(JSON.parse(await readFile(context.sourcePath("city/manifest.json"), "utf8")));
const root = context.projectRoot;
const assetOrigin = normalizeCityAssetOrigin(source.delivery?.assetOrigin);
if (source.delivery?.bucket !== "cssearth-assets" ||
    !/^[a-f0-9]{32}$/u.test(source.delivery?.accountId ?? "") ||
    source.delivery?.keyPrefix !== context.assetPath.slice(1,-1)) {
  throw new Error("Earth city delivery target is incompatible.");
}
const output = resolve(root, `.local/${context.objectId}-city-publish`, source.dataset, source.delivery.keyPrefix);
const evidence = resolve(root, `output/${context.objectId}-city`, source.dataset);
const cache = resolve(root, `.local/${context.objectId}-city-source`);
const selected = context.args.find((arg) => arg.startsWith("--region="))?.slice(9);
const offline = context.args.includes("--offline");
const verifyOnly = context.args.includes("--verify-only");
if (selected && !verifyOnly) throw new Error("--region is verification-only; a published city dataset must contain every pinned region.");
if (!verifyOnly) {
  await mkdir(output, { recursive: true });
  await mkdir(evidence, { recursive: true });
  await mkdir(cache, { recursive: true });
}
const coreDirectory = verifyOnly ? null : await mkdtemp(resolve(cache,"pyramid-"));
const pages: import('../contracts.mts').CityRuntimePage[] = [];
const seeds = [];
const roots = [];
const provenance = [];

for (const region of source.regions.filter(({ id }) => !selected || id === selected)) {
  console.log(`Preparing real WorldCover pages: ${region.id}`);
    const preparedRoot=prepareCityPageGeometry(region.root,PREPARED_SCENE);
    const input=await readWorldCoverRegion(region,preparedRoot.sourceBounds,source.color,cache,{offline,verifyOnly,catalogDirectory:context.sourceUrl("city/")});
    if(verifyOnly){console.log(JSON.stringify({region:region.id,verified:input.provenance}));continue;}
    const {rgba,width,height}=input;
    if (!rgba || !coreDirectory) throw new Error("Verified city preparation needs a raster and temporary core directory");
    const raster = sharp(rgba, { raw: { width, height, channels: 4 } });
    await raster.clone().png().toFile(resolve(evidence, `${region.id}-source.png`));
    roots.push(pageKey(region.root));
    const queue = [region.root];
    for (const address of queue) {
      const page = prepareCityPageGeometry(address, PREPARED_SCENE);
      const geographicPoint=createCityGeographicSampler(page);
      const covered=page.bounds.projection==='polar'?createCityCoverageSampler(page):null;
      const sampled = resampleMappedPageRgba(rgba,width,height,(u,v)=>{
        const [longitude,latitude]=geographicPoint(u,1-v);
        return input.sourcePoint(longitude,latitude);
      },page.width,page.height,covered?(u,v)=>covered(u,1-v):null);
      const lastLevel=page.bounds.projection==='polar'?CITY_POLAR_PAGE_LAST_LEVEL:CITY_PAGE_LAST_LEVEL;
      const children = address.level < lastLevel ? childAddresses(address) : [];
      await publishPage({...page,children:children.map(pageKey)},sampled);
      if (page.key === pageKey(region.root)) {
        const corePath = resolve(coreDirectory,`${page.key}.png`);
        await writeCityCore(corePath,sampled,page);
        seeds.push({...page,corePath});
      }
      queue.push(...children);
    }
    provenance.push(input.provenance);
    console.log(JSON.stringify({ ...input.provenance,receivedBytes:input.receivedBytes }));
}
if (verifyOnly) process.exit(0);
if (!pages.length) throw new Error("No prepared source region selected.");
if (new Set(seeds.map(page=>page.key)).size !== seeds.length) {
  throw new Error("City source regions must have unique addresses.");
}
if (!coreDirectory) throw new Error("City preparation has no core directory");
await prepareCityParentPages(seeds,coreDirectory,PREPARED_SCENE,publishPage);
// Only the temporary directory created by this invocation, never source ranges.
await rm(coreDirectory,{recursive:true});
const index = prepareCityIndex(pages, source.dataset, PREPARED_SCENE, source.delivery);
for (const file of index.files) await writeFile(resolve(output, file.url.split("/").at(-1)!), file.bytes);
const plan = assembleCityCoveragePlan({ schema: "cssearth-earth-city-pages@1", dataset: source.dataset,
  qualification: source.qualification, credit: source.credit, sourcePage: source.sourcePage,
  canonicalDprIndependent: true, assetOrigin, roots: index.heads,
  initialLayer: { frameMatrix: pages[0].frameMatrix, textureMatrix: pages[0].textureMatrix },
  index: { maximumDirectories: 48, maximumBytes: 3 * 1024 * 1024,
    maximumDirectoryBytes: 131072, maximumConcurrentLoads: 3 },
  ...source.presentation,
  minimumZoom: 8,
  rasterScale: CITY_PAGE_RASTER_SCALE,
  decodedPageBytes: Math.max(...pages.map(({ width, height }) => width * height * 4)) }, await readPublishedCoverage(context.sourceUrl("city/published-coverage.json.gz")),{assetPath:context.assetPath});
await writeFile(context.sourcePath("city/provenance.json"),
  `${JSON.stringify(provenance, null, 2)}\n`);
await writeFile(resolve(evidence, "manifest.json"), `${JSON.stringify({ ...plan, pages, proofRoots: roots })}\n`);
await writeFile(resolve(evidence,"assets.json"),JSON.stringify([...pages,...index.files].map(file=>file.url).sort())+'\n');
await context.writePrepared('pages',plan);
// Only this dataset's content-addressed generated files. Preserve superseded
// outputs outside the published closure so failed/repeated preparation is safe.
const currentFiles = new Set([...pages, ...index.files].map(file => file.url.split("/").at(-1)));
const datasetPattern = source.dataset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ownedPattern = new RegExp(`^city-(?:index-)?${datasetPattern}-\\d+-\\d+-\\d+-[a-f0-9]{16}\\.(?:webp|json)$`);
const superseded = (await readdir(output)).filter(name => ownedPattern.test(name) && !currentFiles.has(name));
if (superseded.length) {
  const archive = await mkdtemp(resolve(evidence, "superseded-"));
  for (const name of superseded) await rename(resolve(output, name), resolve(archive, name));
  console.log(JSON.stringify({ archivedSupersededFiles: superseded.length, archive }));
}
console.log(JSON.stringify({ pages: pages.length,
  compressedBytes: pages.reduce((sum, { bytes }) => sum + bytes, 0), output }));

async function publishPage(page: import('../contracts.mts').PreparedCityPage,pixels: Uint8Array) {
  // Coarse faces must all fit at the same time. Their native raster density
  // rises with level; the fixed logical footprint and gutters do not change.
  // Every DPR receives the same canonical page at each prepared level.
  const density=cityPageRasterDensity(page.level);
  const width=page.width*density,height=page.height*density;
  // The accepted band raster addresses latitude bottom-to-top.
  const bytes = await sharp(pixels,{raw:{width:page.width,height:page.height,channels:4}})
    .resize(width,height).flip().webp({quality:88,effort:4}).toBuffer();
  const hash = sha256(bytes);
  const filename = `city-${source.dataset}-${page.key}-${hash.slice(0,16)}.webp`;
  await writeFile(resolve(output,filename),bytes);
  const {geographicMatrix,geographicProjection,...runtimePage}=page;
  pages.push({...runtimePage,width,height,maximumCssSpan:source.presentation.targetCssPixels*density,
    url:preparedCityAssetUrl(assetOrigin,source.delivery.keyPrefix,filename),sha256:hash,bytes:bytes.length});
}
