#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSourceManifest } from "../../../platform/source-manifest.mjs";
import { publishSourceBytes } from "../../../platform/source-acquisition.mjs";

const sourceRoot = resolve(import.meta.dirname, "../source");
const source = await createSourceManifest({ planetId: "callisto", planetName: "Callisto", sourceRoot });
if (process.argv.slice(2).some(arg => arg !== "--verify-only")) {
  throw new Error("Usage: node src/planets/callisto/tools/acquire.mjs [--verify-only]");
}
if (!process.argv.includes("--verify-only")) {
  for (const entry of source.manifest.inputs) {
    const destination = resolve(sourceRoot, entry.path);
    try {
      source.assertBytes(entry, await readFile(destination));
      continue;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    console.log(`Downloading ${entry.path} (${entry.expectedBytes} bytes)`);
    const response = await fetch(entry.origin, { signal: AbortSignal.timeout(180_000) });
    if (!response.ok || !response.body) throw new Error(`Callisto source HTTP ${response.status}: ${entry.origin}`);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > entry.expectedBytes) throw new Error(`Callisto source exceeds expected size: ${entry.path}`);
      chunks.push(chunk);
    }
    await publishSourceBytes({ destination, bytes: Buffer.concat(chunks), entry, planetName: "Callisto" });
  }
}
console.log(JSON.stringify(await source.verify()));
