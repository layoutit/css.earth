// What the router reads from the object directory and the world summary. A cold page starts loading it at boot
// (`startup-boot.mts`); the router waits for it only once its first body has mounted (`scene-router.mts`).
export { SCENE_OBJECTS, knownObject, loadObject } from '../object-directory.mts';
export { WORLD_OBJECTS } from '../world-objects.mts';
export { createPreparedWorldNavigation } from '../prepared-world-navigation.mts';
export { mountObjectShell } from '../shell/object-shell-client.mts';
export { createSceneActivation } from './scene-activation.mts';
export { createSceneSelection, selectionTargetFromUrl } from './scene-selection.mts';
export { resolveNavigation } from '../navigation/navigation-request.mts';
export { watchOverviewSelection } from '../overview-selection.mts';
export { SYSTEM_CENTERS, loadSystemView, systemViewLoaded } from '../system-framing.mts';
export { createShowcaseController } from '../showcase.mts';
