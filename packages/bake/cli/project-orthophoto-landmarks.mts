/**
 * Project an object's orthophoto landmarks through the fitted image-control stages. The work is
 * `projectOrthophotoLandmarks` in `@cssearth/bake/objects/surface-features`.
 *
 *   node packages/bake/cli/project-orthophoto-landmarks.mts <objectId> [--write]
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectOrthophotoLandmarks } from '@cssearth/bake/objects/surface-features';

async function main() {
  const [objectId, ...args] = process.argv.slice(2);
  if (!objectId || args.some((a) => a !== '--write'))
    throw new TypeError('Usage: project-orthophoto-landmarks.mts <objectId> [--write]');
  await projectOrthophotoLandmarks(objectId, args.includes('--write'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main();
