import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { inventoriedAssets, inventoriedObjectIds, RUNTIME_ASSET_ORIGIN, type RuntimeAssetLocation } from "./runtime-assets.mts";

const execFileAsync = promisify(execFile);

async function gitChangedPaths(ref: string, root: string): Promise<string[]> {
  // --no-renames: with rename detection on, `git diff --name-only` reports only a renamed file's new path, which
  // would let moving files out of an object's directory (or between objects) undercount which objects a PR
  // touched. See tools/object-scope-gate.mts's gitChangedPaths for the full rationale — this scoping gate needs
  // the same fix for the same reason.
  const { stdout } = await execFileAsync("git", ["diff", "--no-renames", "--name-only", `${ref}...HEAD`], { cwd: root, maxBuffer: 1024 * 1024 * 64 });
  return stdout.split("\n").map(line => line.trim()).filter(Boolean);
}

/**
 * A change to any of these files can change which R2 key an inventoried asset maps to (or what a manifest is
 * allowed to contain) for every object at once, not just the ones with source changes in the same diff — e.g. a
 * `runtime-assets/<sha>/<filename>` key prefix or the manifest schema/closure validation. A PR touching one of
 * them is therefore checked as if it touched every inventoried object, not scoped to `src/objects/<id>/` changes.
 */
const SCOPE_WIDENING_PATHS = new Set([
  "tools/runtime-assets.mts",
  "src/platform/runtime-asset-closure.mts",
]);

/** The result of `changedObjectIds`: either a specific set of touched object ids, or a signal that the diff touched
 * shared key-construction/manifest code, so every inventoried object must be treated as touched. */
export interface ChangedScope { readonly allObjectsTouched: boolean; readonly ids: ReadonlySet<string>; }

/**
 * Object ids whose own directory changed relative to `ref`'s merge base with `HEAD` (a three-dot diff), including
 * one whose `runtime-assets.json` or `prepared-assets.json` inventory changed — those live directly under
 * `src/objects/<id>/`, so no separate case is needed. Used to scope the publish gate to what a PR actually touched.
 *
 * A path under `src/objects/` whose first segment is not a valid object id (`[a-z][a-z0-9-]*`) throws rather than
 * being silently skipped: every real object id matches that pattern (enforced by `inventoriedObjectIds` et al.),
 * so a path that does not is unexpected — folding it into the ignored bucket would let it escape scoping
 * (as `<something>` neither widening the scope nor being retried in a real object's `src/objects/<id>/` update
 * loop) instead of surfacing it as the anomaly it is.
 */
export async function changedObjectIds(ref: string, { root = resolve(import.meta.dirname, ".."),
  changedPaths = (gitRef: string) => gitChangedPaths(gitRef, root) }:
  { root?: string; changedPaths?: (ref: string) => Promise<string[]> } = {}): Promise<ChangedScope> {
  const paths = await changedPaths(ref);
  const ids = new Set<string>();
  let allObjectsTouched = false;
  for (const path of paths) {
    if (SCOPE_WIDENING_PATHS.has(path)) { allObjectsTouched = true; continue; }
    const match = /^src\/objects\/([^/]+)\//.exec(path);
    if (!match) continue;
    const id = match[1]!;
    if (!/^[a-z][a-z0-9-]*$/u.test(id)) {
      throw new Error(`Unexpected object id in changed path, refusing to scope silently: ${path}`);
    }
    ids.add(id);
  }
  return { allObjectsTouched, ids };
}

/** Default backoff before each of the 3 re-checks of a miss: 2s, 5s, 10s. */
export const DEFAULT_RETRY_DELAYS_MS = [2000, 5000, 10000];

interface HeadCheck { readonly ok: boolean; readonly reason: string; }

async function headCheck(fetcher: typeof fetch, origin: string, asset: RuntimeAssetLocation): Promise<HeadCheck> {
  let response: Response | null = null;
  try {
    response = await fetcher(`${origin}/${asset.key}`, { method: "HEAD" });
  } catch (error) {
    return { ok: false, reason: `network error: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
  // A compressed (e.g. brotli) response can omit content-length entirely — see publish-verification.mts's headOk.
  const contentLength = response.headers.get("content-length") ?? null;
  if (contentLength !== null && Number(contentLength) !== asset.bytes) {
    return { ok: false, reason: `content-length mismatch: expected ${asset.bytes}, got ${contentLength}` };
  }
  return { ok: true, reason: "" };
}

async function headAll(fetcher: typeof fetch, origin: string, assets: readonly RuntimeAssetLocation[], concurrency: number,
  reasons: Map<RuntimeAssetLocation, string>): Promise<RuntimeAssetLocation[]> {
  const misses: RuntimeAssetLocation[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, assets.length) }, async () => {
    while (next < assets.length) {
      const asset = assets[next++]!;
      const { ok, reason } = await headCheck(fetcher, origin, asset);
      if (!ok) { misses.push(asset); reasons.set(asset, reason); }
    }
  }));
  return misses;
}

function formatMiss(asset: RuntimeAssetLocation, reasons: ReadonlyMap<RuntimeAssetLocation, string>): string {
  return `${asset.id}/${asset.filename} (${asset.key}) — ${reasons.get(asset) ?? "unknown"}`;
}
function byId(asset: RuntimeAssetLocation): string { return `${asset.id}/${asset.filename} (${asset.key})`; }
function byFormattedKey(left: RuntimeAssetLocation, right: RuntimeAssetLocation): number { return byId(left).localeCompare(byId(right)); }

/**
 * The publish gate (`check:assets-published`): HEAD every key from both inventory kinds (`runtime-assets.json` and
 * `prepared-assets.json`) and report exactly which ones are missing from R2, each with the HTTP status or network
 * error from its final check. Read-only: never uploads, never deletes. A CI job runs this after `pnpm build` on a
 * PR to prove the build did not silently depend on a local file that was never published.
 *
 * A HEAD occasionally misses transiently (a dropped request, an edge hiccup) even though the key is live — observed
 * live as 1 miss out of 7602 keys that HEADed fine seconds later. A single sweep therefore re-checks only its own
 * misses up to `retryDelaysMs.length` more times with that backoff before reporting them; a key is a real miss only
 * once every attempt failed. `retryDelaysMs` defaults to `DEFAULT_RETRY_DELAYS_MS`.
 *
 * `changedSince` scopes failure to the PR's own blast radius: a miss in an object this PR's diff (vs. `changedSince`'s
 * merge base) touched still fails the gate, but a miss in an untouched object — some pre-existing, unrelated gap —
 * only warns. Without it (local use, and a push to `main`), every miss fails, unchanged from before this option.
 * When the diff's own scope is `allObjectsTouched` (it changed key-construction or manifest/closure code), every
 * miss fails and nothing is downgraded to a warning, regardless of which object it belongs to.
 */
export async function checkAssetsPublished(objectIds: readonly string[], { origin = RUNTIME_ASSET_ORIGIN, fetcher = fetch,
  root = resolve(import.meta.dirname, ".."), concurrency = 16, retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  sleep = (ms: number) => new Promise<void>(accept => setTimeout(accept, ms)), changedSince,
  findChangedObjectIds = (ref: string) => changedObjectIds(ref, { root }) }:
  { origin?: string; fetcher?: typeof fetch; root?: string; concurrency?: number; retryDelaysMs?: readonly number[];
    sleep?: (ms: number) => Promise<void>; changedSince?: string;
    findChangedObjectIds?: (ref: string) => Promise<ChangedScope> } = {})
  : Promise<{ checked: number; misses: readonly string[]; warnings: readonly string[] }> {
  const ids = inventoriedObjectIds(objectIds, root);
  const assets = await inventoriedAssets(root, ids);
  const reasons = new Map<RuntimeAssetLocation, string>();
  let misses = await headAll(fetcher, origin, assets, concurrency, reasons);
  for (const delayMs of retryDelaysMs) {
    if (!misses.length) break;
    await sleep(delayMs);
    misses = await headAll(fetcher, origin, misses, concurrency, reasons);
  }
  misses = [...misses].sort(byFormattedKey);
  if (!changedSince) return { checked: assets.length, misses: misses.map(miss => formatMiss(miss, reasons)), warnings: [] };
  const scope = await findChangedObjectIds(changedSince);
  if (scope.allObjectsTouched) return { checked: assets.length, misses: misses.map(miss => formatMiss(miss, reasons)), warnings: [] };
  return { checked: assets.length, misses: misses.filter(asset => scope.ids.has(asset.id)).map(miss => formatMiss(miss, reasons)),
    warnings: misses.filter(asset => !scope.ids.has(asset.id)).map(miss => formatMiss(miss, reasons)) };
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
