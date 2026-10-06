import type { DensityVolumeFrame } from '@cssearth/objects';
import type { PreparedVolumeDatasetState } from '../volume/prepared-volume-datasets.js';

export type PreparedFocusDatasets = PreparedVolumeDatasetState;

/** Navigation reads authored framing and datasets without knowing the bank's renderer. */
export interface PreparedFocusBank {
  readonly objectId: string;
  framingRadiusM(): number;
  state(): PreparedFocusDatasets | null;
  load(): Promise<void>;
  selectDataset(id: string): void;
  /** The world always draws it: it has no datasets of its own to load or switch (a level's context package). */
  readonly always?: true;
  /** Keep the bank resident until the focus releases it. */
  subscribe(listener: () => void): () => void;
}

export function imageFocusDatasets(objectId: string): PreparedFocusDatasets {
  return { objectId, id: 'optical', defaultDataset: 'optical', selectedDataset: 'optical', starsVisible: false,
    datasets: [{ id: 'optical', label: 'Optical', title: 'Visible-light observation', description: 'Prepared image layers', sourceUrl: '' }] };
}

export function createImageFocusBank(objectId: string, frame: DensityVolumeFrame, load: () => Promise<void>,
  subscribe: PreparedFocusBank['subscribe'] = () => () => {}): PreparedFocusBank {
  const state = imageFocusDatasets(objectId);
  // Image framing is already authored in the descriptor; it does not wait for the layers to decode.
  const radiusM = Math.max(...frame.boundsUnits.max.map((value, axis) => Math.abs(value - frame.boundsUnits.min[axis]!) / 2)) * frame.metersPerUnit;
  return {
    objectId, framingRadiusM: () => radiusM, state: () => state, load,
    selectDataset(id) { if (id !== 'optical') throw new TypeError('Unknown image-layer dataset.'); },
    subscribe,
  };
}

/** A context package the world always draws (the galaxy's volume, the Local Group's catalogue): the dataset a level object
 * names it by has nothing to load or to switch. */
export function createContextFocusBank(objectId: string): PreparedFocusBank {
  return {
    objectId, always: true, framingRadiusM: () => { throw new TypeError('A context package is framed by its scene.'); }, state: () => null, load: () => Promise.resolve(),
    selectDataset() {}, subscribe: () => () => {},
  };
}

/** A bank of catalogue dots: one dataset, its members, with nothing to decode before it shows. */
export function createPointFocusBank(objectId: string): PreparedFocusBank {
  const state: PreparedFocusDatasets = { objectId, id: 'members', defaultDataset: 'members', selectedDataset: 'members', starsVisible: false,
    datasets: [{ id: 'members', label: 'Members', title: 'Catalogue members', description: 'Prepared catalogue dots', sourceUrl: '' }] };
  return {
    objectId, framingRadiusM: () => { throw new TypeError('A bank of dots is framed by its scene.'); }, state: () => state, load: () => Promise.resolve(),
    selectDataset(id) { if (id !== 'members') throw new TypeError('Unknown catalogue-point dataset.'); },
    subscribe: () => () => {},
  };
}
