// Shared source-mirror lookup, used wherever a declared publisher byte stream (a facility volume preview, a
// source acquisition download, …) should be tried against our own reliable storage before the original host. The
// publisher URL always stays the recorded provenance; the mirror only saves a slow or unreliable third party from
// blocking a build.
import { Readable } from 'node:stream';
import { withIdleTimeout } from './idle-timeout.ts';

/** The project's asset host: runtime assets under `runtime-assets/`, and the source mirror under `source-cache/`.
 * The source-input restore (`restoreSourceInputs` in `@cssearth/bake/asset-publication`) takes it as a parameter, which its test
 * points at a local server. */
export const RUNTIME_ASSET_ORIGIN = "https://earth-assets.lowpoly.cc";

/** `source-cache/<object id>/<manifest path>`: the mirror of one object's downloaded source input, addressed the way
 * its manifest names it. Each path segment is percent-encoded (a name can carry spaces or other reserved characters). */
export function sourceCacheKey(objectId: string, path: string): string {
  return `source-cache/${objectId}/${path.split('/').map(segment => encodeURIComponent(segment)).join('/')}`;
}
export function sourceCacheUrl(origin: string, objectId: string, path: string): string {
  return `${origin}/${sourceCacheKey(objectId, path)}`;
}

/** Buffer a fetch response body with an idle timeout and a few retries, through the given fetcher (the caller's
 * injected `transport.fetch` in production code, so tests never reach the real network). For a large streamed
 * download, pipe `withIdleTimeout(Readable.fromWeb(response.body), idleMs)` into the destination directly instead
 * of buffering here. */
export async function fetchWithRetry(fetcher: typeof fetch, url: string,
  { idleMs = 120000, attempts = 3 }: { idleMs?: number; attempts?: number } = {}): Promise<Buffer<ArrayBuffer>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetcher(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      if (!response.body) throw new Error(`Response has no body for ${url}`);
      const stream = withIdleTimeout(Readable.fromWeb(response.body as never), idleMs);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks);
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
