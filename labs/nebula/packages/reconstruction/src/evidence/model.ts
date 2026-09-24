import type { Affine as Matrix } from '../registration/affine.ts';

export const evidenceChannels = ['broad', 'ridges', 'compact'] as const;
export type EvidenceChannel = typeof evidenceChannels[number];
export interface EvidenceSettings { channel: EvidenceChannel | 'all'; weights: number[]; sensitivity: number }
export interface EvidenceGrid {
  width: number; height: number; frameWidth: number; frameHeight: number;
  /** Grid spans this rectangle in the registered frame, including every source footprint. */
  originX: number; originY: number; extentWidth: number; extentHeight: number;
  fieldArcminutes: [number, number]; arcsecondsPerPixel: number;
}
export interface EvidencePlane {
  /** Positive multiscale response divided by a source-local display-noise proxy. */
  signal: Float32Array; coverage: Uint8Array; noiseSigma: number;
}
export interface EvidenceSource {
  id: string; label: string; sourceSha256: string; mapSha256: string; sourcePanelSha256: string;
  imageToFrame: Matrix; workingWidth: number; workingHeight: number;
  registeredRgba: Uint8Array; footprint: Uint8Array;
  channels: Record<EvidenceChannel, EvidencePlane>;
  ridgeDirectionX: Float32Array; ridgeDirectionY: Float32Array;
  samplingArcseconds: number;
}
export interface EvidenceInputs {
  identity: string; grid: EvidenceGrid; sources: EvidenceSource[];
  method: { version: string; scaleArcseconds: number[]; samplingLimitation: string; normalization: string; boundary: string };
}
export interface CombinedEvidence {
  width: number; height: number; settings: EvidenceSettings;
  planes: Float32Array[]; coverage: Uint8Array[];
  union: Float32Array; agreement: Float32Array; contributors: Uint8Array;
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const channel = (value: unknown): value is EvidenceSettings['channel'] => value === 'all' || evidenceChannels.some(id => id === value);
export function readEvidenceSettings(value: unknown, sourceCount: number): EvidenceSettings {
  if (!record(value) || !channel(value.channel) ||
      typeof value.sensitivity !== 'number' || !Number.isFinite(value.sensitivity) || value.sensitivity < .25 || value.sensitivity > 4 ||
      !Array.isArray(value.weights) || value.weights.length !== sourceCount || value.weights.some(w => typeof w !== 'number' || !Number.isFinite(w) || w < 0 || w > 2))
    throw new TypeError('Evidence requires a channel, one weight per source (0–2), and sensitivity 0.25–4.');
  return { channel: value.channel, sensitivity: value.sensitivity, weights: [...value.weights] };
}
