import { isArray } from '../../src/platform/is-array.mts';
interface MarkerTile {id:string;size:number;color:readonly number[];}
// The original prepared flat-colour strip rasterizer, with body facts and
// output address supplied by the caller. It performs no filesystem writes.
import { createHash } from "node:crypto";
import sharp from "sharp";

export async function prepareSolarSystemMarkerStrip({ tiles, schema, provenance, url, tilePixels = 16 }:{tiles:readonly MarkerTile[];schema:string;provenance:string;url:string;tilePixels?:number}) {
  if (!isArray(tiles) || tiles.length === 0 || new Set(tiles.map(tile => tile.id)).size !== tiles.length ||
      tiles.some(tile => !/^[a-z][a-z0-9-]*$/u.test(tile.id ?? "") || !(tile.size > 0) ||
        !isArray(tile.color) || tile.color.length !== 3 || tile.color.some((value:number) => !Number.isInteger(value) || value < 0 || value > 255)) ||
      !Number.isSafeInteger(tilePixels) || tilePixels < 2 ||
      typeof schema !== "string" || typeof provenance !== "string" ||
      typeof url !== "string" || !url.startsWith("/scenes/")) {
    throw new TypeError("System marker strip needs explicit tiles, provenance, and an address.");
  }
  // Tiles are tilePixels CSS pixels wide, prepared at two texels per CSS pixel.
  const density = 2;
  const tile = tilePixels * density, width = tile * tiles.length;
  const raw = Buffer.alloc(width * tile * 4);
  tiles.forEach(({ color }, index) => {
    const centre = (tile - 1) / 2, radius = tile / 2 - 0.5 * density;
    for (let y = 0; y < tile; y += 1) for (let x = 0; x < tile; x += 1) {
      const distance = Math.hypot(x - centre, y - centre);
      const coverage = Math.max(0, Math.min(1, radius - distance + 0.5));
      const shade = 1 - 0.25 * Math.min(1, distance / radius) ** 2;
      const offset = ((y * width) + index * tile + x) * 4;
      raw[offset] = Math.round(color[0] * shade);
      raw[offset + 1] = Math.round(color[1] * shade);
      raw[offset + 2] = Math.round(color[2] * shade);
      raw[offset + 3] = Math.round(255 * coverage);
    }
  });
  const bytes = await sharp(raw, { raw: { width, height: tile, channels: 4 } }).webp({ lossless: true }).toBuffer();
  const asset = Object.freeze({ url, width, height: tile, tilePixels: tile,
    bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  return { plan: Object.freeze({ schema, model: "synthetic-flat-colour-discs", provenance, count: tiles.length,
    tiles: Object.freeze(Object.fromEntries(tiles.map(({ id, size }, index) =>
      [id, Object.freeze({ index, count: tiles.length, size })]))), asset }), assets: [{ url, bytes }] };
}
