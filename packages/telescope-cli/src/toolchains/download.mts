/** Keep managed archive downloads streamed, size-qualified and unpublished until complete. */
import { downloadHttpFile, toolchainInstallSignal } from '@cssearth/telescope-core/node';
import { randomUUID } from 'node:crypto';
import { link, rm, stat } from 'node:fs/promises';

export async function downloadToolchainArchive(url: string, target: string, bytes: number, fetcher: typeof fetch = fetch) {
  if (!Number.isSafeInteger(bytes) || bytes < 1) throw new TypeError('Invalid toolchain archive size.');
  const existing = await stat(target).catch(error => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing?.isFile() && existing.size === bytes) return target;
  if (existing) throw new Error(`${target} exists but is not its pinned ${bytes} bytes. Remove it before installing again.`);
  const temporary = `${target}.${randomUUID()}.partial`;
  try {
    await downloadHttpFile(url, temporary, { byteLimit: bytes, expectedBytes: bytes, fetcher, signal: toolchainInstallSignal() });
    // Linking, rather than renaming, refuses a destination acquired by another installer.
    await link(temporary, target);
    return target;
  } finally { await rm(temporary, { force: true }); }
}
