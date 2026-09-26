/** Lab host binding. The retained scene and its resource lifetime belong to volume-viewer. */
import { createCompilerViewer as createScene, type CompilerViewerOptions as SceneOptions,
  type CompilerViewer } from '@cssearth/volume-viewer/scene/compiler-viewer';
import type { PreparedCssVolume, VolumeCameraPublication } from '@cssearth/renderer/volume/types.ts';
import { compilerRenderer } from './compiler-renderer';
import '@cssearth/renderer/styles/volume.css';

export type { CompilerMaterial, CompilerViewer } from '@cssearth/volume-viewer/scene/compiler-viewer';
export interface CompilerViewerOptions extends Omit<SceneOptions<PreparedCssVolume, VolumeCameraPublication>, 'backend' | 'resolvePath'> {
  resolvePath?: (path: string) => string;
}
declare const __NEBULA_REPO_ROOT__: string;
const localPath = (path: string): string => `/@fs${__NEBULA_REPO_ROOT__.replace(/\/$/, '')}/${path}`;
export function createCompilerViewer(options: CompilerViewerOptions): Promise<CompilerViewer> {
  return createScene({ ...options, backend: compilerRenderer,
    resolvePath: options.resolvePath === undefined ? localPath : options.resolvePath });
}
