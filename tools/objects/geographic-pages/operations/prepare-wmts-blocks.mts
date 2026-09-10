import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { encodePreparedBlock, packWmtsRecords } from "../encode-prepared-block.mts";
import { PREPARED_BLOCK_ENCODING } from "../../../../src/platform/prepared-map/prepared-block-transport.mts";

import type { WmtsPage } from '../contracts.mts';
// Spatial chunks are independent of destinations. The same block addresses
// apply to an arbitrary view, a search result, or a flight across a face seam.
export function prepareWmtsBlocks(pages: readonly WmtsPage[], dataset: string, { tileSide = 8, assetPath }: { tileSide?: number; assetPath?: string } = {}) {
  if (typeof assetPath !== "string" || !/^\/scenes\/[a-z][a-z0-9-]*\/$/.test(assetPath)) throw new Error("Prepared WMTS blocks require an explicit object assetPath.");
  if (!Number.isSafeInteger(tileSide) || tileSide < 1 || tileSide > 32) throw new Error("Invalid prepared WMTS block side.");
  const groups = new Map<string, WmtsPage[]>();
  for (const page of pages) {
    const key = `wmts-block-${page.level}-${Math.floor(page.x / tileSide)}-${Math.floor(page.y / tileSide)}-${page.coarseKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(page);
  }
  const roots = [], files = [];
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  for (const [key, members] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    members.sort((a, b) => a.y - b.y || a.sourceCrop.v0 - b.sourceCrop.v0 || a.x - b.x);
    const points = members.flatMap(page => page.corners);
    const lo = [0, 1, 2].map(axis => Math.min(...points.map(point => point[axis])));
    const hi = [0, 1, 2].map(axis => Math.max(...points.map(point => point[axis])));
    const corners = Array.from({ length: 8 }, (_, i) => [0, 1, 2].map(axis => (i >> axis & 1 ? hi : lo)[axis]));
    const root = { key, level: 0, corners, normal: members[0].normal, children: members.map(page => page.key) };
    const decoded = encodePreparedBlock(packWmtsRecords(members), { envelope: { schema: "cssearth-city-index@1", dataset, root } });
    const bytes = gzipSync(decoded, { level: 9 }), sha256 = hash(bytes);
    const ref = { encoding: PREPARED_BLOCK_ENCODING, url: `${assetPath}wmts-index-${sha256.slice(0, 16)}.bin.gz`,
      bytes: bytes.length, sha256, decodedBytes: decoded.length, decodedSha256: hash(decoded) };
    roots.push({ key, level: 0, corners, normal: root.normal, stub: true, directory: ref });
    files.push({ ref, bytes });
  }
  return { roots, files };
}
