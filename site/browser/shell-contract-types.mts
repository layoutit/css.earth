export type SceneState = "loading" | "ready" | "error" | "destroyed";
export interface AutomaticPlaybackInput {
  sceneState: SceneState;
  motionRequested: boolean;
  /** The Light curves setting: pulsating stars play regardless of illustrative rotation. */
  lightCurvesRequested: boolean;
  documentHidden: boolean;
  reducedMotion: boolean;
}
export interface AutomaticPlaybackPolicy {
  readonly allowed: boolean;
  readonly reason: "unavailable" | "motion-off" | "hidden" | "reduced-motion" | "allowed";
  /** Whether light curves play: the same scene, visibility and reduced-motion gates, with their own setting. */
  readonly lightCurves: boolean;
}
