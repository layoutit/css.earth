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

/** An image-layer bank's datasets: its picture with what each draws over it (ImageLayerBankDescriptor `overlays`), the
 * first the default. Their names and sources are the host's dataset controls'. */
export function imageFocusDatasets(objectId: string, ids: readonly string[] = ['optical'], selected = ids[0]!): PreparedFocusDatasets {
  return { objectId, id: selected, defaultDataset: ids[0]!, selectedDataset: selected, starsVisible: false,
    datasets: ids.map(id => ({ id, label: id, title: id, description: 'Prepared image layers', sourceUrl: '' })) };
}

export function createImageFocusBank(objectId: string, frame: DensityVolumeFrame, load: () => Promise<void>,
  datasets: readonly string[] = ['optical'], selection?: { current(): string; select(dataset: string): void }): PreparedFocusBank {
  // The bank keeps the selection: a focus bank asked for again reads the dataset it shows.
  let state = imageFocusDatasets(objectId, datasets, selection?.current());
  const listeners = new Set<() => void>();
  // Image framing is already authored in the descriptor; it does not wait for the layers to decode.
  const radiusM = Math.max(...frame.boundsUnits.max.map((value, axis) => Math.abs(value - frame.boundsUnits.min[axis]!) / 2)) * frame.metersPerUnit;
  return {
    objectId, framingRadiusM: () => radiusM, load,
    state: () => { const current = selection?.current(); if (current !== undefined && current !== state.selectedDataset) state = imageFocusDatasets(objectId, datasets, current); return state; },
    selectDataset(id) {
      if (!datasets.includes(id)) throw new TypeError('Unknown image-layer dataset.');
      if (id === state.selectedDataset && id === (selection?.current() ?? id)) return;
      state = imageFocusDatasets(objectId, datasets, id); selection?.select(id);
      for (const listener of listeners) listener();
    },
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

/** A bank that is one picture on a plane: one dataset, the plane, read when it first shows. */
export function createPlaneFocusBank(objectId: string): PreparedFocusBank {
  const state: PreparedFocusDatasets = { objectId, id: 'plane', defaultDataset: 'plane', selectedDataset: 'plane', starsVisible: false,
    datasets: [{ id: 'plane', label: 'Plane', title: 'Prepared plane', description: 'One prepared picture on a plane', sourceUrl: '' }] };
  return {
    objectId, framingRadiusM: () => { throw new TypeError('A plane is framed by its scene.'); }, state: () => state, load: () => Promise.resolve(),
    selectDataset(id) { if (id !== 'plane') throw new TypeError('Unknown plane dataset.'); },
    subscribe: () => () => {},
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
