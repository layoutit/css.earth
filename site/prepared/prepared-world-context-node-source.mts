import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot } from '@cssearth/core/node';

/**
 * Node-only: the `file:` URL of a checked-in project file, resolved against the
 * discovered project root rather than the caller's own (possibly relocated)
 * module URL. Reached only from the `file:`-protocol branch of
 * `site/directory/world-context-plan.mts`, which a real browser never takes. It lives
 * apart so its `node:` imports stay out of the client module graph.
 */
export function nodeProjectFileUrl(fromUrl: string | URL, path: string): string {
  return pathToFileURL(resolve(projectRoot(fromUrl), path)).href;
}

/** Node-only: a checked-in project file's JSON. The import is JSON-attributed, so it can only yield data. */
export async function readProjectJson(fromUrl: string | URL, path: string): Promise<unknown> {
  return (await import(/* @vite-ignore */ nodeProjectFileUrl(fromUrl, path), { with: { type: 'json' } })).default;
}
