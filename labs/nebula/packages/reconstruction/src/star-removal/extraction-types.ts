/** The options and receipts of extraction.ts and its native path (native-extraction.ts). */
export interface ExtractionOptions {
  inputPath: string;
  outputDirectory: string;
  id?: string;
  maxPixels?: number | null;
  /** Opt-in native extraction can omit the two large compact-source output banks. */
  outputMode?: 'all' | 'diffuse-only';
  medianSize?: number;
  supportPixels?: number;
  thresholdSigma?: number;
  bridgeFraction?: number;
  softEdgeFraction?: number;
}

export interface ExtractionReceipt {
  schema: 'cssearth-nebula-extraction-lab@1'; id: string; width: number; height: number;
  skyRgb: [number,number,number]; threshold: number; supportFraction: number;
  outputs: { cutout: string; diffuse: string; residual: string; mask: string; comparison: string };
  method: string; limitations: string[];
}
export interface NativeExtractionReceipt extends Omit<ExtractionReceipt, 'outputs'> {
  outputs: { diffuse: string; mask: string; comparison: string; cutout?: string; residual?: string };
  outputBytes: Record<string,number>;
  options: { maxPixels: null; medianSize: number; outputMode: 'all' | 'diffuse-only'; supportPixels: number;
    thresholdSigma: number; bridgeFraction: number; softEdgeFraction: number };
  source: { path: string; bytes: number; depth: string; width: number; height: number };
  processing: { nativeResolution: true; medianSize: number; outputMode: 'all' | 'diffuse-only';
    borderStatistic: string; elapsedSeconds: number; maximumResidentBytes: number };
}
