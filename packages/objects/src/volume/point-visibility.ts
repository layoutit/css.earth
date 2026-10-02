/** Projected-radius thresholds for prepared content that stands for a whole volume. */
export interface PreparedPointVisibility {
  readonly hiddenBelowRadiusPixels: number;
  readonly fullAboveRadiusPixels: number;
}

export const DEFAULT_POINT_VISIBILITY: PreparedPointVisibility = Object.freeze({ hiddenBelowRadiusPixels: 2, fullAboveRadiusPixels: 24 });
