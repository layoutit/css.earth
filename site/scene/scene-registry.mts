// What the router reads from the object directory and the world summary. A cold page starts loading it at boot
// (`startup-boot.mts`); the router waits for it only once its first body has mounted (`scene-router.mts`).
export { SCENE_OBJECTS, knownObject, loadObject } from '../directory/object-directory.mts';
export { WORLD_OBJECTS } from '../world/world-objects.mts';
export { createPreparedWorldNavigation } from '../navigation/prepared-world-navigation.mts';
export { mountObjectShell } from '../shell/object-shell-client.mts';
export { createSceneActivation } from './scene-activation.mts';
export { createSceneSelection, selectionTargetFromUrl } from '../selection/scene-selection.mts';
export { resolveNavigation } from '../navigation/navigation-request.mts';
export { watchCameraSelection } from '../selection/overview-selection.mts';
export { SYSTEM_CENTERS, loadSystemView, systemViewLoaded } from '../world/system-framing.mts';
export { createShowcaseController } from '../selection/showcase.mts';
