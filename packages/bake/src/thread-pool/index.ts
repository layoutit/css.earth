/**
 * `@cssearth/bake/thread-pool` (Node only), imported for its side effect. libuv's thread pool, where sharp encodes,
 * defaults to 4 threads whatever the machine has. It is sized when the pool first starts, so a command imports this entry
 * before any other bake entry and it sizes the pool to the cores (up to 8): the lighting rows, texture levels and
 * thumbnails then encode at once instead of four at a time.
 */
import { availableParallelism } from 'node:os';
process.env.UV_THREADPOOL_SIZE ??= String(Math.max(4, Math.min(8, availableParallelism())));
