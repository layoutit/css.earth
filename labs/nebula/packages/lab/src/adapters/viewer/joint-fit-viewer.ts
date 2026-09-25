/** Lab URL and renderer binding for the retained joint-fit scene. */
import { createJointFitViewer as createScene, type JointFitViewerOptions as SceneOptions,
  type JointFitViewer } from '@cssearth/volume-viewer/scene/joint-fit-viewer';
import type { JointVolumeResult } from '@cssearth/bake/volume';
import type { PreparedCssVolume, VolumeCameraPublication } from '../../../../../../../src/renderers/css/volume/types';
import { volumeRenderer } from './volume-renderer';
import '../../../../../../../src/renderers/css/styles/volume.css';
export { readJointVolumeResult } from '@cssearth/bake/volume';
export type { JointFitViewer } from '@cssearth/volume-viewer/scene/joint-fit-viewer';
export interface JointFitViewerOptions extends Omit<SceneOptions<PreparedCssVolume, VolumeCameraPublication>, 'backend' | 'resolvePath'> { resolvePath?: (path: string) => string }
declare const __NEBULA_REPO_ROOT__: string;
const localPath = (path: string): string => `/@fs${__NEBULA_REPO_ROOT__.replace(/\/$/, '')}/${path}`;
const backend = { ...volumeRenderer, assertIdentity(payload: PreparedCssVolume, result: JointVolumeResult) {
  if (payload.id !== `joint-fit-${result.id}` || JSON.stringify(payload.frame) !== JSON.stringify(result.frame))
    throw new TypeError('Prepared joint-fit volume belongs to a different result.');
} };
export function createJointFitViewer(options: JointFitViewerOptions): Promise<JointFitViewer> {
  return createScene({ ...options, backend, resolvePath: options.resolvePath === undefined ? localPath : options.resolvePath });
}
