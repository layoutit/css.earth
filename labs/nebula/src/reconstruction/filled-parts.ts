/** Offline contribution-bank API for a frozen filled-volume reconstruction. */
import { createFilledVolumeSampler, type FilledVolumeOptions, type FilledVolumeSampler } from './filled-volume.js';

type Vec3 = [number, number, number];
type Bounds3 = { min: Vec3; max: Vec3 };

export interface FilledVolumePart {
  id: string;
  kind: 'extended' | 'compact' | 'diffuse';
  componentId?: string;
  scale?: number;
  radius?: number;
  integratedIntensity: number;
  supportBoundsKpc: Bounds3;
  /** Allocation-free optical RGB emissivity using the reference reconstruction's frozen geometry. */
  sample(xKpc: number, yKpc: number, zKpc: number, out: Vec3): void;
  /** Optical column for this independently baked contribution. */
  integratedTargetAtPixel(pixel: number, out: Vec3): void;
  interpretation: string;
}

export interface FilledPartsSampler {
  /** Unchanged selected-channel reference used for the exact default leaves. */
  reference: FilledVolumeSampler;
  parts: readonly FilledVolumePart[];
}

/**
 * Builds the exact reference and its frozen contribution bank together. Extended
 * parts partition that reference when it selects only extended light. Compact and
 * diffuse are separately calibrated source-image channels for optional inspection.
 */
export function createFilledPartsSampler(options: FilledVolumeOptions): FilledPartsSampler {
  const channels = { compact: true, diffuse: true, extended: true, ...options.channels };
  if (options.mode !== 'coherent' || channels.compact || channels.diffuse || !channels.extended) {
    throw new TypeError('Contribution banks require the coherent extended-only reference basis.');
  }
  const reference = createFilledVolumeSampler(options);
  return Object.freeze({ reference, parts: reference.parts });
}
