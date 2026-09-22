import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat, writeFile, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export interface DistManifestEntry { path: string; bytes: number; sha256: string; }
export type DistManifest = Record<string, { bytes: number; sha256: string }>;

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest("hex");
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

/** Every file under `distDir`, keyed by its slash-separated path relative to `distDir`. */
export async function buildDistManifest(distDir: string): Promise<DistManifest> {
  const files = await walk(distDir, distDir);
  const manifest: DistManifest = {};
  for (const file of files.sort()) {
    const relativePath = relative(distDir, file).split(sep).join("/");
    const [bytes, sha256] = await Promise.all([stat(file).then(info => info.size), sha256File(file)]);
    manifest[relativePath] = { bytes, sha256 };
  }
  return manifest;
}

export interface DistManifestDiff {
  added: string[];
  removed: string[];
  changed: { path: string; before: { bytes: number; sha256: string }; after: { bytes: number; sha256: string } }[];
}

/** Added, removed and byte-changed files between two manifests. Unchanged files are omitted. */
export function diffDistManifests(before: DistManifest, after: DistManifest): DistManifestDiff {
  const added: string[] = [], removed: string[] = [], changed: DistManifestDiff["changed"] = [];
  for (const path of Object.keys(after).sort()) if (!Object.hasOwn(before, path)) added.push(path);
  for (const path of Object.keys(before).sort()) if (!Object.hasOwn(after, path)) removed.push(path);
  for (const path of Object.keys(before).sort()) {
    const previous = before[path], next = after[path];
    if (next && previous.sha256 !== next.sha256) changed.push({ path, before: previous, after: next });
  }
  return { added, removed, changed };
}

function usage(): never {
  process.stderr.write([
    "Usage:",
    "  node tools/ci/dist-manifest.mts build <distDir> <outFile.json>",
    "  node tools/ci/dist-manifest.mts compare <before.json> <after.json>",
    "",
  ].join("\n"));
  process.exit(2);
}

async function main(argv: readonly string[]) {
  const [command, a, b] = argv;
  if (command === "build" && a && b) {
    const manifest = await buildDistManifest(a);
    await writeFile(b, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const totalBytes = Object.values(manifest).reduce((sum, entry) => sum + entry.bytes, 0);
    process.stdout.write(`Wrote ${Object.keys(manifest).length} entries (${totalBytes} bytes) to ${b}\n`);
    return;
  }
  if (command === "compare" && a && b) {
    const before: DistManifest = JSON.parse(await readFile(a, "utf8"));
    const after: DistManifest = JSON.parse(await readFile(b, "utf8"));
    const diff = diffDistManifests(before, after);
    process.stdout.write(`${JSON.stringify(diff, null, 2)}\n`);
    process.stdout.write(`\nadded=${diff.added.length} removed=${diff.removed.length} changed=${diff.changed.length}\n`);
    if (diff.added.length || diff.removed.length || diff.changed.length) process.exitCode = 1;
    return;
  }
  usage();
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) await main(process.argv.slice(2));
