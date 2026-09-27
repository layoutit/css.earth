/**
 * Project an object's encounter-image landmarks onto its shape model through the fitted image-control stages. The work is
 * `projectEncounterLandmarks` in `@cssearth/bake/objects/surface-features`.
 *
 *   node packages/bake/cli/project-encounter-landmarks.mts <objectId> [--write]
 */
import { pathToFileURL } from 'node:url';
import { projectEncounterLandmarks } from '@cssearth/bake/objects/surface-features';

const [objectId, ...arguments_] = process.argv.slice(2);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!objectId || arguments_.some(argument => argument !== '--write')) throw new Error('Usage: project-encounter-landmarks.mts <objectId> [--write]');
  await projectEncounterLandmarks(objectId, arguments_.includes('--write'));
}
