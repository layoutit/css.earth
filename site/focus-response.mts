import { isPreparedCluster, isPreparedNebula } from '@cssearth/catalog';
import type { PreparedCatalogObject } from '@cssearth/catalog';
import { parseObjectDescriptor } from '@cssearth/objects';
import { loadPreparedVolumeLenses, createPreparedVolumeLenses } from '../src/renderers/css/dist/universe.js';
import { worldCameraFromCenteredPresentation, presentWorldCamera, createWorldSelectionTarget, savedWorldCamera } from '../src/renderers/css/dist/navigation.js';
import type { PreparedWorldCameraFrame, SharedView } from '../src/renderers/css/dist/navigation.js';
import type { ObjectRuntimeDefinition } from '../src/renderers/css/runtime/object-runtime-types.js';
import { initialFocusCatalog, loadFocusCatalogs } from './focus-catalog.mts';
import { record, requiredElement } from './browser-types.mts';
import { createPreparedFocusCard } from './prepared-focus-card.mts';

/** Select a prepared context bank inside the existing scene and shared card. */
export async function renderNativeFocus(shell: Document, stage: HTMLElement, url: URL, definition: ObjectRuntimeDefinition,
  frame: PreparedWorldCameraFrame, saved: SharedView | null, fetcher: typeof fetch): Promise<SharedView | null> {
  const ids = url.searchParams.getAll('focus'), lensIds = url.searchParams.getAll('focusLens');
  if (!ids.length && !lensIds.length) return saved;
  if (ids.length !== 1 || !/^[a-z0-9][a-z0-9:._+-]{0,127}$/iu.test(ids[0]) || lensIds.length > 1) throw new RangeError('Invalid prepared focus.');
  const catalogs = await loadFocusCatalogs(shell, url.origin, fetcher);
  const catalog = [catalogs.galaxies, catalogs.clusters, catalogs.nebulae].find(catalog => catalog.objects.some(record => record.id === ids[0]));
  const selected: PreparedCatalogObject | undefined = catalog?.objects.find(record => record.id === ids[0]);
  if (!catalog || !selected) throw new RangeError('Prepared focus is unavailable.');
  const objectId = isPreparedCluster(selected) ? undefined : selected.detailedObjectId;
  const bank = [...shell.querySelectorAll<HTMLElement>('[data-focus-lens-bank]')].find(bank => bank.dataset.focusLensBank === objectId);
  let presentation;
  if (bank) {
    const input: unknown = JSON.parse(requiredElement(bank, 'script[data-focus-resources]').textContent ?? '');
    if (!record(input) || !record(input.resources)) throw new TypeError('Prepared focus resources are missing.');
    const descriptor = parseObjectDescriptor(input.descriptor), resources = input.resources;
    if (descriptor.id !== objectId) throw new TypeError('Prepared focus resource identity differs.');
    // Image-layer galaxies such as M31 are already drawn by the world context; only volume banks mount focus lenses.
    if (descriptor.type === 'image-layer-bank') {
      if (lensIds.length) throw new RangeError('Prepared focus datasets are unavailable.');
    } else {
      const resolve = (path: string): string => {
        const value = resources[path];
        if (typeof value !== 'string' || !value) throw new TypeError('Prepared focus resource is undeclared.');
        return value;
      };
      const payload = await loadPreparedVolumeLenses(descriptor, { read: async path => {
        const response = await fetcher(new URL(resolve(path), url.origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error('Prepared focus bank could not load.');
        return response.arrayBuffer();
      } });
      const lensId = lensIds[0] ?? payload.defaultLens;
      if (!payload.lenses.some(lens => lens.id === lensId)) throw new RangeError('Prepared focus dataset is unavailable.');
      const focalCss = definition.camera.projection?.cssPerspective;
      if (!focalCss) throw new TypeError('Prepared focus requires the shared physical camera.');
      const viewport = { focalPixels: 1000, widthPixels: 1e9, heightPixels: 1e9, principalOffsetPixels: [0, 0] as const };
      const world = saved ? savedWorldCamera(saved, frame, viewport) : createWorldSelectionTarget(
        worldCameraFromCenteredPresentation({ rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], distanceUnits: frame.bodyRadiusM / frame.metersPerUnit * 4 }, frame, viewport),
        { ...frame, originM: selected.positionM, bodyRadiusM: selected.presentation?.focusRadiusM ?? payload.framingRadiusUnits * payload.lenses[0].volume.frame.metersPerUnit },
        { ...viewport, framingRadiusPixels: 250 });
      if (!saved) {
        const view = presentWorldCamera(world, frame, viewport);
        saved = { preparedEpochJdTt: frame.epochJdTt, camera: { pose: { schema: 'cssearth-camera-pose@2', scene: view.sceneMatrix },
          distanceKilometers: view.distanceM / 1000,
          bodyCenterKilometers: [view.bodyCenterUnits[0] * frame.metersPerUnit / 1000,
            view.bodyCenterUnits[1] * frame.metersPerUnit / 1000, view.bodyCenterUnits[2] * frame.metersPerUnit / 1000] },
          playback: { speed: 1, motionRequested: false, times: [...definition.motion ?? [], ...definition.animations.filter(plan => plan.mode === 'motion')].map(() => 0) } };
      }
      const end = stage.ownerDocument.createElement('span'); end.hidden = true; stage.append(end);
      const runtime = createPreparedVolumeLenses({ payload, resolveResource: path => resolve(`prepared/${path}`) }).mount({ host: stage, before: end, nativeFocalCss: focalCss });
      runtime.selectLens(lensId); runtime.publish({ world, viewport });
      end.remove();
      presentation = { ...runtime.state(), selectLens() {} };
      for (const context of bank.querySelectorAll<HTMLElement>('[data-dataset-context]')) context.hidden = context.dataset.datasetContext !== lensId;
    }
  } else if (lensIds.length) throw new RangeError('Prepared focus datasets are unavailable.');
  const root = requiredElement<HTMLElement>(shell, '[data-prepared-focus-card]');
  const refs = [selected.skyPosition.sourceRef, selected.distance.sourceRef, (isPreparedCluster(selected) || isPreparedNebula(selected) ? selected.classification.sourceRef : selected.membership.sourceRef)];
  const card = createPreparedFocusCard(root, id => {
    for (const radio of root.querySelectorAll<HTMLInputElement>(':scope > .planet-native-tabs > input')) radio.toggleAttribute('checked', radio.value === id);
  });
  card.set(selected, catalog.sources.filter(source => refs.some(ref => ref === source.id || ref?.startsWith(`${source.id}:`))), presentation);
  card.destroy(); root.hidden = false;
  const initial = shell.createElement('script'); initial.type = 'application/json'; initial.dataset.initialFocus = selected.id;
  initial.textContent = JSON.stringify(initialFocusCatalog(catalog, selected)).replace(/</gu, '\\u003c'); root.append(initial);
  requiredElement(shell, '.planet-sheet-handle').setAttribute('checked', '');
  return saved;
}
