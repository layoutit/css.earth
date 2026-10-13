/** Discovery and delivery admit the same checkout or user-owned artifact paths, including their real locations. */
import { realpath } from 'node:fs/promises';
import { isAbsolute, relative } from 'node:path';
import { USER_ROOT } from '@cssearth/telescope-core/node';
import { inputPath } from '../paths.mts';

export function relativeFile(root: string, file: string): string {
  const path = relative(root, inputPath(root, file));
  if (!path || path === '..' || path.startsWith('../') || isAbsolute(path)) throw new Error(`Artifact is outside the repository: ${file}`);
  return path;
}
/** Cached artifacts may belong to the user root while discovery reads the checkout. Preserve each output tree. */
export function artifactFile(root: string, file: string, userRoot = USER_ROOT): string {
  try { return relativeFile(root, file); }
  catch (error) {
    try { return `user/${relativeFile(userRoot, file)}`; }
    catch { throw error; }
  }
}
export async function admittedArtifactFile(root: string, file: string): Promise<string> {
  const realRoot = await realpath(root), realUserRoot = await realpath(USER_ROOT).catch(() => USER_ROOT);
  artifactFile(realRoot, await realpath(inputPath(root, file)), realUserRoot);
  return artifactFile(root, file);
}
