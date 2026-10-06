/** Commit-addressed, fail-closed base evidence. The validity manifest is always written last. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { rename, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { array, files, number, record, string } from './records.mts';
const execute = promisify(execFile);
export interface CacheIdentity { commit: string; toolchain: unknown; lockfile: Buffer }
export const cacheKey = (commit: string): string => {
  if (!/^[a-f0-9]{40}$/u.test(commit)) throw new Error('Invalid base commit');
  return `site-base-v1-${commit}`;
};
export async function fingerprint(path: string): Promise<{ bytes: number; md5: string }> {
  const hash = createHash('md5'); let bytes = 0;
  for await (const chunk of createReadStream(path)) { bytes += chunk.length; hash.update(chunk); }
  return { bytes, md5: hash.digest('hex') };
}
const md5 = (value: Buffer): string => createHash('md5').update(value).digest('hex');
/** Required consumer roots prevent a self-consistent but incomplete manifest from qualifying. */
export async function requirePayload(root: string): Promise<void> {
  for (const path of ['base/dist/index.html', 'base/toolchain.json', 'base/build.json', 'base/pnpm-lock.yaml', 'performance/base/measures.json', 'performance/base.md', ...['preview', 'cloudflare'].map(target => `server-answers/base/${target}/index.json`)]) {
    if (!(await stat(join(root, path))).isFile() || !(await stat(join(root, path))).size) throw new Error(`Missing payload: ${path}`);
  }
  for (const folder of ['base/metadata', 'base/inventories']) if (!(await files(join(root, folder))).length) throw new Error(`Empty payload: ${folder}`);
  for (const target of ['preview', 'cloudflare']) {
    const folder = join(root, 'server-answers/base', target);
    const index = record(JSON.parse(await readFile(join(folder, 'index.json'), 'utf8')));
    if (index.target !== target || index.schema !== 3) throw new Error('Invalid recording index');
    const requests = array(index.requests).map(string);
    if (!requests.length || new Set(requests).size !== requests.length) throw new Error('Empty or duplicate recording requests');
    for (const name of requests) {
      if (!/^[\w-]+$/u.test(name)) throw new Error('Unsafe request id');
      record(JSON.parse(await readFile(join(folder, `${name}.json`), 'utf8')));
    }
  }
  record(JSON.parse(await readFile(join(root, 'performance/base/measures.json'), 'utf8')));
}
export async function sealCache(root: string, identity: CacheIdentity): Promise<void> {
  cacheKey(identity.commit);
  await rm(join(root, 'validity.json'), { force: true });
  await requirePayload(root);
  const entries = [];
  for (const path of await files(root)) entries.push({ path, ...await fingerprint(join(root, path)) });
  await writeFile(join(root, 'validity.json'), JSON.stringify({ schema: 1, commit: identity.commit, toolchain: identity.toolchain, lockfileMd5: md5(identity.lockfile), files: entries }));
}
export async function validateCache(root: string, identity: CacheIdentity): Promise<void> {
  const manifest = record(JSON.parse(await readFile(join(root, 'validity.json'), 'utf8')));
  if (manifest.schema !== 1 || manifest.commit !== identity.commit) throw new Error('Wrong cache commit/schema');
  if (JSON.stringify(manifest.toolchain) !== JSON.stringify(identity.toolchain)) throw new Error('Wrong cache toolchain');
  if (manifest.lockfileMd5 !== md5(identity.lockfile) || !(await readFile(join(root, 'base/pnpm-lock.yaml'))).equals(identity.lockfile)) throw new Error('Wrong cache lockfile');
  const entries = array(manifest.files).map(record);
  const paths = entries.map(entry => string(entry.path));
  if (JSON.stringify(paths) !== JSON.stringify((await files(root)).filter(path => path !== 'validity.json'))) throw new Error('Incomplete cache manifest');
  for (const entry of entries) {
    const actual = await fingerprint(join(root, string(entry.path)));
    if (actual.bytes !== number(entry.bytes) || actual.md5 !== string(entry.md5)) throw new Error(`Cache integrity failed: ${string(entry.path)}`);
  }
  await requirePayload(root);
  if (JSON.stringify(JSON.parse(await readFile(join(root, 'base/toolchain.json'), 'utf8'))) !== JSON.stringify(identity.toolchain)) throw new Error('Wrong payload toolchain');
}
export type CacheResult = { hit: boolean; reason: string };
/** Consumers never observe a partial restore; rejection always invokes the fresh path. */
export async function useCache(root: string, out: string, identity: CacheIdentity, fresh: () => Promise<void>): Promise<CacheResult> {
  try {
    await validateCache(root, identity);
    for (const path of ['base', 'server-answers/base', 'performance/base', 'performance/base.md']) {
      await mkdir(dirname(join(out, path)), { recursive: true });
      await rename(join(root, path), join(out, path));
    }
    return { hit: true, reason: 'hit: complete, commit/toolchain/lockfile and every byte validated' };
  } catch (error) {
    for (const path of ['base', 'server-answers/base', 'performance/base', 'performance/base.md']) await rm(join(out, path), { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
    await fresh();
    return { hit: false, reason: `miss/fallback: ${String(error)}` };
  }
}
export async function packCache(root: string, archive: string): Promise<number> {
  await execute('tar', ['-czf', archive, '-C', root, '.']);
  const bytes = (await stat(archive)).size;
  console.log(`BASE CACHE COMPRESSED BYTES: ${bytes}`);
  return bytes;
}
export async function unpackCache(archive: string, root: string): Promise<void> {
  await rm(root, { recursive: true, force: true }); await mkdir(root, { recursive: true });
  // Reject absolute/traversal members before extraction; files() rejects symlinks afterward.
  const types = (await execute('tar', ['-tvzf', archive], { maxBuffer: 32 * 1024 * 1024 })).stdout;
  if (types.trim().split('\n').some(line => !['-', 'd'].includes(line[0] ?? ''))) throw new Error('Cache archive contains a link or special file');
  const list = (await execute('tar', ['-tzf', archive], { maxBuffer: 32 * 1024 * 1024 })).stdout;
  if (list.split('\n').some(path => path.startsWith('/') || path.split('/').includes('..'))) throw new Error('Unsafe cache archive');
  await execute('tar', ['-xzf', archive, '-C', root]);
  await files(root);
}
