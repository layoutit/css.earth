import { open, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { parser } from 'stream-json/parser.js';
import Assembler from 'stream-json/assembler.js';
import { errorMessage, recordOf } from './trace-model.mts';

export interface LoadedTrace {
  path: string; bytes: number; decodedBytes: number; compressed: boolean;
  /** Parsed trace events, unchanged. Consumers check each event before use. */
  events: unknown[];
  sha256: string;
}

// FrameSleuth's analysis consumes parsed events. Stream its input so a valid
// long recording does not require a single string beyond V8's ~512 MiB limit.
// Preserve every event and hash the original bytes, including gzip framing.
export async function loadTrace(path: string, { highWaterMark = 64 * 1024 }: { highWaterMark?: number } = {}): Promise<LoadedTrace> {
  const absolutePath = resolve(path), info = await stat(absolutePath);
  const handle = await open(absolutePath, 'r'), header = Buffer.alloc(2);
  try { await handle.read(header, 0, 2, 0); } finally { await handle.close(); }
  const compressed = header[0] === 0x1f && header[1] === 0x8b;
  const sourceHash = createHash('sha256');
  const source = createReadStream(absolutePath, { highWaterMark });
  source.on('data', (chunk: string | Buffer) => { sourceHash.update(chunk); });
  const gunzip = compressed ? createGunzip() : undefined, decoded = gunzip ?? source;
  let decodedBytes = 0, parsed: unknown;
  decoded.on('data', (chunk: Buffer) => { decodedBytes += chunk.byteLength; });
  const tokens = parser.asStream({ streamKeys: false, streamStrings: false, streamNumbers: false });
  const assembler = Assembler.connectTo(tokens);
  try {
    if (gunzip) await pipeline(source, gunzip, tokens); else await pipeline(source, tokens);
    parsed = assembler.current;
  } catch (error) {
    throw new Error(`Cannot decode trace ${absolutePath}: ${errorMessage(error)}`, { cause: error });
  } finally { source.destroy(); decoded.destroy(); }
  const events = Array.isArray(parsed) ? parsed : recordOf(parsed)?.traceEvents;
  if (!Array.isArray(events)) throw new Error(`Trace ${absolutePath} does not contain a traceEvents array.`);
  return { path: absolutePath, bytes: info.size, decodedBytes, compressed, events, sha256: sourceHash.digest('hex') };
}
