import { createHash } from "node:crypto";
import { prepareCityPageGeometry, pageKey } from "../page-geometry.mts";
import { preparedCityAssetUrl } from "../../../../src/platform/prepared-map/city-asset-url.mts";

import type { GeographicScene, CityRuntimePage, CityIndexNode, AssetReference, CityIndexHead } from '../contracts.mts';
// Three tree levels per immutable directory. The application imports only the
// bounded level-zero heads, never a worldwide list of page URLs or matrices.
export function prepareCityIndex(pages: readonly CityRuntimePage[], dataset: string, scene: GeographicScene, delivery: { assetOrigin: string; keyPrefix: string }) {
  const nodes = new Map<string, CityIndexNode>(pages.map(page => [page.key, { ...page }]));
  for (const page of pages) {
    for (let level = page.level - 1; level >= 0; level--) {
      const factor = 2 ** (page.level - level);
      const address = { level, x: Math.floor(page.x / factor), y: Math.floor(page.y / factor) };
      const key = pageKey(address);
      if (!nodes.has(key)) {
        const { corners, normal } = prepareCityPageGeometry(address, scene);
        nodes.set(key, { key, ...address, corners, normal, children: [] });
      }
    }
  }
  for (const node of nodes.values()) node.children = [];
  for (const node of nodes.values()) {
    if (!node.level) continue;
    nodes.get(pageKey({ level: node.level - 1, x: Math.floor(node.x / 2), y: Math.floor(node.y / 2) }))!
      .children.push(node.key);
  }
  for (const page of pages) {
    const children = nodes.get(page.key)!.children;
    if ((children.length !== 0 && children.length !== 4 && page.childrenCoverImage !== true) ||
        children.length !== page.children.length || page.children.some(key => !children.includes(key))) {
      throw new Error(`City page ${page.key} has incomplete child coverage.`);
    }
  }
  for (const node of nodes.values()) node.children.sort();
  const directoryKey = (node: Pick<CityIndexNode, 'level' | 'x' | 'y'>) => {
    const level = Math.floor(node.level / 3) * 3;
    const factor = 2 ** (node.level - level);
    return pageKey({ level, x: Math.floor(node.x / factor), y: Math.floor(node.y / factor) });
  };
  const groups = new Map<string, CityIndexNode[]>();
  for (const node of nodes.values()) {
    const key = directoryKey(node);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(node);
  }
  const files = [];
  const references = new Map<string, AssetReference>();
  const descriptor = (node: CityIndexNode): CityIndexHead => ({ key: node.key, level: node.level, corners: node.corners,
    ...(node.coverageCorners ? {coverageCorners:node.coverageCorners} : {}),
    normal: node.normal, stub: true, directory: references.get(directoryKey(node))! });
  for (const [key, members] of [...groups].sort((a, b) => Number(b[0].split("-")[0]) - Number(a[0].split("-")[0]) || a[0].localeCompare(b[0]))) {
    members.sort((a, b) => a.key.localeCompare(b.key));
    const external = members.flatMap(node => node.children).map(child => nodes.get(child)!)
      .filter(child => directoryKey(child) !== key).map(descriptor);
    const bytes = Buffer.from(`${JSON.stringify({ schema: "cssearth-city-index@1", dataset, key,
      nodes: members, external })}\n`);
    if (bytes.length > 131072) throw new Error(`City index ${key} exceeds its prepared directory budget.`);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const url = preparedCityAssetUrl(delivery.assetOrigin, delivery.keyPrefix,
      `city-index-${dataset}-${key}-${sha256.slice(0, 16)}.json`);
    references.set(key, { url, bytes: bytes.length, sha256 });
    files.push({ url, bytes });
  }
  return { files, heads: [...nodes.values()].filter(node => node.level === 0)
    .sort((a, b) => a.key.localeCompare(b.key)).map(descriptor) };
}
