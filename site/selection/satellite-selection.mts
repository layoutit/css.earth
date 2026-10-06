import type { WorldCameraPose } from '@cssearth/engine';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { ObjectEntry } from '../directory/objects.mts';
import { bodyViewAtCamera } from '../world/systems/zoom-scope.mts';
import { satelliteSystemByHost, satelliteSystemOfMember } from '../world/systems/satellite-systems.mts';
import type { SceneContext } from './scene-selection.mts';
import { moonSystem, starSystem, subjectHost, subjectOf } from '../world/systems/scene-subject.mts';

/** The selected body's own close-up leads into its nearest prepared satellite family. */
export function satelliteSelectionAtCamera(world: WorldCameraPose, optics: ReturnType<ObjectWorldNavigation['optics']>,
  objects: readonly Pick<ObjectEntry, 'id' | 'worldFrame'>[], selection: SceneContext): SceneContext | null {
  // A star's system is a step of the zoom out of the star (scene-selection.mts `followCamera`), not this hand-over.
  if (starSystem(selection)) return null;
  const id = subjectHost(selection), overview = moonSystem(selection);
  const family = satelliteSystemByHost(id) ?? satelliteSystemOfMember(id);
  if (!family) return null;
  const frame = objects.find(object => object.id === id)?.worldFrame;
  if (!frame) return null;
  const card = bodyViewAtCamera(world, frame, optics, id, overview ? 'overview' : 'detail');
  if (overview && card === 'detail') return { objectId: id };
  if (!overview && card === 'overview') return subjectOf(family.hostId, 'system');
  return null;
}
