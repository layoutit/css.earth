import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord, requireString } from '@cssearth/core';

export async function readToolchainDescriptor(directory: string) {
  const text = await readFile(resolve(directory, 'toolchain.json'), 'utf8');
  const entry = requireRecord(JSON.parse(text) as unknown, 'toolchain.json');
  const lock = await readFile(resolve(directory, requireString(entry.requirements)), 'utf8');
  return { entry, lock, digest: createHash('sha256').update(text).update(lock).digest('hex') };
}
