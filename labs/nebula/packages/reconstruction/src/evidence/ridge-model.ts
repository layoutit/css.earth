import type { EvidenceGrid, EvidenceSettings } from './model.ts';

export interface RidgeGraphSettings {
  /** Threshold on the bounded weighted ridge response, not a probability. */
  threshold: number;
  /** Minimum total connected-component length. Short junction branches are retained. */
  minLengthArcseconds: number;
}
export const defaultRidgeGraphSettings: RidgeGraphSettings = { threshold: .2, minLengthArcseconds: 30 };
export interface RidgePoint {
  /** Common-grid pixel centers, x right / y down. No depth coordinate. */
  x: number; y: number; score: number; agreement: number;
  /** Bit masks follow graph.sources order; observed and scale-eligible coverage differ. */
  observedMask: number; coverageMask: number; supportMask: number;
  /** Null is unavailable/excluded, while zero is an eligible response below detection. */
  sourceValues: (number | null)[];
  /** Source-local projected axial tangent. Null when no nonzero ridge direction exists. */
  sourceTangents: ([number, number] | null)[];
}
export interface RidgeNode extends RidgePoint {
  id: string; kind: 'endpoint' | 'junction' | 'loop';
  /** Junction pixels are retained so their location is not a fabricated centroid. */
  supportPixels: [number, number][];
}
export interface RidgePolyline {
  id: string; componentId: string; from: string; to: string; closed: boolean;
  points: RidgePoint[]; lengthPixels: number; lengthArcseconds: number;
  meanScore: number; peakScore: number; sourceSupport: { sourceId: string; coveredFraction: number; supportedFraction: number; meanScore: number | null }[];
}
export interface RidgeGraph {
  schema: 'cssearth-projected-ridge-graph@1'; id: string; inputIdentity: string;
  grid: EvidenceGrid; settings: RidgeGraphSettings; combination: EvidenceSettings;
  sources: { id: string; label: string; sourceSha256: string; mapSha256: string; sourcePanelSha256: string }[];
  nodes: RidgeNode[]; polylines: RidgePolyline[];
  diagnostics: { thresholdPixels: number; skeletonPixels: number; retainedComponents: number; discardedComponents: number; thinningPasses: number };
  interpretation: string;
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export function readRidgeGraphSettings(value: unknown): RidgeGraphSettings {
  if (!record(value) || typeof value.threshold !== 'number' || !Number.isFinite(value.threshold) || value.threshold <= 0 || value.threshold > 1 ||
      typeof value.minLengthArcseconds !== 'number' || !Number.isFinite(value.minLengthArcseconds) || value.minLengthArcseconds < 0 || value.minLengthArcseconds > 3600)
    throw new TypeError('Ridge graph requires a threshold in (0,1] and minimum connected length in 0–3600 arcsec.');
  return { threshold: value.threshold, minLengthArcseconds: value.minLengthArcseconds };
}
