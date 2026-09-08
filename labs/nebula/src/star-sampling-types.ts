export interface SamplePoint { x: number; y: number; }
export interface SamplingControls { widthScale: number; amplitudeScale: number; betaOverride: number | null; }
export interface StarSample {
  accepted?: boolean; profileId?: string | null; reasons?: string[]; modelKind?: 'shared-profile-bank'; contributesProfile?: boolean;
  id: string; requestedPoint: SamplePoint; point: SamplePoint; inputPoint?: SamplePoint; qualified: boolean;
  cutout: { x: number; y: number; width: number; height: number };
  metrics: { fwhmPixels: number; fwhmMajorPixels: number; fwhmMinorPixels: number; ellipticity: number;
    coreRadiusPixels: number; haloRadiusPixels: number; backgroundRgb: number[]; saturatedPixels: number;
    neighborCount: number; fitRelativeRmse: number; confidence: number; flags: string[] };
  channels: { channel: string; amplitude: number; background: number; rmse: number }[];
  images: { source: string; model: string; residual: string; comparison: string; mask?: string };
}
export interface ValidationSample extends StarSample {
  accepted: boolean; profileId: string | null; reasons: string[];
  images: StarSample['images'] & { mask: string };
}
export interface AppliedSamplingLayers {
  resultId: string; layers: { id: 'diffuse' | 'stars'; url: string; texturePath: string; sha256: string; widthPx: number; heightPx: number }[];
}
export interface SamplingResult {
  schema: 'cssearth-star-sampling-result@1'; imageId: string; operation: 'overview' | 'survey' | 'inspect' | 'preview' | 'apply';
  calibrationToken?: string; applied?: AppliedSamplingLayers; sourcePreviewSha256?: string;
  sourceSha256: string; nativeDimensions: [number, number]; overview: { url: string; dimensions: [number, number] };
  samples: StarSample[]; validationSamples?: ValidationSample[];
  calibration: { sampleCount: number; qualifiedCount: number; fwhmMedianPixels: number | null; fwhmP10Pixels: number | null;
    fwhmP90Pixels: number | null; betaMedian: number | null; controls: SamplingControls; profileBank?: unknown[]; recommendedDetectionSigmasPixels?: number[] } | null;
  limitations: string[];
}
