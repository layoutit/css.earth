import type { LensControl, SettingControl } from "../src/renderers/css/runtime/object-contract.js";
import type { ObjectSceneLifecycle } from "../src/renderers/css/runtime/object-scene.js";

// The shell checks this lifecycle shape. The renderer supplies the complete
// scene contract, including shared-view and navigation capabilities.
export type SceneLifecycle = Pick<ObjectSceneLifecycle, "pause" | "resume" | "destroy"> & {
  readonly ready: PromiseLike<unknown>;
};

// Shell content validation checks IDs and live control values. Lens labels,
// presentation fields and cycle-state tables belong to their owning validators.
type ShellSettingControl = Extract<SettingControl, { kind: "toggle" }>
  | Omit<Extract<SettingControl, { kind: "cycle" }>, "states">;

export interface ShellObjectControls {
  readonly lenses: {
    readonly defaultLens?: unknown;
    readonly controls: readonly Pick<LensControl, "id">[];
  } | null | undefined;
  readonly settings: {
    readonly controls: readonly ShellSettingControl[];
  } | null | undefined;
}

export type SceneState = "loading" | "ready" | "error" | "destroyed";
export interface AutomaticPlaybackInput {
  sceneState: SceneState;
  motionRequested: boolean;
  documentHidden: boolean;
  reducedMotion: boolean;
}
export interface AutomaticPlaybackPolicy {
  readonly allowed: boolean;
  readonly reason: "unavailable" | "motion-off" | "hidden" | "reduced-motion" | "allowed";
}
