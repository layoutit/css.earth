import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { inventoriedAssets, inventoriedObjectIds, RUNTIME_ASSET_ORIGIN, type RuntimeAssetLocation } from "./runtime-assets.mts";

const execFileAsync = promisify(execFile);

async function gitChangedPaths(ref: string, root: string): Promise<string[]> {
  const { stdout } = await execFileAsync("git", ["diff", "--name-only", `${ref}...HEAD`], { cwd: root, maxBuffer: 1024 * 1024 * 64 });
  return stdout.split("\n").map(line => line.trim()).filter(Boolean);
}

/**
 * Object ids whose own directory changed relative to `ref`'s merge base with `HEAD` (a three-dot diff), including
 * one whose `runtime-assets.json` or `prepared-assets.json` inventory changed — those live directly under
 * `src/objects/<id>/`, so no separate case is needed. Used to scope the publish gate to what a PR actually touched.
 */
export async function changedObjectIds(ref: string, { root = resolve(import.meta.dirname, ".."),
  changedPaths = (gitRef: string) => gitChangedPaths(gitRef, root) }:
  { root?: string; changedPaths?: (ref: string) => Promise<string[]> } = {}): Promise<Set<string>> {
  const paths = await changedPaths(ref);
  const ids = new Set<string>();
  for (const path of paths) {
    const match = /^src\/objects\/([a-z][a-z0-9-]*)\//.exec(path);
    if (match) ids.add(match[1]!);
  }
  return ids;
}

/** Default backoff before each of the 3 re-checks of a miss: 2s, 5s, 10s. */
const DEFAULT_RETRY_DELAYS_MS = [2000, 5000, 10000];

async function headOk(fetcher: typeof fetch, origin: string, asset: RuntimeAssetLocation): Promise<boolean> {
  const response = await fetcher(`${origin}/${asset.key}`, { method: "HEAD" }).catch(() => null);
  // A compressed (e.g. brotli) response can omit content-length entirely — see publish-verification.mts's headOk.
  // Any non-ok status (a 404 included: it can be edge propagation lag, not a real miss) and any network error are
  // treated the same way here — both are retried the same number of times before being reported as a real miss.
  const contentLength = response?.headers.get("content-length") ?? null;
  return !!response && response.ok && (contentLength === null || Number(contentLength) === asset.bytes);
}

async function headAll(fetcher: typeof fetch, origin: string, assets: readonly RuntimeAssetLocation[], concurrency: number): Promise<RuntimeAssetLocation[]> {
  const misses: RuntimeAssetLocation[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, assets.length) }, async () => {
    while (next < assets.length) {
      const asset = assets[next++]!;
      if (!(await headOk(fetcher, origin, asset))) misses.push(asset);
    }
  }));
  return misses;
}

function formatMiss(asset: RuntimeAssetLocation): string { return `${asset.id}/${asset.filename} (${asset.key})`; }
function byFormattedKey(left: RuntimeAssetLocation, right: RuntimeAssetLocation): number { return formatMiss(left).localeCompare(formatMiss(right)); }

/**
 * The publish gate (`check:assets-published`): HEAD every key from both inventory kinds (`runtime-assets.json` and
 * `prepared-assets.json`) and report exactly which ones are missing from R2. Read-only: never uploads,
 * never deletes. A CI job runs this after `pnpm build` on a PR to prove the build did not silently depend on a
 * local file that was never published.
 *
 * A HEAD occasionally misses transiently (a dropped request, an edge hiccup) even though the key is live — observed
 * live as 1 miss out of 7602 keys that HEADed fine seconds later. A single sweep therefore re-checks only its own
 * misses up to 3 more times with backoff before reporting them; a key is a real miss only once every attempt failed.
 *
 * `changedSince` scopes failure to the PR's own blast radius: a miss in an object this PR's diff (vs. `changedSince`'s
 * merge base) touched still fails the gate, but a miss in an untouched object — some pre-existing, unrelated gap —
 * only warns. Without it (local use, and a push to `main`), every miss fails, unchanged from before this option.
 */
export async function checkAssetsPublished(objectIds: readonly string[], { origin = RUNTIME_ASSET_ORIGIN, fetcher = fetch,
  root = resolve(import.meta.dirname, ".."), concurrency = 16, retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  sleep = (ms: number) => new Promise<void>(accept => setTimeout(accept, ms)), changedSince,
  findChangedObjectIds = (ref: string) => changedObjectIds(ref, { root }) }:
  { origin?: string; fetcher?: typeof fetch; root?: string; concurrency?: number; retryDelaysMs?: readonly number[];
    sleep?: (ms: number) => Promise<void>; changedSince?: string;
    findChangedObjectIds?: (ref: string) => Promise<Set<string>> } = {})
  : Promise<{ checked: number; misses: readonly string[]; warnings: readonly string[] }> {
  const ids = inventoriedObjectIds(objectIds, root);
  const assets = await inventoriedAssets(root, ids);
  let misses = await headAll(fetcher, origin, assets, concurrency);
  for (const delayMs of retryDelaysMs) {
    if (!misses.length) break;
    await sleep(delayMs);
    misses = await headAll(fetcher, origin, misses, concurrency);
  }
  misses = [...misses].sort(byFormattedKey);
  if (!changedSince) return { checked: assets.length, misses: misses.map(formatMiss), warnings: [] };
  const scope = await findChangedObjectIds(changedSince);
  return { checked: assets.length, misses: misses.filter(asset => scope.has(asset.id)).map(formatMiss),
    warnings: misses.filter(asset => !scope.has(asset.id)).map(formatMiss) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const changedSinceArg = args.find(arg => arg.startsWith("--changed-since="));
  const changedSince = changedSinceArg?.slice("--changed-since=".length);
  const objectArgs = args.filter(arg => arg !== changedSinceArg);
  const { checked, misses, warnings } = await checkAssetsPublished(objectArgs, changedSince ? { changedSince } : {});
  console.log(`Checked ${checked} inventoried file(s) against ${RUNTIME_ASSET_ORIGIN}.`);
  if (warnings.length) {
    console.warn(`WARNING: ${warnings.length} file(s) outside this change's objects are not published (not failing the gate):`);
    for (const warning of warnings) console.warn(`  ${warning}`);
  }
  if (misses.length) {
    console.error(`${misses.length} file(s) are not published:`);
    for (const miss of misses) console.error(`  ${miss}`);
    process.exitCode = 1;
  } else if (!warnings.length) {
    console.log("Every inventoried file is published.");
  } else {
    console.log("Every inventoried file in this change's own objects is published.");
  }
}
