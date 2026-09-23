import type { BrowserWindow, ShellCamera, PlaybackState } from './browser-types.mts';
import type { NavigationContent } from './navigation-content.mts';
import type { ObjectEntry } from './object-schema.mts';
import type { SceneOverview, SceneSubject, SelectionTarget } from './scene-selection.mts';
import type { WorldCameraPose } from '../src/renderers/css/navigation/world-camera.js';
import type { PreparedDestinationRuntime, SurfaceFeatureNavigationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';

export interface ShellSettingsOptions {
  motionEnabled: boolean;
  onMotionChange(enabled: boolean): void;
  heliosphereEnabled: boolean;
  onHeliosphereChange(enabled: boolean): void;
  illustrationModelsEnabled: boolean;
  onIllustrationModelsChange(enabled: boolean): void;
  surfaceLabelsEnabled: boolean;
  onSurfaceLabelsChange(enabled: boolean): void;
  minimapEnabled: boolean;
  onMinimapChange(enabled: boolean): void;
  threeDStarsEnabled: boolean;
  onThreeDStarsChange(enabled: boolean): void;
}

export interface ShellOptions extends Partial<ShellSettingsOptions> {
  objectId: string;
  readSelection(): SceneSubject;
  documentTarget?: Document;
  windowTarget?: BrowserWindow;
  onCategoryChange?(classification: string | null): void;
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
  setDestinations(provider: PreparedDestinationRuntime | null | undefined): void;
  selectPlace(id: string): Promise<void>;
  setFeatures(provider: SurfaceFeatureNavigationRuntime | null | undefined): void;
  presentSelection(): void;
  setCamera(provider: ShellCamera | null): void;
  setMotionEnabled(enabled: boolean): void;
  setPlaybackState(state: PlaybackState): void;
  setNavigationInFlight(active: boolean): void;
  destroy(): void;
}
