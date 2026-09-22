import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { DistManifest } from "./dist-manifest.mts";

// Vite/Rollup's own chunk-naming hash is not guaranteed stable across separate build
// invocations of the same source (observed here: 5 shared entry chunks under `_astro/`
// rehash between two consecutive builds with zero source changes, cascading into every
// HTML page's `<script src>`). Normalizing that one hash segment out of both a file's own
// name and any text file's content isolates real content drift from this pre-existing,
// ASSET_ORIGIN-unrelated non-determinism.
const VITE_HASH = /(_astro\/[A-Za-z0-9_$.-]+?)\.[A-Za-z0-9_-]{6,12}\.(js|css|mjs)/gu;
const TEXT_EXTENSIONS = new Set([".html", ".js", ".mjs", ".css", ".json", ".xml", ".txt"]);

export function normalizeViteHashes(text: string): string {
  return text.replace(VITE_HASH, "$1.HASH.$2");
}

async function walk(root: string, dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

/** Like `buildDistManifest`, but both the manifest key and a text file's hashed bytes have
 * Vite's volatile chunk-hash segment normalized out first. */
export async function buildNormalizedDistManifest(distDir: string): Promise<DistManifest> {
  const files = await walk(distDir, distDir);
  const manifest: DistManifest = {};
  for (const file of files.sort()) {
    const relativePath = normalizeViteHashes(relative(distDir, file).split(sep).join("/"));
    const ext = /\.[^.]+$/u.exec(file)?.[0] ?? "";
    const raw = await readFile(file);
    const bytes = (await stat(file)).size;
    const normalized = TEXT_EXTENSIONS.has(ext) ? Buffer.from(normalizeViteHashes(raw.toString("utf8")), "utf8") : raw;
    manifest[relativePath] = { bytes, sha256: createHash("sha256").update(normalized).digest("hex") };
  }
  return manifest;
}
