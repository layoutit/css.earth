// What the router reads from the object registry and the world summary. A cold page imports it once its first body
// has mounted (`scene-router.mts`), so the globe's textures do not share the connection with the whole universe.
export { SCENE_OBJECTS } from '../objects.mts';
export { createPreparedWorldNavigation } from '../prepared-world-navigation.mts';
export { mountObjectShell } from '../object-shell-client.mts';
export { createSceneActivation } from './scene-activation.mts';
export { createSceneSelection, selectionTargetFromUrl } from './scene-selection.mts';
export { resolveNavigation } from '../navigation/navigation-request.mts';
export { watchOverviewSelection } from '../overview-selection.mts';
export { SYSTEM_CENTERS, loadSystemView, systemViewLoaded } from '../system-framing.mts';
