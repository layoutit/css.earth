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
