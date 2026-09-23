import type { ObjectSceneLifecycle } from '../../src/renderers/css/runtime/deferred-object-mount.js';
import type { SceneSession } from './scene-session.mts';
import { readDatasetUrl } from '../dataset-url.mts';

interface CompanionClouds {
  selectVolumeLens?(objectId: string, lensId: string): void;
  setVolumeLensEnabled?(objectId: string, enabled: boolean): void;
}

/** A dataset of this body may ask for a cloud that accompanies it. Only the selected one is drawn. */
export function syncCompanionClouds(datasets: NonNullable<ObjectSceneLifecycle['datasets']>, world: CompanionClouds | null) {
  if (!datasets.volumes.length) return;
  const selected = datasets.volumeOf(datasets.current() ?? datasets.defaultId);
  // One bank carries every cloud of its object and draws one lens at a time, so each bank is
  // answered once: the selected dataset names the lens, and a bank no dataset asks for stays dark.
  for (const objectId of new Set(datasets.volumes.map(volume => volume.objectId))) {
    const enabled = selected?.objectId === objectId;
    if (enabled) world?.selectVolumeLens?.(objectId, selected!.lensId);
    world?.setVolumeLensEnabled?.(objectId, enabled);
  }
}

export function selectSceneDataset(session: Pick<SceneSession, 'mount' | 'shell'>, href: string, signal: AbortSignal, { initial = false } = {}): boolean | Promise<boolean> {
  const { id, requested } = readDatasetUrl(new URL(href));
  const datasets = session.mount?.datasets;
  if (requested && (!datasets || !datasets.ids.includes(id!))) throw new RangeError(`Dataset “${id}” is unavailable on this object.`);
  if (!datasets || initial && !requested) return true;
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
