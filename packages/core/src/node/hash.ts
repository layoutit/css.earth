import { createHash } from 'node:crypto';

/** Hex SHA-256 of bytes or text: the content address of a published runtime asset (`runtime-assets/<sha256>/<file>`),
 * which the object's `inventory.json` records. No other file in the repository carries a hash. */
export const sha256 = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
