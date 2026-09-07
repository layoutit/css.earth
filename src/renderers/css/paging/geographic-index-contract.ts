import type { PreparedPagePlan, PreparedPage, PreparedReference, PreparedDirectory } from './types.js';
import { isPreparedBlockReference, preparedReferenceKey } from "./prepared-block-transport.js";

export const GEOGRAPHIC_INDEX_LIMITS = Object.freeze({ rootBytes: 2 * 1024 * 1024, roots: 1024, depth: 20 });
const hash = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value ?? "");
const finiteVector = (value: unknown) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const corners = (value: unknown) => Array.isArray(value) && [4, 8].includes(value.length) && value.every(finiteVector);

export function requireGeographicRootReference(ref: PreparedReference, assetPath: string) {
  if (ref?.encoding !== "gzip" || !hash(ref.sha256) || !hash(ref.decodedSha256) ||
      ref.url !== `${assetPath}geographic-roots-${ref.sha256.slice(0, 16)}.pack` ||
      ![ref.bytes, ref.decodedBytes].every(value => Number.isSafeInteger(value) && (value ?? 0) > 0 && (value ?? Infinity) <= GEOGRAPHIC_INDEX_LIMITS.rootBytes)) {
    throw new Error("Invalid geographic root directory reference.");
  }
  return ref;
}

function address(node: PreparedPage | undefined, plan: PreparedPagePlan) {
  const match = /^wmts-tile-(\d+)-(\d+)-(\d+)$/u.exec(node?.key ?? "");
  if (!node || !plan.levels || !match || !corners(node.corners) || !finiteVector(node.normal)) throw new Error("Invalid prepared geographic tile bounds.");
  const [level, x, y] = match.slice(1).map(Number);
  if (level !== node.level || level < plan.levels!.minimum || level > plan.levels!.maximum ||
      ![x, y].every(n => Number.isSafeInteger(n) && n >= 0 && n < 2 ** level) ||
      node.normalSlack !== undefined && (!Number.isFinite(node.normalSlack) || node.normalSlack < 0 || node.normalSlack > 2) ||
      !Number.isFinite(node.maximumCssSpan) || node.maximumCssSpan < 1) throw new Error("Invalid prepared geographic tile level.");
  if (node.coverageParts !== undefined && (!Array.isArray(node.coverageParts) || !node.coverageParts.length || node.coverageParts.length > 64 ||
      node.coverageParts.some(part => !finiteVector(part.normal) || !corners(part.corners)))) throw new Error("Invalid prepared geographic coverage parts.");
  return { level, x, y };
}

export function requireGeographicDirectoryReference(ref: PreparedReference, plan: PreparedPagePlan) {
  if (!isPreparedBlockReference(ref, plan.assetPath) || ref.offset === undefined ||
      !ref.url.startsWith(`${plan.assetPath}wmts-${plan.geometryVersion}/`) ||
      ref.bytes > plan.index.maximumDirectoryBytes || (ref.decodedBytes ?? Infinity) > plan.index.maximumDirectoryBytes) {
    throw new Error("Invalid or stale geographic geometry directory.");
  }
  return ref;
}

function stub(node: PreparedPage, plan: PreparedPagePlan) {
  const result = address(node, plan);
  if (node.stub !== true || node.pages !== undefined || node.children !== undefined) throw new Error("Invalid prepared geographic directory stub.");
  requireGeographicDirectoryReference(node.directory!, plan);
  return result;
}

export function requireGeographicRoots(value: unknown, plan: PreparedPagePlan) {
  const data = value as {schema?: string; geometryVersion?: string; dataset?: string; roots?: PreparedPage[]} | null;
  if (data?.schema !== "cssearth-geographic-roots@1" || data.geometryVersion !== plan.geometryVersion ||
      data.dataset !== plan.geometryDataset || !Array.isArray(data.roots) || !data.roots.length ||
      data.roots.length > GEOGRAPHIC_INDEX_LIMITS.roots || new Set(data.roots.map(root => root.key)).size !== data.roots.length) {
    throw new Error("Incompatible geographic root directory.");
  }
  for (const root of data.roots) if (stub(root, plan).level !== plan.levels!.minimum) throw new Error("Unexpected geographic root level.");
  return data.roots;
}

export function requireGeographicDirectory(data: PreparedDirectory, ref: PreparedReference, plan: PreparedPagePlan, expectedKeys?: ReadonlySet<string> | null) {
  if (data.dataset !== plan.geometryDataset) throw new Error("Incompatible geographic geometry dataset.");
  const tiles = data.nodes.filter(node => node.key.startsWith("wmts-tile-"));
  const external = data.external;
  if (!tiles.length || tiles.length > 85 || external.length > 64) throw new Error("Geographic subtree exceeds its node capacity.");
  const byKey = new Map([...tiles, ...external].map(node => [node.key, node]));
  const images = new Map(data.nodes.filter(node => !node.key.startsWith("wmts-tile-")).map(node => [node.key, node]));
  if (byKey.size !== tiles.length + external.length) throw new Error("Duplicate geographic subtree identity.");
  const incoming = new Set();
  for (const node of tiles) {
    const parent = address(node, plan);
    if (!Array.isArray(node.children) || node.children.length > 4 || !Array.isArray(node.pages)) throw new Error("Invalid geographic subtree children.");
    for (const key of node.pages) {
      const image = images.get(key);
      if (!image || image.level !== parent.level || image.x !== parent.x || image.y !== parent.y) throw new Error("Geographic source image and tile address disagree.");
    }
    for (const key of node.children) {
      const child = byKey.get(key), next = address(child, plan);
      if (next.level !== parent.level + 1 || Math.floor(next.x / 2) !== parent.x || Math.floor(next.y / 2) !== parent.y || incoming.has(key)) {
        throw new Error("Cyclic or incompatible geographic subtree.");
      }
      incoming.add(key);
    }
  }
  for (const node of external) {
    stub(node, plan);
    if (!incoming.has(node.key) || preparedReferenceKey(node.directory!) === preparedReferenceKey(ref)) throw new Error("Cyclic geographic directory reference.");
  }
  const roots = tiles.filter(node => !incoming.has(node.key));
  if (roots.length !== 1 || expectedKeys && !expectedKeys.has(roots[0].key)) throw new Error("Unexpected geographic directory root.");
  // Strictly increasing bounded tile levels prove both local and cross-file
  // traversal depth; a directory can never point back to its own ancestor.
  if (plan.levels!.maximum - plan.levels!.minimum + 1 > GEOGRAPHIC_INDEX_LIMITS.depth) throw new Error("Geographic index exceeds its depth capacity.");
  return data;
}
