import { projectRoot } from '@cssearth/core/node';
import { resolve } from 'node:path';

/** Paths written into source records and generated outputs share the real checkout root. */
export function authorPath(...parts: string[]): string {
  return resolve(projectRoot(import.meta.url), ...parts);
}
