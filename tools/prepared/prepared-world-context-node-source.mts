import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot } from '../cli/project-root.mts';

/**
 * Node-only: the `file:` URL of a checked-in project file, resolved against the
 * discovered project root rather than the caller's own (possibly relocated)
 * module URL. Reached only from the `file:`-protocol branch of
 * `site/world-context-plan.mts`, which a real browser never takes. That caller
 * keeps the JSON-attributed import itself; this module only locates the file,
 * and lives apart so its `node:` imports stay out of the client module graph.
 */
export function nodeProjectFileUrl(fromUrl: string | URL, path: string): string {
  return pathToFileURL(resolve(projectRoot(fromUrl), path)).href;
}
