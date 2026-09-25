import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

/** Hex SHA-256 of bytes or text: the one digest every pin in this repository uses. */
export const sha256 = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** The same digest of a file, read in chunks so a large archive product is never held in memory whole. */
export async function sha256File(path: string): Promise<{ sha256: string; bytes: number }> {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(path, { highWaterMark: 8 << 20 })) { hash.update(chunk as Buffer); bytes += (chunk as Buffer).length; }
  return { sha256: hash.digest('hex'), bytes };
}
