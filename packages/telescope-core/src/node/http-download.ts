/** Bounded retries retain bytes only when the archive proves a matching byte range. */
import { link, mkdtemp, open, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { downloadContext, reportDownloadProgress } from './download-progress.js';
import { requireRecord, hasErrorCode } from '@cssearth/core';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export class DownloadInterruptedError extends Error {
  readonly rawMessage: string;
  constructor(bytes: number, total: number | undefined, attempts: number, cause: unknown) {
    super(`Download interrupted at ${(bytes / 1e6).toFixed(1)}${total === undefined ? '' : ` of ${(total / 1e6).toFixed(1)}`} MB after ${attempts} attempts. Run the same command again to retry.`);
    this.name = 'DownloadInterruptedError';
    this.rawMessage = cause instanceof Error ? `${cause.message}${cause.cause === undefined ? '' : `: ${String(cause.cause)}`}` : String(cause);
  }
}
export interface HttpDownloadOptions {
  readonly byteLimit: number;
  readonly signal?: AbortSignal;
  readonly expectedBytes?: number;
  /** Retry orchestration must use waitForBackoff so idle time measures active requests only. */
  readonly fetcher?: (url: string, options: RequestInit, waitForBackoff: (milliseconds: number) => Promise<void>) => Promise<Response>;
  readonly headers?: RequestInit['headers'];
  readonly attempts?: number;
  readonly backoffMs?: number;
  /** Optional caller-owned absolute deadline per attempt. */
  readonly timeoutMs?: number;
  /** Fail when no response bytes arrive for this long (default: 60 s unless timeoutMs is supplied). */
  readonly idleTimeoutMs?: number;
  readonly report?: (bytes: number) => void;
  readonly validateResponse?: (response: Response) => void;
  /** A raw transport may retain encoded wire bytes; native fetch decodes them. */
  readonly allowRawEncoding?: boolean;
}
class TransferContractError extends Error {}
const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
function transferClock(options: HttpDownloadOptions) {
  const controller = new AbortController();
  let rejectTimeout: (error: Error) => void = () => {};
  const timeout = new Promise<never>((_, reject) => { rejectTimeout = reject; });
  // A timeout can occur while bytes are being written, between awaited reads.
  void timeout.catch(() => {});
  const expire = (message: string) => { const error = new Error(message); controller.abort(error); rejectTimeout(error); };
  const abort = () => expire('Download aborted.');
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  const idleTimeoutMs = options.idleTimeoutMs ?? (options.timeoutMs === undefined ? 60_000 : undefined);
  let idle: ReturnType<typeof setTimeout> | undefined;
  const received = () => {
    clearTimeout(idle);
    if (idleTimeoutMs !== undefined) idle = setTimeout(() => expire('Download stalled without response bytes.'), idleTimeoutMs);
  };
  received();
  const absolute = options.timeoutMs === undefined ? undefined : setTimeout(() => expire('Download exceeded its absolute deadline.'), options.timeoutMs);
  const wait = <T>(value: Promise<T>) => Promise.race([value, timeout]);
  const waitForBackoff = async (milliseconds: number) => {
    clearTimeout(idle);
    let backoff: ReturnType<typeof setTimeout> | undefined;
    try { await wait(new Promise<void>(done => { backoff = setTimeout(done, milliseconds); })); }
    finally { clearTimeout(backoff); }
    controller.signal.throwIfAborted();
    received();
  };
  return { signal: controller.signal, received, wait, waitForBackoff,
    stop: () => { clearTimeout(idle); clearTimeout(absolute); options.signal?.removeEventListener('abort', abort); } };
}
function contentLength(response: Response, raw: boolean): number | undefined {
  if (response.headers.has('content-encoding') && !raw) return undefined;
  const value = response.headers.get('content-length');
  if (value === null) return undefined;
  const length = Number(value);
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(length)) throw new TransferContractError('Invalid download Content-Length.');
  return length;
}

/** Publish with a link so an acquired artifact is never replaced, even by concurrent callers. */
export async function downloadHttpFile(url: string, destination: string, options: HttpDownloadOptions): Promise<{ bytes: number; response: Response }> {
  const context = downloadContext(), retained = context?.retainPartial === true;
  if (context) options = { ...options, signal: options.signal ? AbortSignal.any([options.signal, context.signal]) : context.signal };
  options.signal?.throwIfAborted();
  const attempts = options.attempts ?? 3;
  if (!Number.isSafeInteger(options.byteLimit) || options.byteLimit < 1 || !Number.isSafeInteger(attempts) || attempts < 1 || attempts > 3)
    throw new TypeError('Downloads require a positive byte limit and one to three attempts.');
  if (options.expectedBytes !== undefined && (!Number.isSafeInteger(options.expectedBytes) || options.expectedBytes < 1 || options.expectedBytes > options.byteLimit))
    throw new TypeError('Expected download bytes must fit the byte limit.');
  for (const timeout of [options.timeoutMs, options.idleTimeoutMs]) if (timeout !== undefined && (!Number.isSafeInteger(timeout) || timeout < 1))
    throw new TypeError('Download timeouts must be positive milliseconds.');
  const directory = retained ? undefined : await mkdtemp(join(dirname(destination), '.transfer-'));
  const partial = retained ? `${destination}.download.partial` : join(directory!, 'download.partial'), checkpoint = `${partial}.json`;
  const identity = JSON.stringify({ url, byteLimit: options.byteLimit, expectedBytes: options.expectedBytes });
  let published = false;
  try {
    const file = await (retained ? open(partial, 'r+').catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return open(partial, 'wx', 0o600); throw error; }) : open(partial, 'wx', 0o600));
    let bytes = 0, total: number | undefined, canResume = false, validator: string | null = null;
    try {
    if (retained) {
      const saved = await readFile(checkpoint, 'utf8').catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return undefined; throw error; });
      if (saved !== undefined) {
        const record = requireRecord(JSON.parse(saved));
        if (record.identity !== identity) throw new Error('Partial download belongs to another acquisition.');
        bytes = (await stat(partial)).size;
        if (typeof record.total === 'number' && Number.isSafeInteger(record.total) && record.total > bytes && record.total <= options.byteLimit) total = record.total;
        canResume = record.canResume === true && total !== undefined && bytes > 0;
        validator = typeof record.validator === 'string' ? record.validator : null;
      }
    }
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (attempt > 1) await delay((options.backoffMs ?? 1000) * 2 ** (attempt - 2), undefined, { signal: options.signal });
      options.signal?.throwIfAborted();
      const offset = canResume ? bytes : 0, headers = new Headers(options.headers);
      headers.set('accept-encoding', 'identity');
      if (offset) { headers.set('range', `bytes=${offset}-`); if (validator) headers.set('if-range', validator); }
      else { await file.truncate(0); bytes = 0; headers.delete('range'); }
      const clock = transferClock(options);
      let response: Response | undefined;
      try {
        try { response = await clock.wait((options.fetcher ?? fetch)(url, { headers, signal: clock.signal }, clock.waitForBackoff)); }
        catch (error) { throw new DownloadInterruptedError(bytes, total, attempt, error); }
        if (TRANSIENT_STATUSES.has(response.status)) throw new DownloadInterruptedError(bytes, total, attempt, `Archive answered HTTP ${response.status}.`);
        if (!response.ok) throw new TransferContractError(`Download answered HTTP ${response.status} without usable content.`);
        options.validateResponse?.(response);
        if (!response.body) throw new TransferContractError(`Download answered HTTP ${response.status} without usable content.`);
        const length = contentLength(response, options.allowRawEncoding ?? false);
        if (offset && response.status === 206) {
          const range = /^bytes (\d+)-(\d+)\/(\d+)$/u.exec(response.headers.get('content-range') ?? '');
          if (!range || Number(range[1]) !== offset || Number(range[2]) < offset || Number(range[2]) + 1 !== Number(range[3]) ||
            Number(range[3]) !== total || (length !== undefined && length !== Number(range[3]) - offset) ||
            (response.headers.has('content-encoding') && !options.allowRawEncoding)) {
            canResume = false; await file.truncate(0); bytes = 0;
            if (attempt === attempts) throw new DownloadInterruptedError(bytes, total, attempt, 'Archive returned an inconsistent Content-Range.');
            continue;
          }
        } else {
          if (response.status === 206) throw new TransferContractError('Unrequested partial download response.');
          await file.truncate(0); bytes = 0; total = length;
          canResume = response.headers.get('accept-ranges')?.toLowerCase() === 'bytes' && total !== undefined &&
            (!response.headers.has('content-encoding') || Boolean(options.allowRawEncoding));
          validator = response.headers.get('etag');
          if (validator?.startsWith('W/')) validator = null;
          validator ??= response.headers.get('last-modified');
        }
        if (total !== undefined && total > options.byteLimit) throw new TransferContractError('Download byte limit exceeded.');
        if (retained) await writeFile(checkpoint, JSON.stringify({ identity, total, canResume, validator }));
        if (context) reportDownloadProgress({ received: bytes, total });
        const reader = response.body.getReader();
        try {
          for (;;) {
            const chunk = await clock.wait(reader.read()).catch((error: unknown) => { throw new DownloadInterruptedError(bytes, total, attempt, error); });
            if (chunk.done) break;
            if (chunk.value.byteLength) clock.received();
            if (bytes + chunk.value.byteLength > options.byteLimit) throw new TransferContractError('Download byte limit exceeded.');
            let written = 0;
            while (written < chunk.value.byteLength) {
              const result = await file.write(chunk.value, written, chunk.value.byteLength - written, bytes + written);
              if (!result.bytesWritten) throw new Error('Download file write made no progress.');
              written += result.bytesWritten;
            }
            bytes += written; options.report?.(bytes);
            if (context) reportDownloadProgress({ received: bytes, total });
          }
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
        if (!bytes || total !== undefined && total !== bytes) throw new DownloadInterruptedError(bytes, total, attempt, 'Incomplete download Content-Length.');
        if (options.expectedBytes !== undefined && options.expectedBytes !== bytes) throw new TransferContractError(`Download is ${bytes} bytes; expected ${options.expectedBytes}.`);
        options.signal?.throwIfAborted();
        await file.sync(); await link(partial, destination); published = true;
        if (context) reportDownloadProgress({ received: bytes, total, checking: true });
        return { bytes, response };
      } catch (error) {
        options.signal?.throwIfAborted();
        if (!(error instanceof DownloadInterruptedError) || attempt === attempts) throw error;
      } finally { clock.stop(); await response?.body?.cancel().catch(() => {}); }
    }
    throw new Error('Download attempts ended without a result.');
    } finally { await file.close(); }
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
    else if (published) { await rm(partial, { force: true }); await rm(checkpoint, { force: true }); }
  }
}
