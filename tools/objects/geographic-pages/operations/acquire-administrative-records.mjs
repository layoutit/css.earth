#!/usr/bin/env node
// Stream the publisher's ZIP through its CRC-checking first-member decoder.
// Keep only the exact IDs referenced by our pinned country/ADM1 code tables.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { gzipSync } from "node:zlib";
import { commandContext } from './context.mjs';
const context=commandContext();
if(context.args.some(arg=>arg!=='--reacquire'))throw new Error('Use --object=<id> [--reacquire].');
const stagingRoot=context.projectPath(`.local/${context.objectId}-geographic-acquisition`);

const source = context.sourceUrl('places/');
const manifest = JSON.parse(await readFile(new URL("manifest.json", source)));
const path = "administrative-records.tsv.gz";
const pinned = manifest.inputs.find(entry => entry.path === path);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const codes = [], selected = new Set();
for (const [name, column] of [["countryInfo.txt", 16], ["admin1CodesASCII.txt", 3]]) {
  const bytes = await readFile(new URL(name, source));
  const entry = manifest.inputs.find(entry => entry.path === name);
  if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) throw new Error(`Pinned administrative codes drifted: ${name}`);
  codes.push({ path: name, sha256: entry.sha256 });
  for (const line of bytes.toString("utf8").split(/\r?\n/u)) if (line && !line.startsWith("#")) {
    const id = line.split("\t")[column];
    if (!/^[1-9]\d*$/u.test(id)) throw new Error("Administrative table has an invalid GeoNames ID.");
    selected.add(id);
  }
}
if (pinned && !context.args.includes("--reacquire")) {
  let bytes;
  try { bytes = await readFile(new URL(path, source)); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (bytes) {
    if (bytes.length !== pinned.bytes || hash(bytes) !== pinned.sha256) throw new Error("Pinned administrative records drifted.");
    console.log("Verified pinned administrative records; no archive download.");
    process.exit(0);
  }
}
const origin = "https://download.geonames.org/export/dump/allCountries.zip";
const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 15 * 60 * 1000);
const decoder = spawn("funzip", [], { stdio: ["pipe", "pipe", "pipe"] });
const done = new Promise((resolve, reject) => { decoder.once("error", reject); decoder.once("close", code => code === 0 ? resolve() : reject(new Error(`GeoNames archive decoder exited ${code}`))); });
// Keep exit rejection observed while transport and decoded output are active.
done.catch(() => {});
let stderr = ""; decoder.stderr.on("data", bytes => { stderr = (stderr + bytes.toString()).slice(-4096); });
let inputFailure = null; decoder.stdin.on("error", error => { inputFailure = error; });
const compressedHash = createHash("sha256"), decodedHash = createHash("sha256");
let compressedBytes = 0, decodedBytes = 0, recordBytes = 0, lines = 0;
const retained = new Map(), utf8 = new StringDecoder("utf8");
let pending = "";
const consume = (async () => {
  for await (const bytes of decoder.stdout) {
    decodedBytes += bytes.length;
    if (decodedBytes > 6 * 1024 ** 3) throw new Error("GeoNames decoded stream exceeds admission bound.");
    decodedHash.update(bytes); pending += utf8.write(bytes);
    let start = 0, end;
    while ((end = pending.indexOf("\n", start)) !== -1) {
      const line = pending.slice(start, end).replace(/\r$/u, ""); start = end + 1; lines++;
      const id = line.slice(0, line.indexOf("\t"));
      if (!selected.has(id)) continue;
      if (retained.has(id) || line.split("\t").length !== 19) throw new Error(`Invalid administrative record: ${id}`);
      recordBytes += Buffer.byteLength(line) + 1;
      if (recordBytes > 8 * 1024 * 1024) throw new Error("Administrative subset exceeds admission bound.");
      retained.set(id, line);
    }
    pending = pending.slice(start);
    if (pending.length > 1024 * 1024) throw new Error("GeoNames source line exceeds admission bound.");
  }
  pending += utf8.end();
  if (pending) throw new Error("GeoNames source ends with an incomplete record.");
})();
consume.catch(() => { abort.abort(); decoder.kill(); });
try {
  const response = await fetch(origin, { headers: { "accept-encoding": "identity" }, signal: abort.signal });
  if (response.status !== 200) throw new Error(`GeoNames archive request failed: ${response.status}`);
  const expectedBytes = Number(response.headers.get("content-length"));
  if (!expectedBytes || expectedBytes > 512 * 1024 * 1024) throw new Error("GeoNames archive exceeds admission bound.");
  let header = Buffer.alloc(0), verifiedHeader = false;
  for await (const part of response.body) {
    const bytes = Buffer.from(part); compressedBytes += bytes.length;
    if (compressedBytes > 512 * 1024 * 1024) throw new Error("GeoNames archive exceeds admission bound.");
    compressedHash.update(bytes);
    if (!verifiedHeader) {
      header = Buffer.concat([header, bytes.subarray(0, 4096 - header.length)]);
      if (header.length >= 46) {
        if (header.readUInt32LE(0) !== 0x04034b50 || header.readUInt16LE(8) !== 8 ||
            header.readUInt16LE(6) & 1 || header.readUInt16LE(26) !== 16 || header.toString("utf8", 30, 46) !== "allCountries.txt") throw new Error("GeoNames ZIP member identity changed.");
        verifiedHeader = true;
      }
    }
    if (!inputFailure) await new Promise((resolve, reject) => decoder.stdin.write(bytes, error => {
      if (error?.code === "EPIPE") { inputFailure = error; resolve(); }
      else if (error) reject(error); else resolve();
    }));
  }
  decoder.stdin.end();
  await Promise.all([consume, done]);
  if (!verifiedHeader || compressedBytes !== expectedBytes || stderr.trim()) throw new Error(`GeoNames archive is incomplete or ambiguous: ${stderr}`);
  const upstream = { origin, bytes: compressedBytes, sha256: compressedHash.digest("hex"), member: "allCountries.txt",
    decodedBytes, decodedSha256: decodedHash.digest("hex"), lastModified: response.headers.get("last-modified") };
  if (retained.size !== selected.size) throw new Error(`Administrative source is missing required IDs: ${[...selected].filter(id => !retained.has(id)).join(", ")}`);
  const raw = Buffer.from([...retained].sort(([a], [b]) => Number(a) - Number(b)).map(([, line]) => line + "\n").join(""));
  const bytes = gzipSync(raw, { level: 9 });
  if (pinned && (pinned.sha256 !== hash(bytes) || pinned.upstream.sha256 !== upstream.sha256)) throw new Error("Upstream administrative snapshot changed; pin a reviewed source update before replacement.");
  const receipt = { path, origin, encoding: "gzip", bytes: bytes.length, sha256: hash(bytes), decodedBytes: raw.length,
    decodedSha256: hash(raw), upstream, filter: { inputs: codes, requestedIds: selected.size, retainedIds: retained.size,
      missingIds: [...selected].filter(id => !retained.has(id)).sort(), scannedRecords: lines }, retrievedAt: new Date().toISOString() };
  await mkdir(stagingRoot, { recursive: true });
  const temporary = new URL(path + ".partial", source);
  await writeFile(temporary, bytes); await rename(temporary, new URL(path, source));
  await writeFile(`${stagingRoot}/administrative-acquisition.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  clearTimeout(timeout); abort.abort(); decoder.kill();
  await Promise.allSettled([consume, done]);
}
