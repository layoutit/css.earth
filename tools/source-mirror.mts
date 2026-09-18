// Shared content-addressed mirror lookup, used wherever a pinned publisher byte stream (a facility volume preview, a
// source acquisition download, …) should be tried against our own reliable storage before the original host. The
// publisher URL always stays the recorded provenance; the mirror only saves a slow or unreliable third party from
// blocking a build.
import { RUNTIME_ASSET_ORIGIN } from './runtime-assets.mts';
export { RUNTIME_ASSET_ORIGIN };

export function sourceCacheUrl(origin: string, sha256Digest: string, filename: string): string {
  return `${origin}/source-cache/${sha256Digest}/${filename}`;
}

/** Fetch with a timeout and a few retries. The publisher archives this exists for (ESO/NASA/CDS originals, USGS
 * gazetteer snapshots, …) are large or occasionally slow; a single timed-out attempt should not fail a build a retry
 * would have survived. Callers checking our own fast mirror should pass a short timeout and a single attempt instead. */
export async function fetchWithRetry(url: string, { timeoutMs = 600000, attempts = 3 }: { timeoutMs?: number; attempts?: number } = {}): Promise<Buffer<ArrayBuffer>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
