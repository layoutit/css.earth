import { createHash } from 'node:crypto';

/** Hex SHA-256 of bytes or text: the one digest every pin in this repository uses. */
export const sha256 = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
