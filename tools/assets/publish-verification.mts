// Shared verify-after-publish logic for both publishers (runtime-assets and source-cache): `wrangler r2 bulk put` is
// fire-and-forget and has been observed to silently drop a subset of a batch without a nonzero exit code. After a
// bulk upload, HEAD every key; retry misses one at a time; then byte-verify every JSON key in full (small, and
// correctness there matters most) and a sample of the rest (verifying every large binary would mean re-downloading
// everything we just uploaded). Exit non-zero on any remaining miss or sample failure.
import { sha256 } from '../../src/platform/sha256.mts';

export interface PublishAsset { readonly key: string; readonly file: string; readonly bytes: number; readonly sha256: string; }
export interface VerifyResult { readonly retried: readonly string[]; readonly misses: readonly string[]; readonly sampleFailures: readonly string[]; }
export interface VerifyOptions {
  readonly origin: string;
  /** Injected for tests; defaults to the global fetch. */
  readonly fetcher?: typeof fetch;
  /** Uploads one asset (a per-key `wrangler r2 object put` in production); injected for tests. */
  readonly uploadOne: (asset: PublishAsset) => Promise<void>;
  /** How many non-JSON assets to byte-verify (JSON assets are always fully verified). Default 10. */
  readonly sampleSize?: number;
  /** Deterministic by default so a failure reproduces; tests can override. */
  readonly pickSample?: (assets: readonly PublishAsset[], count: number) => readonly PublishAsset[];
}

function expectedContentType(key: string): string {
  return key.endsWith('.json') ? 'application/json' : 'application/octet-stream';
}

function headOk(response: Response | null, asset: PublishAsset): boolean {
  if (!response || !response.ok) return false;
  // Content-addressed bytes are not sufficient when stale R2 metadata changes
  // the wire representation. JSON published as octet-stream is not compressed
  // by the edge and can turn a 1.8 MB response into a 9 MB response.
  if (response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== expectedContentType(asset.key)) return false;
  // A compressible content type (e.g. `application/json`) can come back content-encoded (br/gzip) with no
  // `content-length` at all — observed live against the real origin once JSON started publishing with that
  // content type. There is then nothing left to compare at the HEAD level; `response.ok` is the whole signal,
  // and exact bytes are still confirmed by the full-content check below (always for JSON, sampled for the rest).
  const contentLength = response.headers.get('content-length');
  return contentLength === null || Number(contentLength) === asset.bytes;
}

function defaultSample(assets: readonly PublishAsset[], count: number): readonly PublishAsset[] {
  if (assets.length <= count) return assets;
  // Evenly spaced picks over the sorted key order: deterministic and not just "the first N".
  const sorted = [...assets].sort((a, b) => a.key.localeCompare(b.key));
  const step = sorted.length / count;
  return Array.from({ length: count }, (_, i) => sorted[Math.min(sorted.length - 1, Math.floor(i * step))]!);
}

export async function verifyPublished(assets: readonly PublishAsset[], options: VerifyOptions): Promise<VerifyResult> {
  const fetcher = options.fetcher ?? fetch;
  const url = (key: string) => `${options.origin}/${key}`;

  const misses: PublishAsset[] = [];
  for (const asset of assets) {
    const response = await fetcher(url(asset.key), { method: 'HEAD' }).catch(() => null);
    if (!headOk(response, asset)) misses.push(asset);
  }

  const retried: string[] = [];
  for (const asset of misses) { await options.uploadOne(asset); retried.push(asset.key); }

  const stillMissing: string[] = [];
  for (const asset of misses) {
    const response = await fetcher(url(asset.key), { method: 'HEAD' }).catch(() => null);
    if (!headOk(response, asset)) stillMissing.push(asset.key);
  }

  const jsonAssets = assets.filter(a => a.key.endsWith('.json'));
  const otherAssets = assets.filter(a => !a.key.endsWith('.json'));
  const pickSample = options.pickSample ?? defaultSample;
  const sample = pickSample(otherAssets, options.sampleSize ?? 10);
  const sampleFailures: string[] = [];
  for (const asset of [...jsonAssets, ...sample]) {
    const response = await fetcher(url(asset.key)).catch(() => null);
    if (!response || !response.ok) { sampleFailures.push(asset.key); continue; }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) sampleFailures.push(asset.key);
  }

  return { retried, misses: stillMissing, sampleFailures };
}

export function reportVerification(result: VerifyResult): void {
  if (result.retried.length) console.log(`Retried ${result.retried.length} key(s) the bulk upload dropped: ${result.retried.join(', ')}`);
  if (result.misses.length || result.sampleFailures.length) {
    throw new Error(`Publish verification failed. Still missing: ${result.misses.join(', ') || 'none'}. Byte-check failed: ${result.sampleFailures.join(', ') || 'none'}.`);
  }
}
