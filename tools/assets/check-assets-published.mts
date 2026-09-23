import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { Agent, fetch as undiciFetch } from "undici";
import { inventoryAssets, inventoriedObjectIds, RUNTIME_ASSET_ORIGIN, type RuntimeAssetLocation } from "./runtime-assets.mts";
import { isRecord } from "../sources/source-values.mts";

const execFileAsync = promisify(execFile);
const defaultRoot = resolve(import.meta.dirname, "../..");

async function git(root: string, args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", [...args], { cwd: root, maxBuffer: 1024 * 1024 * 64 });
  return stdout;
}

async function gitChangedPaths(base: string, root: string): Promise<string[]> {
  // --no-renames: with rename detection on, `git diff --name-only` reports only a renamed file's new path, so a
  // moved inventory would hide its old path. See tools/ci/object-scope-gate.mts's gitChangedPaths for the same fix.
  return (await git(root, ["diff", "--no-renames", "--name-only", base, "HEAD"])).split("\n").map(line => line.trim()).filter(Boolean);
}

/** The inventory text at `base`, or null when that path did not exist there (a new object or a moved inventory). */
async function gitInventoryAt(base: string, path: string, root: string): Promise<string | null> {
  if (!(await git(root, ["ls-tree", "--name-only", base, "--", path])).trim()) return null;
  return git(root, ["show", `${base}:${path}`]);
}

/**
 * A change to any of these files can change which R2 key an inventoried asset maps to (or what a manifest is
 * allowed to contain) for every object at once. A diff touching one of them is checked as a full sweep, not
 * scoped to the keys its inventories add.
 */
const SCOPE_WIDENING_PATHS = new Set([
  "tools/assets/runtime-assets.mts",
  "src/platform/runtime-asset-closure.mts",
]);

const INVENTORY_PATH = /^src\/objects\/([^/]+)\/inventory\.json$/u;

/** What `addedAssetKeys` decided to check: every key, or only the keys a diff added. */
export type AddedScope =
  | { readonly all: true; readonly reason: string }
  | { readonly all: false; readonly base: string; readonly objectIds: ReadonlySet<string>; readonly keys: ReadonlySet<string> };

/**
 * Keys read leniently from an inventory at the base revision. A base inventory that no longer parses contributes
 * no keys, so every key its object has now is checked: leniency here can only widen what is checked.
 */
function baseInventoryKeys(text: string | null): Set<string> {
  const keys = new Set<string>();
  if (text === null) return keys;
  let value: unknown;
  try { value = JSON.parse(text); } catch { return keys; }
  if (!isRecord(value) || !Array.isArray(value.assets)) return keys;
  for (const asset of value.assets) {
    if (isRecord(asset) && typeof asset.sha256 === "string" && typeof asset.filename === "string") {
      keys.add(`runtime-assets/${asset.sha256}/${asset.filename}`);
    }
  }
  return keys;
}

/**
 * The R2 keys present in HEAD's inventories and absent from the same inventories at `ref`'s merge base with HEAD.
 * Keys are content-addressed (`runtime-assets/<sha256>/<filename>`), so an inventory line that did not change can
 * only stop resolving if R2 lost the object; the nightly full sweep is what detects that. A diff that touches
 * key-construction code (`SCOPE_WIDENING_PATHS`) returns `all`, and so does a ref without a merge base.
 */
export async function addedAssetKeys(ref: string, { root = defaultRoot,
  mergeBase = async (gitRef: string) => (await git(root, ["merge-base", gitRef, "HEAD"])).trim(),
  changedPaths = (base: string) => gitChangedPaths(base, root),
  inventoryAt = (base: string, path: string) => gitInventoryAt(base, path, root) }:
  { root?: string; mergeBase?: (ref: string) => Promise<string>; changedPaths?: (base: string) => Promise<string[]>;
    inventoryAt?: (base: string, path: string) => Promise<string | null> } = {}): Promise<AddedScope> {
  let base: string;
  try { base = await mergeBase(ref); }
  catch (error) { return { all: true, reason: `no merge base with ${ref} (${errorText(error)})` }; }
  if (!base) return { all: true, reason: `no merge base with ${ref}` };
  const paths = await changedPaths(base);
  const widening = paths.find(path => SCOPE_WIDENING_PATHS.has(path));
  if (widening) return { all: true, reason: `${widening} changed` };
  const objectIds = new Set<string>(), baseKeys = new Set<string>();
  for (const path of paths) {
    const match = INVENTORY_PATH.exec(path);
    if (!match) continue;
    const id = match[1]!;
    if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new Error(`Unexpected object id in changed inventory path, refusing to scope silently: ${path}`);
    objectIds.add(id);
    for (const key of baseInventoryKeys(await inventoryAt(base, path))) baseKeys.add(key);
  }
  const current = [...objectIds].filter(id => existsSync(resolve(root, `src/objects/${id}/inventory.json`)));
  const keys = new Set((await inventoryAssets(root, current)).map(asset => asset.key).filter(key => !baseKeys.has(key)));
  return { all: false, base, objectIds: new Set(current), keys };
}

/**
 * The head SHA of the most recent successful `Shared universe` run for a push to `main`, or null when there is none.
 * Needs `gh` with a token that can read Actions (CI: `GH_TOKEN` with `actions: read`; locally: the user's login).
 */
export async function lastGreenMainSha({ repository = process.env.GITHUB_REPOSITORY ?? "layoutit/css.earth",
  run = async (args: readonly string[]) => (await execFileAsync("gh", [...args])).stdout }:
  { repository?: string; run?: (args: readonly string[]) => Promise<string> } = {}): Promise<string | null> {
  const sha = (await run(["api", "-X", "GET", `repos/${repository}/actions/workflows/universe.yml/runs`,
    "-f", "branch=main", "-f", "event=push", "-f", "status=success", "-f", "per_page=1",
    "--jq", '.workflow_runs[0].head_sha // ""'])).trim();
  if (!sha) return null;
  if (!/^[0-9a-f]{40}$/u.test(sha)) throw new TypeError(`Unexpected head SHA from the Actions API: ${sha}`);
  return sha;
}

type MissClass = "missing" | "throttled" | "network";
export interface RetryPolicy { readonly delaysMs: readonly number[]; readonly concurrency: number; }

/**
 * How each kind of miss is re-checked before it is reported. A 404 (or a byte-count mismatch) is usually
 * propagation lag, so it retries quickly at full width. A 429/5xx is the edge pushing back: slower, narrower, and
 * a `Retry-After` header wins over the schedule. A network error (reset socket, DNS, timeout) backs off for about
 * two minutes at concurrency 2, because a burst of those outlasted the previous 17-second budget on a real
 * `main` run while every key was live.
 */
export const DEFAULT_RETRY_POLICY: Readonly<Record<MissClass, RetryPolicy>> = {
  missing: { delaysMs: [2000, 5000, 10000], concurrency: 16 },
  throttled: { delaysMs: [5000, 15000, 30000], concurrency: 4 },
  network: { delaysMs: [5000, 15000, 30000, 60000], concurrency: 2 },
};
/** A hung socket fails after this long instead of holding a worker. */
export const REQUEST_TIMEOUT_MS = 15_000;
/** Connection cap for the shared keep-alive agent: bounds new-connection and DNS churn. */
export const MAX_CONNECTIONS = 8;
const MAX_RETRY_AFTER_MS = 60_000;

interface HeadResponse { readonly ok: boolean; readonly status: number; readonly headers: { get(name: string): string | null }; }
export type HeadFetcher = (url: string, init: { method: "HEAD"; signal: AbortSignal }) => Promise<HeadResponse>;

/** One keep-alive agent shared by every HEAD, capped at `connections`. Close it when the check is done. */
export function createHeadFetcher({ connections = MAX_CONNECTIONS } = {}): { fetcher: HeadFetcher; close: () => Promise<void> } {
  const agent = new Agent({ connections, pipelining: 1, keepAliveTimeout: 30_000 });
  return { fetcher: (url, init) => undiciFetch(url, { ...init, dispatcher: agent }), close: () => agent.close() };
}

function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }

/**
 * undici wraps the socket error (ECONNRESET, ETIMEDOUT, EAI_AGAIN, UND_ERR_SOCKET) in `cause`; report that code.
 * A key that never answered is unverified, not missing: nothing says R2 lacks it.
 */
export function networkErrorReason(error: unknown, timeoutMs = REQUEST_TIMEOUT_MS): string {
  if (error instanceof Error) {
    const cause: unknown = error.cause;
    if (isRecord(cause) && typeof cause.code === "string") return `unverified (network: ${cause.code})`;
    if (error.name === "TimeoutError") return `unverified (network: timed out after ${timeoutMs} ms)`;
  }
  return `unverified (network: ${errorText(error)})`;
}

interface HeadCheck { readonly ok: boolean; readonly reason: string; readonly kind: MissClass; readonly retryAfterMs: number | null; readonly status?: number; }

function retryAfterMs(value: string | null): number | null {
  if (value === null) return null;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(ms) && ms >= 0 ? Math.min(ms, MAX_RETRY_AFTER_MS) : null;
}

async function headCheck(fetcher: HeadFetcher, origin: string, asset: RuntimeAssetLocation, timeoutMs: number): Promise<HeadCheck> {
  let response: HeadResponse;
  try {
    response = await fetcher(`${origin}/${asset.key}`, { method: "HEAD", signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    return { ok: false, reason: networkErrorReason(error, timeoutMs), kind: "network", retryAfterMs: null };
  }
  if (!response.ok) {
    const throttled = response.status === 429 || response.status >= 500;
    return { ok: false, reason: `HTTP ${response.status}`, kind: throttled ? "throttled" : "missing", status: response.status,
      retryAfterMs: throttled ? retryAfterMs(response.headers.get("retry-after")) : null };
  }
  // A compressed (e.g. brotli) response can omit content-length entirely — see publish-verification.mts's headOk.
  const contentLength = response.headers.get("content-length") ?? null;
  if (contentLength !== null && Number(contentLength) !== asset.bytes) {
    return { ok: false, reason: `content-length mismatch: expected ${asset.bytes}, got ${contentLength}`, kind: "missing", retryAfterMs: null };
  }
  return { ok: true, reason: "", kind: "missing", retryAfterMs: null };
}

async function headAll(fetcher: HeadFetcher, origin: string, assets: readonly RuntimeAssetLocation[], concurrency: number,
  timeoutMs: number, results: Map<RuntimeAssetLocation, HeadCheck>): Promise<RuntimeAssetLocation[]> {
  const misses: RuntimeAssetLocation[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, assets.length) }, async () => {
    while (next < assets.length) {
      const asset = assets[next++]!;
      const result = await headCheck(fetcher, origin, asset, timeoutMs);
      results.set(asset, result);
      if (!result.ok) misses.push(asset);
    }
  }));
  return misses;
}

function formatMiss(asset: RuntimeAssetLocation, results: ReadonlyMap<RuntimeAssetLocation, HeadCheck>): string {
  return `${asset.id}/${asset.filename} (${asset.key}) — ${results.get(asset)?.reason ?? "unknown"}`;
}
function byId(asset: RuntimeAssetLocation): string { return `${asset.id}/${asset.filename} (${asset.key})`; }
function byFormattedKey(left: RuntimeAssetLocation, right: RuntimeAssetLocation): number { return byId(left).localeCompare(byId(right)); }

export interface CheckAssetsPublishedResult {
  readonly checked: number;
  readonly inventoried: number;
  readonly scope: string;
  /** Keys R2 answered with HTTP 404 on every attempt: really not published. */
  readonly notFound: readonly string[];
  /** Keys whose last answer was another HTTP status or a byte-count mismatch. */
  readonly otherMisses: readonly string[];
  /** Keys that never got an answer (network error or timeout): unverified. */
  readonly unverified: readonly string[];
}

/**
 * The publish gate (`check:assets-published`): HEAD inventoried keys from both inventory kinds
 * (`inventory.json`) and report exactly which ones R2 does not serve. Read-only.
 *
 * `addedSince` narrows the check to the keys `addedAssetKeys` finds against that ref (a PR's base branch, or the
 * last green `main` commit); without it every key is checked (local use and the nightly sweep). Each miss is
 * re-checked under `DEFAULT_RETRY_POLICY` for its kind; a key is reported only once every attempt failed, with
 * the reason from its last attempt. `gateVerdict` decides what fails.
 */
export async function checkAssetsPublished(objectIds: readonly string[], { origin = RUNTIME_ASSET_ORIGIN, fetcher,
  root = defaultRoot, concurrency = DEFAULT_RETRY_POLICY.missing.concurrency, retryPolicy = {},
  timeoutMs = REQUEST_TIMEOUT_MS, sleep = (ms: number) => new Promise<void>(accept => setTimeout(accept, ms)), addedSince,
  findAddedKeys = (ref: string) => addedAssetKeys(ref, { root }) }:
  { origin?: string; fetcher?: HeadFetcher; root?: string; concurrency?: number;
    retryPolicy?: Partial<Record<MissClass, Partial<RetryPolicy>>>; timeoutMs?: number;
    sleep?: (ms: number) => Promise<void>; addedSince?: string; findAddedKeys?: (ref: string) => Promise<AddedScope> } = {})
  : Promise<CheckAssetsPublishedResult> {
  const ids = inventoriedObjectIds(objectIds, root);
  const inventoried = await inventoryAssets(root, ids);
  let assets = inventoried, scope = "every inventoried key";
  if (addedSince) {
    const added = await findAddedKeys(addedSince);
    if (added.all) scope = `every inventoried key: ${added.reason}`;
    else {
      assets = inventoried.filter(asset => added.keys.has(asset.key));
      scope = `keys added since ${addedSince} (merge base ${added.base.slice(0, 12)}, ${added.objectIds.size} changed inventor${added.objectIds.size === 1 ? "y" : "ies"})`;
    }
  }
  const policy = (kind: MissClass): RetryPolicy => ({ ...DEFAULT_RETRY_POLICY[kind], ...retryPolicy[kind] });
  const owned = fetcher ? null : createHeadFetcher();
  const head = fetcher ?? owned!.fetcher;
  const results = new Map<RuntimeAssetLocation, HeadCheck>();
  let remaining: RuntimeAssetLocation[];
  try {
    const first = await headAll(head, origin, assets, concurrency, timeoutMs, results);
    const retryKind = async (kind: MissClass): Promise<RuntimeAssetLocation[]> => {
      const { delaysMs, concurrency: width } = policy(kind);
      let pending = first.filter(asset => results.get(asset)?.kind === kind);
      for (const delayMs of delaysMs) {
        if (!pending.length) break;
        const requested = kind === "throttled" ? Math.max(...pending.map(asset => results.get(asset)?.retryAfterMs ?? -1)) : -1;
        await sleep(requested >= 0 ? requested : delayMs);
        pending = await headAll(head, origin, pending, width, timeoutMs, results);
      }
      return pending;
    };
    remaining = (await Promise.all((["missing", "throttled", "network"] as const).map(retryKind))).flat().sort(byFormattedKey);
  } finally {
    await owned?.close();
  }
  const format = (keep: (check: HeadCheck | undefined) => boolean) => remaining.filter(asset => keep(results.get(asset))).map(asset => formatMiss(asset, results));
  return { checked: assets.length, inventoried: inventoried.length, scope,
    notFound: format(check => check?.status === 404),
    otherMisses: format(check => check?.kind !== "network" && check?.status !== 404),
    unverified: format(check => check?.kind === "network") };
}

/**
 * What the gate's result means for the job. A PR, a local run and the nightly sweep fail only on a real HTTP 404;
 * any other HTTP answer, a byte-count mismatch and every unverified (network) key only warn. `reportOnly` (a push
 * to main) never fails. A production deploy uses `requireVerified` so it publishes only after every inventoried
 * key answers successfully, including keys unchanged since the last PR gate.
 */
export function gateVerdict(result: CheckAssetsPublishedResult, { reportOnly = false, requireVerified = false }:
  { reportOnly?: boolean; requireVerified?: boolean } = {}): { exitCode: 0 | 1; report: string } {
  if (reportOnly && requireVerified) throw new TypeError('A verified deploy cannot be report-only.');
  const lines = [`Checked ${result.checked} of ${result.inventoried} inventoried file(s) against ${RUNTIME_ASSET_ORIGIN}: ${result.scope}.`];
  const section = (title: string, entries: readonly string[]) => {
    if (entries.length) lines.push("", `${title} (${entries.length}):`, ...entries.map(entry => `- ${entry}`));
  };
  section(reportOnly ? "WARNING: not published (HTTP 404); this push to main does not fail on assets" : "FAIL: not published (HTTP 404)", result.notFound);
  section(`${requireVerified ? 'FAIL' : 'WARNING'}: other HTTP answers`, result.otherMisses);
  section(`${requireVerified ? 'FAIL' : 'WARNING'}: unverified (network); publication neither proven nor disproven`, result.unverified);
  const failed = !reportOnly && (result.notFound.length > 0 || requireVerified && (result.otherMisses.length > 0 || result.unverified.length > 0));
  if (!result.notFound.length && !result.otherMisses.length && !result.unverified.length) lines.push("", "Every checked file is published.");
  return { exitCode: failed ? 1 : 0, report: lines.join("\n") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = (name: string) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const addedSinceArg = option("added-since"), concurrencyArg = option("concurrency");
  const lastGreen = args.includes("--added-since-last-green"), reportOnly = args.includes("--report-only"), requireVerified = args.includes("--require-verified");
  const objectArgs = args.filter(arg => !/^--(?:added-since|concurrency)=/u.test(arg) && arg !== "--added-since-last-green" && arg !== "--report-only" && arg !== "--require-verified");
  if (addedSinceArg !== undefined && lastGreen) throw new Error("Use --added-since=<ref> or --added-since-last-green, not both.");
  if (reportOnly && requireVerified) throw new Error('A verified deploy cannot be report-only.');
  const concurrency = concurrencyArg === undefined ? undefined : Number(concurrencyArg);
  if (concurrency !== undefined && (!Number.isInteger(concurrency) || concurrency < 1)) throw new Error(`Invalid --concurrency=${concurrencyArg}`);
  let addedSince = addedSinceArg;
  if (lastGreen) {
    let sha: string | null = null;
    try { sha = await lastGreenMainSha(); }
    catch (error) { console.warn(`Could not look up the last green main run (${errorText(error)}); checking every key.`); }
    if (sha === null) console.warn("No green main run to compare with; checking every key.");
    else addedSince = sha;
  }
  const result = await checkAssetsPublished(objectArgs, { ...(addedSince ? { addedSince } : {}), ...(concurrency ? { concurrency } : {}) });
  const { exitCode, report } = gateVerdict(result, { reportOnly, requireVerified });
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Published assets\n\n${report}\n`);
  process.exitCode = exitCode;
}
