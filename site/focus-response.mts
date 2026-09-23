import { parseHTML } from 'linkedom';
import { parseObjectDescriptor } from '@cssearth/objects';
import { loadPreparedVolumeLenses, createPreparedVolumeLenses, imageFocusDatasets } from '../src/renderers/css/dist/universe.js';
import { worldCameraFromCenteredPresentation, presentWorldCamera, createWorldSelectionTarget, savedWorldCamera } from '../src/renderers/css/dist/navigation.js';
import type { PreparedWorldCameraFrame, SharedView } from '../src/renderers/css/dist/navigation.js';
import type { ObjectRuntimeDefinition } from '../src/renderers/css/runtime/object-runtime-types.js';
import { initialFocusCatalog, loadFocusCatalogs } from './focus-catalog.mts';
import { record, requiredElement } from './browser-types.mts';
import { createPreparedFocusCard } from './prepared-focus-card.mts';
import { fetchFocusFragment, focusBanksPending, spliceFocusBanks } from './focus-fragment.mts';
import { readPreparedFocusSelection } from './navigation/navigation-scope.mts';
import { preparedFocusObjectId, resolvePreparedFocus, preparedFocusCitations, resolvePreparedFocusLens } from './prepared-focus.mts';
import type { PreparedFocusPresentation } from './prepared-focus.mts';
import { PREPARED_WORLD_PRESENTATION } from './prepared-world-presentation.mts';

/** Select a prepared context bank inside the existing scene and shared card. */
export async function renderNativeFocus(shell: Document, stage: HTMLElement, url: URL, definition: ObjectRuntimeDefinition,
  frame: PreparedWorldCameraFrame, saved: SharedView | null, fetcher: typeof fetch): Promise<SharedView | null> {
  const selection = readPreparedFocusSelection(url.searchParams);
  if (!selection) return saved;
  const catalogs = await loadFocusCatalogs(shell, url.origin, fetcher);
  const catalog = [catalogs.galaxies, catalogs.clusters, catalogs.nebulae].find(catalog => catalog.objects.some(record => record.id === selection.id));
  const selected = catalog?.objects.find(record => record.id === selection.id);
  if (!catalog || !selected) throw new RangeError('Prepared focus is unavailable.');
  const objectId = preparedFocusObjectId(selected);
  const root = requiredElement<HTMLElement>(shell, '[data-prepared-focus-card]');
  if (focusBanksPending(root)) {
    const html = await fetchFocusFragment(path => fetcher(new URL(path, url.origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) }));
    spliceFocusBanks(root, parseHTML(html).document);
  }
  const unavailable = objectId !== undefined && (shell.querySelector<HTMLElement>('[data-focus-unavailable]')?.dataset.unavailableObjects?.split(' ') ?? []).includes(objectId);
  const bank = unavailable ? undefined : [...shell.querySelectorAll<HTMLElement>('[data-focus-lens-bank]')].find(bank => bank.dataset.focusLensBank === objectId);
  let presentation: PreparedFocusPresentation | undefined;
  if (bank) {
    const input: unknown = JSON.parse(requiredElement(bank, 'script[data-focus-resources]').textContent ?? '');
    if (!record(input) || !record(input.resources)) throw new TypeError('Prepared focus resources are missing.');
    const descriptor = parseObjectDescriptor(input.descriptor), resources = input.resources;
    if (descriptor.id !== objectId) throw new TypeError('Prepared focus resource identity differs.');
    // Image-layer galaxies such as M31 are already drawn by the world context; only volume banks mount focus lenses.
    if (descriptor.type === 'image-layer-bank') {
      const datasets = imageFocusDatasets(descriptor.id);
      resolvePreparedFocusLens(selection.lens, datasets);
      presentation = { ...datasets, selectLens() {} };
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
      const lensId = resolvePreparedFocusLens(selection.lens, payload)!;
      const focus = resolvePreparedFocus(selected, payload.framingRadiusUnits * payload.lenses[0].volume.frame.metersPerUnit,
        PREPARED_WORLD_PRESENTATION.galaxies);
      const focalCss = definition.camera.projection?.cssPerspective;
      if (!focalCss) throw new TypeError('Prepared focus requires the shared physical camera.');
      const viewport = { focalPixels: 1000, widthPixels: 1e9, heightPixels: 1e9, principalOffsetPixels: [0, 0] as const };
      const world = saved ? savedWorldCamera(saved, frame, viewport) : createWorldSelectionTarget(
        worldCameraFromCenteredPresentation({ rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], distanceUnits: frame.bodyRadiusM / frame.metersPerUnit * 4 }, frame, viewport),
        { ...frame, originM: focus.positionM, bodyRadiusM: focus.framingRadiusM },
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
    }
  } else resolvePreparedFocusLens(selection.lens, null, unavailable);
  const card = createPreparedFocusCard(root, id => {
    for (const radio of root.querySelectorAll<HTMLInputElement>(':scope > .object-native-tabs > input')) radio.toggleAttribute('checked', radio.value === id);
  });
  card.set(selected, preparedFocusCitations(selected, catalog.sources), presentation);
  card.destroy(); root.hidden = false;
  const initial = shell.createElement('script'); initial.type = 'application/json'; initial.dataset.initialFocus = selected.id;
  initial.textContent = JSON.stringify(initialFocusCatalog(catalog, selected)).replace(/</gu, '\\u003c'); root.append(initial);
  requiredElement(shell, '.object-sheet-handle').setAttribute('checked', '');
  return saved;
}
