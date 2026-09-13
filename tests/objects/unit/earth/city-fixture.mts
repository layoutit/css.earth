import { readFile } from "node:fs/promises";
import { pageKey } from "../../../../tools/objects/geographic-pages/page-geometry.mts";
import { prepareCityIndex } from "../../../../tools/objects/geographic-pages/operations/prepare-index.mts";
import { PREPARED_EARTH_SCENE } from "./prepared-fixture.mts";
import { parseCitySource } from "../../../../tools/objects/geographic-pages/source-records.mts";
import { parsePreparedPagePlan } from "../../../../src/renderers/css/dist/testing.js";
import { parseCityFixtureManifest, parseCityFixtureDirectory, parseCityFixtureReference, parseCityRaster } from "./city-fixture-schema.mts";

// Test-only filesystem walk. Production must discover directories on demand;
// this fixture is not fetched into the browser's metadata or HTTP cache.
export async function readCityFixture(overrides: Record<string, unknown> = {}) {
  // Local raster tests cover the reproducible proof inputs. Published regions
  // have their own pinned receipts and remote closure checks; their full trees
  // must not become a prerequisite of this small offline fixture.
  const source = parseCitySource(JSON.parse((await readFile(new URL("../../../../src/objects/earth/source/city/manifest.json", import.meta.url))).toString('utf8')));
  const prepared = parseCityFixtureManifest(JSON.parse((await readFile(new URL(
    `../../../../output/earth-city/${source.dataset}/manifest.json`, import.meta.url))).toString('utf8')));
  const index = prepareCityIndex(prepared.pages, source.dataset, PREPARED_EARTH_SCENE, source.delivery);
  // This legacy raster fixture carries its own preparation-time configuration.
  // The application's newer WMTS hierarchy has a different topology and density.
  const { pages: preparedPages, proofRoots, ...preparedPlan } = prepared;
  const checkedPlan = parsePreparedPagePlan({ ...preparedPlan, schema: "cssearth-prepared-map-pages@1", assetPath: "/scenes/earth/", ...overrides, roots: index.heads });
  const plan = {...checkedPlan, roots: index.heads};
  type Reference = ReturnType<typeof parseCityFixtureReference>;
  type Directory = ReturnType<typeof parseCityFixtureDirectory>;
  const nodes = new Map<string, Directory['nodes'][number] & {directory: Reference}>();
  const directories = new Map<string, {ref:Reference; bytes:Buffer; data:Directory}>();
  const queue = plan.roots.map(root => parseCityFixtureReference(root.directory));
  for (const ref of queue) {
    if (directories.has(ref.url)) continue;
    const pathname = new URL(ref.url).pathname;
    const bytes = await readFile(new URL(
      `../../../../.local/earth-city-publish/${plan.dataset}${pathname}`,
      import.meta.url,
    ));
    const data = parseCityFixtureDirectory(JSON.parse(bytes.toString('utf8')));
    directories.set(ref.url, { ref, bytes, data });
    for (const node of data.nodes) nodes.set(node.key, { ...node, directory: ref });
    queue.push(...data.external.map(node => node.directory));
  }
  const pages = [...nodes.values()].filter(node => node.url).map(parseCityRaster);
  return { plan, nodes, directories, pages, roots: source.regions.map(region => pageKey(region.root)) };
}
