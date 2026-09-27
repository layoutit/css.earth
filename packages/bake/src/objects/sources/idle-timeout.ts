import { PassThrough, Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/** Relays `source` through a fresh PassThrough, destroying it if no chunk arrives within `idleMs` of the last one
 * (or of the start). An idle timeout survives a slow-but-progressing transfer that a total timeout would kill, and
 * catches a stalled one before a total timeout generous enough for a large file would.
 *
 * Two things this must get right, both because of how `node:stream/promises`' `pipeline` (the real consumer, e.g.
 * inside publishPinnedSourceStream) behaves:
 * - It must consume `source` itself rather than attach the timer to `source` and hand it back: adding a 'data'
 *   listener switches a Readable into flowing mode immediately, and if `pipeline` attaches afterward, on a later
 *   tick, the chunks already delivered to that listener are lost — `pipeline` then sees an empty stream. Returning a
 *   separate stream that nothing has read from yet avoids that.
 * - The relay must be linked to `source` through `pipeline` (not a manual 'data' forward), so that if the real
 *   consumer destroys the relay (e.g. because a size limit was exceeded downstream), `source` — and, through
 *   `Readable.fromWeb`, the underlying WHATWG stream's `cancel()` — is destroyed too. An unbounded upstream that
 *   ignores that cancellation would otherwise keep enqueueing forever. */
export function withIdleTimeout(source: Readable, idleMs: number): Readable {
  // A minimal highWaterMark keeps this relay from buffering ahead of a downstream consumer that has stopped
  // reading (e.g. because it hit a size limit): the smaller the buffer, the sooner backpressure reaches `source`.
  const relay = new PassThrough({ highWaterMark: 0 });
  let timer: ReturnType<typeof setTimeout>;
  const reset = () => { clearTimeout(timer); timer = setTimeout(() => relay.destroy(new Error(`Idle timeout after ${idleMs}ms with no data.`)), idleMs); };
  const tracker = new Transform({ highWaterMark: 0, transform(chunk, _encoding, callback) { reset(); callback(null, chunk); } });
  reset();
  // Errors and cancellation surface to callers through `relay`'s own 'error'/'close' events (as any piped-into
  // stream would); this fire-and-forget pipeline only needs to exist for its bidirectional cleanup.
  pipeline(source, tracker, relay).catch(() => {}).finally(() => clearTimeout(timer));
  return relay;
}
