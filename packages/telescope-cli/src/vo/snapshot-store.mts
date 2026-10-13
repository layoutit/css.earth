/** Publish complete immutable discovery evidence only when a plan retains products. */
import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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
  const path = resolve(directory, `${createHash('sha512').update(text).digest('hex')}.snapshot.json`);
  const identical = async () => {
    const existing = await readFile(path, 'utf8').catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (existing === null) return false;
    if (existing !== text) throw new Error('Stored discovery snapshot differs from its content address.');
    return true;
  };
  if (await identical()) return { path, bytes };
  await mkdir(directory, { recursive: true });
  const temporary = resolve(directory, `${randomUUID()}.pending`);
  try {
    await writeFile(temporary, text, { flag: 'wx' });
    // Exclusive linking exposes complete bytes atomically, including between processes.
    await link(temporary, path).catch(async error => {
      if (error.code !== 'EEXIST') throw error;
      if (!await identical()) throw new Error('Discovery snapshot disappeared during publication.');
    });
  } finally {
    await rm(temporary, { force: true });
  }
  return { path, bytes };
}
