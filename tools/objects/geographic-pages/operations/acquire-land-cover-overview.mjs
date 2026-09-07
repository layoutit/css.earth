import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import sharp from "sharp";

const root = new URL("../source/land-cover/", import.meta.url);
const manifestUrl = new URL("manifest.json", root), manifest = JSON.parse(await readFile(manifestUrl));
const filename = "overview-tiles.json.gz", output = new URL(filename, root);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const pin = manifest.inputs.find(input => input.path === filename);
const acquire = process.argv.includes("--acquire");
if (!acquire) {
  if (!pin) throw new Error("The overview has no reviewed source pin. Acquire its bounded source tiles first.");
  const bytes = await readFile(output);
  if (bytes.length !== pin.bytes || hash(bytes) !== pin.sha256) throw new Error("Pinned overview source drifted.");
  const data = JSON.parse(gunzipSync(bytes, { maxOutputLength: 4 * 1024 * 1024 }));
  if (data.dataset !== manifest.dataset || data.tiles.length !== 64) throw new Error("Pinned overview source is incomplete.");
  for (const tile of data.tiles) {
    const image = Buffer.from(tile.base64, "base64");
    if (image.length !== tile.bytes || hash(image) !== tile.sha256) throw new Error("Pinned overview tile drifted.");
  }
  console.log(JSON.stringify({ verified: filename, tiles: data.tiles.length, bytes: bytes.length, sha256: pin.sha256 }));
} else {
  // A single small global overview, not source raster acquisition or a geometry
  // rebuild. Requests are sequential, versioned and independently byte-bounded.
  const tiles = [], responses = []; let total = 0;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const url = manifest.service.urlTemplate.replace("{TileMatrixSet}", manifest.service.matrixSet)
      .replace("{TileMatrix}", "03").replace("{TileCol}", String(x)).replace("{TileRow}", String(y));
    const response = await fetch(url, { credentials: "omit", signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png")) throw new Error(`Overview tile ${x}/${y}: HTTP ${response.status}`);
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length; total += chunk.length;
      if (size > 1024 * 1024 || total > 2 * 1024 * 1024) throw new Error("Overview source exceeded its bounded acquisition.");
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks), info = await sharp(bytes, { limitInputPixels: 65536 }).metadata();
    const empty = hash(bytes) === manifest.service.emptyImage.sha256;
    if (!empty && (info.width !== 256 || info.height !== 256)) throw new Error("Unexpected overview tile dimensions.");
    tiles.push({ zoom: 3, x, y, url, bytes: bytes.length, sha256: hash(bytes), base64: bytes.toString("base64") });
    responses.push({ x, y, status: response.status, cacheControl: response.headers.get("cache-control"), etag: response.headers.get("etag") });
    if (tiles.length % 8 === 0) console.log(JSON.stringify({ tiles: tiles.length, totalBytes: total }));
  }
  const decoded = Buffer.from(JSON.stringify({ schema: "cssearth-wmts-source-tiles@1", dataset: manifest.dataset, zoom: 3, tiles }));
  const encoded = gzipSync(decoded, { level: 9 });
  if (pin && (pin.bytes !== encoded.length || pin.sha256 !== hash(encoded))) throw new Error("Provider overview bytes changed. The existing immutable pin was preserved; review a source update separately.");
  await writeFile(output, encoded);
  if (!pin) {
    manifest.overview = { zoom: 3, source: filename, qualification: "Bounded whole-world overview from 64 provider tiles, nearest-category sampling; finer source tiles remain direct provider requests." };
    manifest.inputs.push({ path: filename, origin: manifest.service.urlTemplate, bytes: encoded.length, sha256: hash(encoded), decodedBytes: decoded.length, decodedSha256: hash(decoded) });
    await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + "\n");
  }
  await writeFile(new URL("overview-acquisition.json", root), JSON.stringify({ retrievedAt: new Date().toISOString(), tiles: tiles.length, receivedBytes: total, sourceSha256: hash(encoded), responses }, null, 2) + "\n");
  console.log(JSON.stringify({ path: output.pathname, tiles: tiles.length, bytes: encoded.length, sha256: hash(encoded) }));
}
