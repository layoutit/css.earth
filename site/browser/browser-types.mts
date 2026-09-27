import type { ObjectSceneLifecycle } from '@cssearth/renderer/runtime/object-scene.ts';
import type { ObjectMountOptions } from '@cssearth/renderer/runtime/object-runtime-types.ts';
import type { createPreparedObjectNavigation } from '@cssearth/renderer/runtime/prepared-object-navigation.ts';
export type BrowserWindow = Window & typeof globalThis;
export type MountOptions = Omit<ObjectMountOptions, 'runtimePolicy' | 'inputSurface' | 'worldContext'>;
export type SceneFactory = ((stage: HTMLElement, options: MountOptions) => ObjectSceneLifecycle) & {
  navigation?: ReturnType<typeof createPreparedObjectNavigation> | null;
};
export const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
export function requiredElement<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing shell element: ${selector}.`);
  return element;
}
export function setPanelHidden(panel: HTMLElement, hidden: boolean) {
  if (panel.hidden !== hidden) panel.hidden = hidden;
  // Loading gates belong to the card's individual controls, not its retained container.
  const inert = hidden;
  if (panel.hasAttribute('inert') !== inert) panel.toggleAttribute('inert', inert);
}

export type ShellCamera = Pick<ObjectSceneLifecycle, 'navigation' | 'sharedView'>;
export interface PlaybackState { readonly allowed: boolean; readonly reason: string; readonly motionRequested?: boolean; }

/** Shared link presentation publishes only changed selection state. */
export function setLinkSelected(anchor: Element, selected: boolean): void {
  if (anchor.classList.contains('is-active') !== selected) anchor.classList.toggle('is-active', selected);
  if (selected) {
    if (anchor.getAttribute('aria-current') !== 'page') anchor.setAttribute('aria-current', 'page');
  } else if (anchor.hasAttribute('aria-current')) anchor.removeAttribute('aria-current');
}
