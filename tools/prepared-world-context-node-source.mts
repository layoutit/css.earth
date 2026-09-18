import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot } from './project-root.mts';

/**
 * Node-only: reads the checked-in prepared world context straight off disk,
 * resolved against the discovered project root rather than the caller's own
 * (possibly relocated) module URL. Reached only from the `file:`-protocol
 * branch of `site/world-context-plan.mts`, which a real browser never takes;
 * kept in its own module so a static `node:` import never becomes part of the
 * client bundle's closure.
 */
export async function readNodeWorldContext(fromUrl: string | URL): Promise<unknown> {
  const path = resolve(projectRoot(fromUrl), 'src/objects/sun/prepared/world-context.json');
  return (await import(/* @vite-ignore */ pathToFileURL(path).href, { with: { type: 'json' } })).default;
}
