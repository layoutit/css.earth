import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const sourceRows = text => text.split(/\r?\n/u).filter(line => line && !line.startsWith("#")).map(line => line.split("\t"));

export async function readPlaceSources() {
  const root = new URL("../source/places/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", root)));
  const sources = new Map();
  const matches = (bytes, length, digest) => bytes.length === length && createHash("sha256").update(bytes).digest("hex") === digest;
  for (const entry of manifest.inputs) {
    let bytes = await readFile(new URL(entry.path, root));
    if (!matches(bytes, entry.bytes, entry.sha256)) throw new Error(`Place source snapshot drifted: ${entry.path}`);
    if (entry.encoding === "gzip") bytes = gunzipSync(bytes, { maxOutputLength: entry.decodedBytes });
    if (entry.member || entry.path === "cities15000.zip") bytes = execFileSync("unzip",
      ["-p", fileURLToPath(new URL(entry.path, root)), entry.member ?? "cities15000.txt"],
      { maxBuffer: entry.decodedBytes ?? 40 * 1024 * 1024 });
    if (entry.decodedSha256 && !matches(bytes, entry.decodedBytes, entry.decodedSha256)) throw new Error(`Decoded place source drifted: ${entry.path}`);
    sources.set(entry.path, bytes.toString("utf8"));
  }
  return { manifest, sources };
}
