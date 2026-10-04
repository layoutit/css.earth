import { projectRoot } from '@cssearth/core/node';
import { resolve } from 'node:path';

/** Resolve this preparation owner's paths independently of the caller's working directory. */
export function shapeMaterialPath(...parts: string[]): string {
  return resolve(projectRoot(import.meta.url), ...parts);
}
