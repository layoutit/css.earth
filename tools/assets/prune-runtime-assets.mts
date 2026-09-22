// Scoped prune, dry-run only. Lists every `runtime-assets/<sha256>/...` key live in R2 and reports which ones are
// absent from every current inventory (every inventory.json, across all objects) —
// i.e. bytes an old commit published that nothing checked in today still references. It never lists, computes
// against, or reports on `scenes/` or `source-cache/` keys, and there is no delete path: this tool only ever
// prints a report.
//
// wrangler has no read-only "list objects in a bucket" command (`wrangler r2 object` only has get/put/delete;
// `wrangler r2 bucket` manages buckets, not their contents) — confirmed against wrangler 4.129.0/4.135.0. Real,
// read-only listing therefore goes through R2's S3-compatible API instead, which needs its own R2 API token (an
// Access Key ID/Secret Access Key pair scoped to this bucket, distinct from the OAuth token `wrangler login`
// stores), not anything `wrangler` already has:
//
//   1. Cloudflare dashboard -> R2 -> Manage R2 API Tokens -> create a token with "Object Read only" permission,
//      scoped to the `cssearth-assets` bucket if possible.
//   2. Export three variables: R2_ACCOUNT_ID (see `wrangler whoami`), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.
//   3. Run `node tools/assets/prune-runtime-assets.mts --dry-run`.
//
// Without those, the CLI below reports plainly that it cannot list and exits non-zero — it never fabricates an
// empty or partial report. `listRuntimeAssetKeys` (the real S3 lister) and the pure `computePruneCandidates` are
// both exported and independently unit-tested against an injected transport/lister, so the decision logic has
// real coverage even where this environment cannot reach the real bucket.
import { createHash, createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inventoryAssets, inventoriedObjectIds } from './runtime-assets.mts';

export const BUCKET = 'cssearth-assets';
export const PRUNE_PREFIX = 'runtime-assets/';

export interface LiveKey { readonly key: string; readonly bytes: number; }

/**
 * Which of `liveKeys` (everything currently live in R2 under `runtime-assets/`) are not referenced by any current
 * inventory. Refuses (rather than silently ignoring) any live key outside `runtime-assets/` — the lister must
 * already be scoped to that prefix; this is a second, independent guard against ever considering `scenes/` or
 * `source-cache/` for pruning.
 */
export function computePruneCandidates(liveKeys: readonly LiveKey[], inventoriedKeys: ReadonlySet<string>):
  { readonly candidates: readonly LiveKey[]; readonly bytes: number } {
  for (const { key } of liveKeys) {
    if (!key.startsWith(PRUNE_PREFIX)) throw new Error(`Refusing to consider a key outside ${PRUNE_PREFIX}: ${key}`);
  }
  const candidates = liveKeys.filter(({ key }) => !inventoriedKeys.has(key));
  return { candidates, bytes: candidates.reduce((sum, { bytes }) => sum + bytes, 0) };
}

/** Every key any current inventory (inventory.json, every object) still references. */
export async function currentlyInventoriedKeys(root: string): Promise<Set<string>> {
  const assets = await inventoryAssets(root, inventoriedObjectIds([], root));
  return new Set(assets.map(asset => asset.key));
}

function hmac(key: Buffer | string, data: string): Buffer { return createHmac('sha256', key).update(data, 'utf8').digest(); }
function sha256Hex(data: string): string { return createHash('sha256').update(data, 'utf8').digest('hex'); }

/** Minimal, dependency-free AWS SigV4 GET signer for R2's S3-compatible API (region "auto", service "s3") — just
 * enough to sign a `ListObjectsV2` request, not a general-purpose client. */
function signedListHeaders({ accessKeyId, secretAccessKey, host, path, query, amzDate }:
  { accessKeyId: string; secretAccessKey: string; host: string; path: string; query: string; amzDate: string }): Record<string, string> {
  const dateStamp = amzDate.slice(0, 8);
  const emptyPayloadHash = sha256Hex('');
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${emptyPayloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `GET\n${path}\n${query}\n${canonicalHeaders}\n${signedHeaders}\n${emptyPayloadHash}`;
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), 'auto'), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');
  return {
    host, 'x-amz-content-sha256': emptyPayloadHash, 'x-amz-date': amzDate,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function encodeRfc3986(value: string): string { return encodeURIComponent(value).replace(/[!'()*]/gu, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`); }

/** Parses just the fields ListObjectsV2's XML response needs (this tool never writes XML, only reads Cloudflare's). */
function parseListObjectsV2(xml: string): { keys: LiveKey[]; isTruncated: boolean; nextContinuationToken: string | null } {
  const keys: LiveKey[] = [];
  for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/gu)) {
    const block = match[1]!;
    const key = /<Key>([\s\S]*?)<\/Key>/u.exec(block)?.[1];
    const size = /<Size>(\d+)<\/Size>/u.exec(block)?.[1];
    if (key === undefined || size === undefined) throw new Error('Malformed ListObjectsV2 entry: missing Key or Size.');
    keys.push({ key: key.replace(/&amp;/gu, '&').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>'), bytes: Number(size) });
  }
  const isTruncated = /<IsTruncated>true<\/IsTruncated>/u.test(xml);
  const nextContinuationToken = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/u.exec(xml)?.[1] ?? null;
  return { keys, isTruncated, nextContinuationToken };
}

export interface R2Credentials { readonly accountId: string; readonly accessKeyId: string; readonly secretAccessKey: string; }

/** Real, read-only listing via R2's S3-compatible API (see the file header for how a maintainer obtains
 * `credentials`). `fetcher` is injectable so this is unit-testable without real network or credentials. */
export async function listRuntimeAssetKeys({ accountId, accessKeyId, secretAccessKey }: R2Credentials,
  { bucket = BUCKET, prefix = PRUNE_PREFIX, fetcher = fetch }: { bucket?: string; prefix?: string; fetcher?: typeof fetch } = {}): Promise<LiveKey[]> {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const keys: LiveKey[] = [];
  let continuationToken: string | null = null;
  do {
    const params: [string, string][] = [['list-type', '2'], ['prefix', prefix], ['max-keys', '1000']];
    if (continuationToken) params.push(['continuation-token', continuationToken]);
    params.sort(([left], [right]) => left.localeCompare(right));
    const query = params.map(([name, value]) => `${encodeRfc3986(name)}=${encodeRfc3986(value)}`).join('&');
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/gu, '');
    const headers = signedListHeaders({ accessKeyId, secretAccessKey, host, path: `/${bucket}`, query, amzDate });
    const response = await fetcher(`https://${host}/${bucket}?${query}`, { headers });
    if (!response.ok) throw new Error(`R2 ListObjectsV2 failed: HTTP ${response.status} ${await response.text().catch(() => '')}`);
    const parsed = parseListObjectsV2(await response.text());
    keys.push(...parsed.keys);
    continuationToken = parsed.isTruncated ? parsed.nextContinuationToken : null;
    if (parsed.isTruncated && !continuationToken) throw new Error('R2 ListObjectsV2 reported truncation with no continuation token.');
  } while (continuationToken);
  return keys;
}

function credentialsFromEnv(env: NodeJS.ProcessEnv): R2Credentials | null {
  const accountId = env.R2_ACCOUNT_ID, accessKeyId = env.R2_ACCESS_KEY_ID, secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  return accountId && accessKeyId && secretAccessKey ? { accountId, accessKeyId, secretAccessKey } : null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv.includes('--dry-run')) throw new Error('Usage: prune-runtime-assets.mts --dry-run (there is no delete path).');
  const root = resolve(import.meta.dirname, '../..');
  const inventoried = await currentlyInventoriedKeys(root);
  const credentials = credentialsFromEnv(process.env);
  if (!credentials) {
    console.error('Cannot list R2 objects: wrangler has no read-only list command, and R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/' +
      'R2_SECRET_ACCESS_KEY are not set. See the comment at the top of this file for how to create a read-only R2 API ' +
      `token. (${inventoried.size} key(s) are currently inventoried locally, for reference.)`);
    process.exitCode = 1;
  } else {
    const live = await listRuntimeAssetKeys(credentials);
    const { candidates, bytes } = computePruneCandidates(live, inventoried);
    console.log(`${live.length} live runtime-assets/ key(s); ${inventoried.size} currently inventoried.`);
    console.log(`Would prune ${candidates.length} key(s), ${(bytes / 1e6).toFixed(1)} MB — dry run only, nothing deleted.`);
    for (const { key, bytes: size } of candidates) console.log(`  ${key} (${size} bytes)`);
  }
}
