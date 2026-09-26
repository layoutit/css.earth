/** Lab validation and URL binding for the generic retained shape scene. */
import { createShapeCloudViewer as createScene, type ShapeCloudViewerOptions as SceneOptions,
  type ShapeCloudViewer } from '@cssearth/volume-viewer/scene/shape-cloud-viewer';
import type { PreparedCssVolume, VolumeCameraPublication } from '@cssearth/renderer/volume/types.ts';
import type { ShapeCloudResult } from '../../features/shape-cloud/types.ts';
import { readShapeCloudResult } from '../../features/shape-cloud/result.ts';
import { volumeRenderer } from './volume-renderer';
import { assertSharedGeometry } from './shape-cloud-renderer-validation';
import '@cssearth/renderer/styles/volume.css';
export type { ShapeCloudViewer } from '@cssearth/volume-viewer/scene/shape-cloud-viewer';
export interface ShapeCloudViewerOptions extends Omit<SceneOptions<PreparedCssVolume, VolumeCameraPublication>, 'backend' | 'resolvePath' | 'result'> {
  result: ShapeCloudResult; resolvePath?: (path: string) => string;
}
declare const __NEBULA_REPO_ROOT__: string;
const localPath = (path: string): string => `/@fs${__NEBULA_REPO_ROOT__.replace(/\/$/, '')}/${path}`;
const backend = { ...volumeRenderer, readResult: readShapeCloudResult, assertSharedGeometry };
export function createShapeCloudViewer(options: ShapeCloudViewerOptions): Promise<ShapeCloudViewer> {
  return createScene({ ...options, backend, resolvePath: options.resolvePath === undefined ? localPath : options.resolvePath });
}
