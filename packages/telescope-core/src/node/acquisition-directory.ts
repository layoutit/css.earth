/** A caller-owned acquisition scope; library callers keep their existing cache policy. */
import { AsyncLocalStorage } from 'node:async_hooks';
import { resolve } from 'node:path';

const directories = new AsyncLocalStorage<{ directory: string; workingDirectory: string }>();
export const acquisitionDirectory = (): string | undefined => directories.getStore()?.directory;
export const acquisitionWorkingDirectory = (): string | undefined => directories.getStore()?.workingDirectory;
export function withAcquisitionDirectory<T>(directory: string, work: () => T, workingDirectory = directory): T {
  return directories.run({ directory: resolve(directory), workingDirectory: resolve(workingDirectory) }, work);
}
