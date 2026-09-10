#!/usr/bin/env node
import type { CityRuntimePage, CorePage, PreparedCityPage } from '../contracts.mts';
import { parseCitySource, parseGeographicScene } from '../source-records.mts';
import {commandContext} from './context.mts';
const context=commandContext();
const PREPARED_SCENE=await context.readPrepared('scene',parseGeographicScene);
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

import { normalizeCityAssetOrigin, preparedCityAssetUrl } from "../../../../src/platform/prepared-map/city-asset-url.mts";
import { cityCoverageRoots, planCityCoverage } from "./plan-coverage.mts";
import { expectedGlobalCityFace } from "./global-face-receipts.mts";
import { prepareCityIndex } from "./prepare-index.mts";
import { prepareCityParentPages, writeCityCore } from "./prepare-parent-pages.mts";
import { publishPreparedCityAssets } from "./r2-publish.mts";
import { resampleMappedPageRgba } from "./resample-page.mts";
import { readWorldCoverCatalog } from "../worldcover-catalog.mts";
import { readWorldCoverRegion } from "./worldcover-source.mts";
import { childAddresses, createCityCoverageSampler, createCityGeographicSampler,
  cityPageRasterDensity, pageKey, prepareCityPageGeometry } from "../page-geometry.mts";

const root = context.projectRoot;
const source = parseCitySource(JSON.parse(await readFile(context.sourcePath("city/manifest.json"), "utf8")));
const cors: unknown = JSON.parse(await readFile(context.sourcePath("city/r2-cors.json"), "utf8"));
const requestedFace = context.args.find((argument) => argument.startsWith("--face="))?.slice(7);
const faceMatch = /^(?:0-)?(\d+)-(\d+)$/u.exec(requestedFace ?? "");
if (!faceMatch) throw new Error("Expected one accepted coarse face as --face=x-y or --face=0-x-y.");
const face = cityCoverageRoots().find(({ x, y }) => x === Number(faceMatch[1]) && y === Number(faceMatch[2]));
if (!face) throw new Error(`Unknown accepted coarse face: ${requestedFace}`);
normalizeCityAssetOrigin(source.delivery?.assetOrigin);
const { pin, entries } = await readWorldCoverCatalog({directory:context.sourceUrl("city/")});
const jobs = [...planCityCoverage(PREPARED_SCENE, entries, [face])];
if (jobs.some(({ blocked }) => blocked)) throw new Error(`Face ${requestedFace} contains a blocked source window.`);
const plan = { schema: "cssearth-earth-city-global-face-plan@1", dataset: source.dataset,
  catalogSha256: pin.expectedSha256, ...expectedGlobalCityFace(face, jobs) };
if (context.args.includes("--plan-only")) {
  console.log(JSON.stringify(plan));
  process.exit(0);
}

const working = await mkdtemp(resolve(root, `.local/${context.objectId}-city-global-face-${requestedFace}-`));
const staging = resolve(working, source.delivery.keyPrefix);
const cores = resolve(working, "cores");
const outputDirectory = resolve(root, `output/${context.objectId}-city/global-faces`);
await Promise.all([mkdir(staging, { recursive: true }), mkdir(cores, { recursive: true }),
  mkdir(outputDirectory, { recursive: true })]);
const pages: CityRuntimePage[] = [], seeds: CorePage[] = [], provenance: ReturnType<typeof compactProvenance>[] = [];
let completed = false;
try {
  for (const [jobIndex, job] of jobs.entries()) {
    console.log(JSON.stringify({ face: pageKey(face), job: job.id, current: jobIndex + 1, total: jobs.length }));
    const cache = resolve(working, "source", job.id);
    try {
      const input = await readWorldCoverRegion({ id: `global-${job.id}`, sources: job.sources,
        unavailableTiles: job.unavailableTiles }, job.bounds, source.color, cache,{catalogDirectory:context.sourceUrl("city/")});
      if (!input.rgba) throw new Error(`Missing source pixels for ${job.id}`);
      const queue = [job.root];
      for (const address of queue) {
        const page = prepareCityPageGeometry(address, PREPARED_SCENE);
        const geographicPoint = createCityGeographicSampler(page);
        const covered = page.bounds.projection === "polar" ? createCityCoverageSampler(page) : null;
        const sampled = resampleMappedPageRgba(input.rgba, input.width, input.height, (u, v) => {
          const [longitude, latitude] = geographicPoint(u, 1 - v);
          return input.sourcePoint(longitude, latitude);
        }, page.width, page.height, covered ? (u, v) => covered(u, 1 - v) : null);
        const children = address.level < job.lastLevel ? childAddresses(address) : [];
        await publishPage({ ...page, children: children.map(pageKey) }, sampled);
        if (page.key === job.id) {
          const corePath = resolve(cores, `${page.key}.png`);
          await writeCityCore(corePath, sampled, page);
          seeds.push({ ...page, corePath });
        }
        queue.push(...children);
      }
      provenance.push(compactProvenance(input.provenance));
    } finally {
      await rm(cache, { recursive: true, force: true });
    }
  }

  if (seeds.length) await prepareCityParentPages(seeds, cores, PREPARED_SCENE, publishPage);
  const index = pages.length ? prepareCityIndex(pages, source.dataset, PREPARED_SCENE,
    source.delivery) : { files: [], heads: [] };
  for (const file of index.files) {
    await writeFile(resolve(staging, new URL(file.url).pathname.split("/").at(-1)!), file.bytes);
  }
  const assetUrls = [...pages, ...index.files].map(({ url }) => url).sort();
  const publish = assetUrls.length ? await publishPreparedCityAssets({ source, cors, assetUrls, assetPath:context.assetPath,
    staging, root, batchSize: 1000, concurrency: 8 }) : null;
  const receipt = { ...plan, schema: "cssearth-earth-city-global-face@1",
    qualification: "One verified global-build face; not global runtime coverage.",
    heads: index.heads, pages: pages.length, indexes: index.files.length,
    compressedBytes: pages.reduce((sum, page) => sum + page.bytes, 0),
    provenance, publish };
  await writeFile(resolve(outputDirectory, `${pageKey(face)}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  completed = true;
  console.log(JSON.stringify({ ...receipt, provenance: `${provenance.length} bounded source jobs` }));
} finally {
  if (completed) await rm(working, { recursive: true, force: true });
  else console.error(`Preserved failed face working data: ${working}`);
}

async function publishPage(page: PreparedCityPage, pixels: Uint8Array) {
  const density = cityPageRasterDensity(page.level);
  const width = page.width * density, height = page.height * density;
  const bytes = await sharp(pixels, { raw: { width: page.width, height: page.height, channels: 4 } })
    .resize(width, height).flip().webp({ quality: 88, effort: 4 }).toBuffer();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const filename = `city-${source.dataset}-${page.key}-${sha256.slice(0, 16)}.webp`;
  await writeFile(resolve(staging, filename), bytes);
  const { geographicMatrix, geographicProjection, ...runtimePage } = page;
  pages.push({ ...runtimePage, width, height,
    maximumCssSpan: source.presentation.targetCssPixels * density,
    url: preparedCityAssetUrl(source.delivery.assetOrigin, source.delivery.keyPrefix, filename),
    sha256, bytes: bytes.length });
}

function compactProvenance(value: Awaited<ReturnType<typeof readWorldCoverRegion>>["provenance"]) {
  const sources = ("sources" in value ? value.sources : [value]).map(({ tile, url, etag, sourceBytes, extractedSha256,
    width, height, nodataPixels, window }) => ({ tile, url, etag, sourceBytes, extractedSha256,
    width, height, nodataPixels, window }));
  return { id: "id" in value ? value.id : value.tile, width: value.width ?? sources[0].width,
    height: value.height ?? sources[0].height,
    nodataPixels: value.nodataPixels ?? sources[0].nodataPixels,
    ...(value.absentSource ? { absentSource: value.absentSource } : {}), sources };
}
