import { readFile } from "node:fs/promises";
import { pageKey } from "../tools/city/page-geometry.mjs";
import { prepareCityIndex } from "../tools/city/prepare-index.mjs";
import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";

// Test-only filesystem walk. Production must discover directories on demand;
// this fixture is not fetched into the browser's metadata or HTTP cache.
export async function readCityFixture(overrides = {}) {
  // Local raster tests cover the reproducible proof inputs. Published regions
  // have their own pinned receipts and remote closure checks; their full trees
  // must not become a prerequisite of this small offline fixture.
  const source = JSON.parse(await readFile(new URL("../source/city/manifest.json", import.meta.url)));
  const prepared = JSON.parse(await readFile(new URL(
    `../../../../output/earth-city/${source.dataset}/manifest.json`, import.meta.url)));
  const index = prepareCityIndex(prepared.pages, source.dataset, PREPARED_EARTH_SCENE, source.delivery);
  // This legacy raster fixture carries its own preparation-time configuration.
  // The application's newer WMTS hierarchy has a different topology and density.
  const { pages: preparedPages, proofRoots, ...preparedPlan } = prepared;
  const plan = { ...preparedPlan, ...overrides, roots: index.heads };
  const nodes = new Map(), directories = new Map();
  const queue = plan.roots.map(root => root.directory);
  for (const ref of queue) {
    if (directories.has(ref.url)) continue;
    const pathname = new URL(ref.url).pathname;
    const bytes = await readFile(new URL(
      `../../../../.local/earth-city-publish/${plan.dataset}${pathname}`,
      import.meta.url,
    ));
    const data = JSON.parse(bytes);
    directories.set(ref.url, { ref, bytes, data });
    for (const node of data.nodes) nodes.set(node.key, { ...node, directory: ref });
    queue.push(...data.external.map(node => node.directory));
  }
  const pages = [...nodes.values()].filter(node => node.url);
  return { plan, nodes, directories, pages, roots: source.regions.map(region => pageKey(region.root)) };
}
