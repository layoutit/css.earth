import type { LensVolume } from '../src/renderers/css/runtime/object-contract.js';
import type { ObjectMountOptions } from '../src/renderers/css/runtime/object-runtime-types.js';
import type { PreparedFocusBank } from '../src/renderers/css/universe/prepared-focus-bank.js';
import type { SceneSession } from './scene-session.mts';
import { errorMessage } from './browser-types.mts';
import { readDatasetUrl } from './dataset-url.mts';

interface CompanionClouds {
  focusBank(objectId: string): PreparedFocusBank | null;
  selectVolumeLens?(objectId: string, lensId: string): void;
  setVolumeLensEnabled?(objectId: string, enabled: boolean): void;
}

/** Companion readiness and visibility belong to the same selection as the body material. */
export function createDatasetEffects(session: SceneSession, world: CompanionClouds | null): NonNullable<ObjectMountOptions['datasetEffects']> {
  let active: { volume: LensVolume; release(): void } | null = null;
  let prepared: { volume: LensVolume; signal: AbortSignal; release(): void } | null = null;
  session.own(() => {
    if (active) { world?.setVolumeLensEnabled?.(active.volume.objectId, false); active.release(); }
    prepared?.release(); active = null; prepared = null;
  });
  return {
    async prepare(volume, signal) {
      if (!volume || signal.aborted || session.signal.aborted) return;
      const bank = world?.focusBank(volume.objectId);
      if (!bank) throw new RangeError(`Dataset cloud “${volume.objectId}” is unavailable.`);
      // Pin through native commitment; cancellation releases the pin while shared loading may continue.
      const unpin = bank.subscribe(() => {});
      const ownership = AbortSignal.any([signal, session.signal]);
      const pin = { volume, signal: ownership, release() {
        ownership.removeEventListener('abort', pin.release);
        unpin();
        if (prepared === pin) prepared = null;
      } };
      prepared = pin;
      ownership.addEventListener('abort', pin.release, { once: true });
      if (ownership.aborted) { pin.release(); return; }
      await bank.load();
      if (ownership.aborted) return;
      if (!bank.state()?.lenses.some(lens => lens.id === volume.lensId)) {
        throw new RangeError(`Dataset cloud lens “${volume.lensId}” is unavailable.`);
      }
    },
    commit(volume) {
      if (session.signal.aborted) return;
      const pin = prepared;
      if (volume && (!pin || pin.volume !== volume)) throw new Error('Dataset companion was not prepared.');
      if (active && active.volume.objectId !== volume?.objectId) world?.setVolumeLensEnabled?.(active.volume.objectId, false);
      if (volume) {
        world?.selectVolumeLens?.(volume.objectId, volume.lensId);
        world?.setVolumeLensEnabled?.(volume.objectId, true);
      }
      active?.release();
      if (pin) pin.signal.removeEventListener('abort', pin.release);
      active = volume && pin ? { volume, release: pin.release } : null;
      prepared = null;
      session.shell?.setDatasetNotice?.(null);
    },
    error(error) { if (!session.signal.aborted) session.shell?.setDatasetNotice?.(errorMessage(error)); },
  };
}

export function selectSceneDataset(session: Pick<SceneSession, 'mount' | 'shell'>, href: string, signal: AbortSignal, { initial = false } = {}): boolean | Promise<boolean> {
  const { id, requested } = readDatasetUrl(new URL(href));
  const datasets = session.mount?.datasets;
  if (requested && (!datasets || !datasets.ids.includes(id!))) throw new RangeError(`Dataset “${id}” is unavailable on this object.`);
  if (!datasets || initial && !requested && !datasets.volumeOf(datasets.current() ?? datasets.defaultId)) return true;
  const selected = id ?? datasets.defaultId;
  const finish = (committed: boolean) => {
    if (!committed || signal.aborted) return false;
    session.shell?.setDatasetNotice?.(null);
    if (requested) session.shell?.showDataset?.();
    return true;
  };
  // Selecting the committed default also cancels an older, still decoding
  // manual choice. Reading current() alone cannot establish that no work is pending.
  return datasets.select(selected, { signal }).then(finish);
}
