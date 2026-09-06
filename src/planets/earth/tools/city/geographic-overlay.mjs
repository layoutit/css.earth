import { prepareCityPageGeometry } from "./page-geometry.mjs";
import { prepareGeographicTextureQuad } from "./wms-page-geometry.mjs";

const identity = "1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1";
export function prepareOverlayCapacity() {
  return { schema: "cssearth-prepared-map-pages@1", dataset: null,
    assetOrigin: "https://earth-assets.lowpoly.cc", assetPath: "/scenes/earth/",
    roots: [], initialLayer: { frameMatrix: identity, textureMatrix: identity },
    pageTemplate: "clipped-projective", rasterScale: 32, rasterScales: [8, 32], poolSize: 32,
    minimumZoom: 16, maximumDecodedBytes: 128 * 1024 * 1024, decodedPageBytes: 4 * 1024 * 1024,
    targetCssPixels: 2048, maximumConcurrentLoads: 3,
    index: { maximumDirectories: 32, maximumBytes: 8 * 1024 * 1024, maximumDirectoryBytes: 2 * 1024 * 1024, maximumConcurrentLoads: 3 } };
}

// Split a north-up source tile at accepted face boundaries during preparation.
// Each piece addresses the same prepared pixels; runtime only applies matrices.
export function prepareGeographicOverlayTile(scene, bounds, tile) {
  if (bounds.south < -78.75 || bounds.north > 78.75 || bounds.west >= bounds.east || bounds.east - bounds.west > 360) {
    throw new Error("This geographic raster preparer requires a non-polar extent of at most one world.");
  }
  const pages = [], step = 11.25;
  for (let row = Math.floor((bounds.south + 90) / step); row < Math.ceil((bounds.north + 90) / step); row++) {
    for (let col = Math.floor(bounds.west / step); col < Math.ceil(bounds.east / step); col++) {
      const b = { west: Math.max(bounds.west, col * step), east: Math.min(bounds.east, (col + 1) * step),
        south: Math.max(bounds.south, row * step - 90), north: Math.min(bounds.north, (row + 1) * step - 90) };
      const x = (col % 32 + 32) % 32, shift = x * step - col * step;
      const coarse = prepareCityPageGeometry({ level: 0, x, y: row }, scene);
      const mapping = prepareGeographicTextureQuad(coarse, { ...b, west: b.west + shift, east: b.east + shift }, 32);
      const m = mapping.frameMatrix.split(",").map(Number);
      for (let i = 0; i < 3; i++) m[12 + i] += coarse.normal[i] * .003;
      const width = 1024 * (bounds.east - bounds.west) / (b.east - b.west);
      const height = 1024 * (bounds.north - bounds.south) / (b.north - b.south);
      pages.push({ ...tile, key: `${tile.key}-${x}-${row}`, level: 0, x, y: row, normal: coarse.normal,
        ...mapping, frameMatrix: m.join(","), imageMatrix: identity,
        textureBackgroundSize: `${width}px ${height}px`,
        textureBackgroundPosition: `${-(b.west - bounds.west) / (bounds.east - bounds.west) * width}px ${-(bounds.north - b.north) / (bounds.north - bounds.south) * height}px`,
        sourceBounds: b, children: [], rasterSource: "prepared-raster@1" });
    }
  }
  return pages;
}
