import type { WorldPreferences } from './world-preferences.mts';
import type { BrowserWindow, ShellCamera, PlaybackState } from './browser-types.mts';
import type { NavigationContent } from './navigation/navigation-content.mts';
import type { ObjectEntry } from './object-schema.mts';
import type { SceneOverview, SceneSubject, SelectionTarget } from './scene/scene-selection.mts';
import type { WorldCameraPose } from '../src/renderers/css/navigation/world-camera.js';
import type { DestinationPresentation } from './destination-browser.mts';

export interface ShellOptions {
  objectId: string;
  readSelection(): SceneSubject;
  preferences: WorldPreferences;
  onResetDestination?(): void;
  /** Whether the app can fly to the object `id` in place; links to it prefetch its fragment on intent. */
  navigable(id: string): boolean;
  /** Start loading what a flight to `id` reads besides its card: its object entry and system view. */
  prefetch(id: string): void;
  documentTarget?: Document;
  windowTarget?: BrowserWindow;
}

export type ShellNavigationTarget =
  | { kind: 'object'; object: ObjectEntry; targetWorldCamera?: WorldCameraPose }
  | { kind: 'overview'; overview: SceneOverview; preview: boolean };

export interface ShellNavigationTransition {
  /** Publish the arriving selection while its camera can still be in flight. */
  arrive(selection: { subject: SelectionTarget; content?: NavigationContent }): void;
  /** Roll back an unarrived preview and release the card's flight lock. */
  dispose(): void;
}

/** Retained shell capabilities used by scene sessions and navigation. */
export interface ObjectShell {
  showDataset(): void;
  setDatasetNotice(message: string | null): void;
  beginNavigation(target: ShellNavigationTarget): ShellNavigationTransition | null;
  setObject(content: NavigationContent): void;
  presentDestination(value: DestinationPresentation | null): void;
  presentSelection(): void;
  setCamera(provider: ShellCamera | null): void;
  setPlaybackState(state: PlaybackState): void;
  setNavigationInFlight(active: boolean): void;
  destroy(): void;
}
