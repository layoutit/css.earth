import { FIND_PATH, parseDestinationPlace } from '../find-protocol.mts';
import { withDataset } from '../dataset-url.mts';
import type { NavigationRequest } from '../navigation/navigation-lifecycle.mts';
import type { SceneSession } from './scene-session.mts';

/** Search, links and label clicks share the navigation request's dataset, load and flight lifetime. */
export async function selectSceneFeature(session: SceneSession, request: NavigationRequest, bodyName: string) {
  const mount = session.mount;
  if (!mount) return false;
  const signal = AbortSignal.any([session.signal, request.signal]);
  signal.throwIfAborted();
  mount.features?.clear();
  session.shell?.presentDestination?.(null);
  const datasets = mount.datasets;
  const finish = (completed: boolean) => {
    signal.throwIfAborted();
    // A feature is a one-time command. The committed dataset and camera describe its result.
    const current = datasets?.current();
    const url = withDataset(new URL(request.url), current && current !== datasets?.defaultId ? current : null);
    url.searchParams.delete('feature');
    url.searchParams.delete('v');
    request.url = url.href;
    return completed;
  };
  const id = request.feature;
  if (id === null) return finish((await mount.destinations?.reset({ signal }))?.completed ?? false);
  const city = /^city-([0-9]+)$/u.exec(id);
  const destinations = mount.destinations, features = mount.features;
  if (city ? !destinations : !features || !/^[0-9]+$/u.test(id)) throw new RangeError(`Feature “${id}” is unavailable on this object.`);
  const supported = city ? [destinations!.lensId] : features!.lensIds;
  const current = datasets?.current();
  const lens = current && supported.includes(current) ? current : supported.find(id => datasets?.ids.includes(id));
  if (!datasets || !lens) throw new RangeError('The feature source dataset is unavailable.');
  // Even selecting the committed lens cancels an older, still decoding dataset choice.
  if (!await datasets.select(lens, { signal })) return finish(false);
  signal.throwIfAborted();
  let completed: boolean;
  if (city) {
    const url = new URL(FIND_PATH, request.url);
    url.searchParams.set('object', session.objectId);
    url.searchParams.set('place', city[1]!);
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`City ${city[1]} could not load.`);
    const place = parseDestinationPlace(await response.json());
    signal.throwIfAborted();
    const selected = await destinations!.select(place, { signal });
    signal.throwIfAborted();
    const present = (status: string, flying = false) => {
      if (!signal.aborted) session.shell?.presentDestination?.({ ...place, bodyName, status, flying });
    };
    present(`Flying to ${place.name}…`, true);
    // Superseding navigation cancels the native flight and immediately clears its old status.
    const clear = () => session.shell?.presentDestination?.(null);
    signal.addEventListener('abort', clear, { once: true });
    try {
      ({ completed } = await selected.arrival);
      present(completed ? selected.status : 'Flight stopped. Select the city again to continue.');
    } catch (error) {
      present('Flight failed. Select the city again to retry.');
      throw error;
    } finally { signal.removeEventListener('abort', clear); }
  } else ({ completed } = await features!.select(id, { signal }));
  return finish(completed);
}
