#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { publishSourceBytes } from "../../../platform/source-acquisition.mjs";
import { assertPlutoSourceBytes, plutoSourceManifest, verifyPlutoSourceManifest } from "./source-manifest.mjs";

if (!process.argv.includes("--verify-only")) {
  for (const entry of plutoSourceManifest().inputs) {
    const destination = resolve(import.meta.dirname, "../source", entry.path);
    try { assertPlutoSourceBytes(entry, await readFile(destination)); continue; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (!/\.(?:jpg|tif)$/u.test(entry.path)) throw new Error(`Restore checked Pluto source from git: ${entry.path}`);
    const response = await fetch(entry.origin, { signal: AbortSignal.timeout(180_000) });
    if (!response.ok) throw new Error(`Pluto source download failed: ${response.status} ${entry.origin}`);
    await publishSourceBytes({ destination, bytes: Buffer.from(await response.arrayBuffer()), entry, planetName: "Pluto" });
  }
}
console.log(JSON.stringify(await verifyPlutoSourceManifest()));
