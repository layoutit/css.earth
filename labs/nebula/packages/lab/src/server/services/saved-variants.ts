/**
 * Named local variants for interactive caches. A variant directory is named once, at random, and keeps the
 * request it was made from in `request.json`; a later identical request finds it by structural comparison.
 * Nothing here fingerprints files or code: the saved request lists paths and settings only.
 */
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { isVariantName } from '../../features/variant-name.ts';
export { isVariantName, variantNamePattern } from '../../features/variant-name.ts';

/** The same request serialized the same way; key order is part of the request as its builder writes it. */
export const sameRequest = (saved: unknown, expected: unknown) => JSON.stringify(saved) === JSON.stringify(expected);

/** The existing variant under `directory` made from `request`, or null. `file` is the saved request's name. */
export async function findVariant(directory: string, request: unknown, file = 'request.json'): Promise<string | null> {
  const names = await readdir(directory).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return [] as string[]; throw error; });
  for (const name of names.filter(isVariantName).sort()) {
    const text = await readFile(resolve(directory, name, file), 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null; throw error;
    });
    if (text !== null && sameRequest(JSON.parse(text), request)) return name;
  }
  return null;
}

/** An existing variant for `request`, or a fresh random name for a new one. */
export async function variantFor(directory: string, request: unknown, file = 'request.json') {
  const existing = await findVariant(directory, request, file);
  return existing ? { name: existing, existing: true } : { name: randomUUID(), existing: false };
}
