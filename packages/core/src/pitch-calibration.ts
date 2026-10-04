/** Structural pitch calibration shared by authored camera records and navigation. */
export interface PitchCalibration {
  defaultControlPitchDegrees: number;
  maximumControlPitchDegrees: number;
  initialScenePitchDegrees: number;
  maximumScenePitchDegrees: number;
}
