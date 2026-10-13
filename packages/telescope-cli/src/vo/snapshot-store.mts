/** Publish complete immutable discovery evidence only when a plan retains products. */
import { randomBytes, randomUUID } from 'node:crypto';
import { link, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { USER_ROOT } from '@cssearth/telescope-core/node';
import { canonical, type DiscoverySnapshot, type Pin } from '@cssearth/objects';

export type SnapshotPublisher = () => Promise<Pin>;

export function snapshotPublisher(snapshot: DiscoverySnapshot): SnapshotPublisher {
  let pending: Promise<Pin> | undefined;
  return () => pending ??= publish(snapshot);
}

async function publish(snapshot: DiscoverySnapshot): Promise<Pin> {
  const text = canonical(snapshot), bytes = Buffer.byteLength(text);
  const directory = resolve(USER_ROOT, 'output/telescopes/vo/metadata');
  const response = basename(snapshot.response.raw.path).replace(/\.xml$/iu, '')
    .replace(/[^a-z0-9_-]+/giu, '-').replace(/^-+|-+$/gu, '').slice(0, 120) || 'response';
  const timestamp = new Date().toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z');
  await mkdir(directory, { recursive: true });
  const temporary = resolve(directory, `${randomUUID()}.pending`);
  try {
    await writeFile(temporary, text, { flag: 'wx' });
    for (;;) {
      const path = resolve(directory, `${response}-${timestamp}-${randomBytes(6).toString('hex')}.snapshot.json`);
      try {
        // Exclusive linking exposes complete bytes atomically, including between processes.
        await link(temporary, path);
        return { path, bytes };
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
      }
    }
  } finally {
    await rm(temporary, { force: true });
  }
}
