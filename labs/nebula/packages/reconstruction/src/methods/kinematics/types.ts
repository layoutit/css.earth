export interface KinematicParameters { radiusArcsec: number; inclinationDegrees: number; depthRatio: number; expansionKmS: number }
export interface CalibrationAnchor { pixel: number; value: number }
export interface SlitEvidence {
  schema: 'cssearth-slit-evidence@1'; id: string; title: string;
  citation: { label: string; url: string; pdfUrl: string; sourceUrl: string; sourceArchiveSha256: string; member: string; memberSha256: string; figureSha256: string };
  figure: { width: number; height: number; cachePath: string; extraction: string; pixelConvention: string;
    offsetCalibration: [CalibrationAnchor, CalibrationAnchor]; velocityCalibration: [CalibrationAnchor, CalibrationAnchor];
    readoutUncertaintyPixels: number; readoutNote: string };
  slit: { direction: string; offsetUnit: 'arcsec'; velocityUnit: 'km/s'; velocityFrame: 'heliocentric'; positiveVelocity: 'receding';
    lengthArcsec: number; widthArcsec: number; integrationSeconds: number; spatialBinArcsec: number; instrumentalWidthKmS: number; instrumentNote: string };
  systemic: { valueKmS: number; uncertaintyKmS: number; source: string };
  defaults: KinematicParameters; defaultEvidence: string[]; limitations: string[];
  textCrossCheck: { offsetArcsec: number; velocitiesHeliocentricKmS: number[]; source: string };
  samples: { id: string; pixelX: number; pixelY: number }[];
}
export interface VelocityPoint { id: string; offsetArcsec: number; heliocentricKmS: number; relativeKmS: number; cx: number; cy: number }
export interface PreparedKinematics {
  schema: 'cssearth-kinematics-comparison@1'; evidenceSha256: string; evidence: SlitEvidence; parameters: KinematicParameters;
  chart: { width: number; height: number; left: number; right: number; top: number; bottom: number;
    xTicks: { value: number; position: number }[]; yTicks: { value: number; position: number }[];
    systemicBandTop: number; systemicBandHeight: number; zeroY: number; zeroX: number;
    points: VelocityPoint[]; approachingPath: string; recedingPath: string };
  metrics: { nearestSurfaceRmsKmS: number | null; comparedPoints: number; outsideProjectedShell: number;
    centralApproachingKmS: number; centralRecedingKmS: number; offsetReadoutArcsec: number; velocityReadoutKmS: number };
}
