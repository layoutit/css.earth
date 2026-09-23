import type { DensityVolumeFrame } from '@cssearth/objects';
import type { PreparedVolumeLensState } from '../volume/prepared-volume-lenses.js';

export type PreparedFocusDatasets = PreparedVolumeLensState;

/** Navigation reads authored framing and datasets without knowing the bank's renderer. */
export interface PreparedFocusBank {
  readonly objectId: string;
  framingRadiusM(): number;
  state(): PreparedFocusDatasets | null;
  load(): Promise<void>;
  selectLens(id: string): void;
  /** Keep the bank resident until the focus releases it. */
  subscribe(listener: () => void): () => void;
}

export function createImageFocusBank(objectId: string, frame: DensityVolumeFrame, load: () => Promise<void>): PreparedFocusBank {
  const state: PreparedFocusDatasets = { objectId, id: 'optical', defaultLens: 'optical', selectedLens: 'optical', starsVisible: false,
    lenses: [{ id: 'optical', label: 'Optical', title: 'Visible-light observation', description: 'Prepared image layers', sourceUrl: '' }] };
  // Image framing is already authored in the descriptor; it does not wait for the layers to decode.
  const radiusM = Math.max(...frame.boundsUnits.max.map((value, axis) => Math.abs(value - frame.boundsUnits.min[axis]!) / 2)) * frame.metersPerUnit;
  return {
    objectId, framingRadiusM: () => radiusM, state: () => state, load,
    selectLens(id) { if (id !== 'optical') throw new TypeError('Unknown image-layer dataset.'); },
    subscribe: () => () => {},
  };
}
