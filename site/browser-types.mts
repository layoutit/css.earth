import type { ObjectSceneLifecycle } from '../src/renderers/css/runtime/object-scene.js';
import type { ObjectMountOptions } from '../src/renderers/css/runtime/object-runtime-types.js';
import type { createPreparedObjectNavigation } from '../src/renderers/css/runtime/prepared-object-navigation.js';
export type BrowserWindow = Window & typeof globalThis;
export type MountOptions = Omit<ObjectMountOptions, 'runtimePolicy' | 'inputSurface'>;
export type SceneFactory = ((stage: HTMLElement, options: MountOptions) => ObjectSceneLifecycle) & {
  navigation?: ReturnType<typeof createPreparedObjectNavigation> | null;
};
export const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function requiredElement<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing shell element: ${selector}.`);
  return element;
}
export type ShellCamera = Pick<ObjectSceneLifecycle, 'navigation' | 'sharedView'>;
export interface PlaybackState { readonly allowed: boolean; readonly reason: string; readonly motionRequested?: boolean; }
