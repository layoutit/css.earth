import { syncTabPanels } from './tab-panels.mts';
import { parseHTML } from 'linkedom';
import { catalogueObject, isHostedObject, parseObjectDescriptor } from '@cssearth/objects';
import { sectionElements } from '@cssearth/renderer';
import { loadPreparedVolumeDatasets, createPreparedVolumeDatasets, imageFocusDatasets } from '@cssearth/renderer/universe';
import { worldCameraFromCenteredPresentation, presentWorldCamera, createWorldSelectionTarget, savedWorldCamera } from '@cssearth/renderer/navigation';
import type { PreparedWorldCameraFrame, SharedView } from '@cssearth/renderer/navigation';
import type { ObjectRuntimeDefinition } from '@cssearth/renderer/runtime/object-runtime-types.ts';
import { requiredElement } from './browser/browser-types.mts';
import { isRecord } from '@cssearth/core';
import { createPreparedFocusCard } from './prepared-focus-card.mts';
import { fetchFocusFragment, focusBanksPending, spliceFocusBanks } from './focus-fragment.mts';
import { readPreparedFocusSelection } from './navigation/navigation-scope.mts';
import { resolvePreparedFocus, resolvePreparedFocusDataset } from './prepared-focus.mts';
import type { PreparedFocusPresentation } from './prepared-focus.mts';
import { PREPARED_WORLD_PRESENTATION } from './prepared-world-presentation.mts';

/** Select a prepared context bank inside the existing scene and shared card. The shared selection
 * presentation shows the card and dataset-response.mts opens the sheet, as for every other selection. */
export async function renderNativeFocus(shell: Document, stage: HTMLElement, url: URL, definition: ObjectRuntimeDefinition,
  frame: PreparedWorldCameraFrame, saved: SharedView | null, fetcher: typeof fetch): Promise<SharedView | null> {
  const selection = readPreparedFocusSelection(url, definition.id);
  if (!selection) return saved;
  // The object's own registry entry, as every page reads it.
  const entry = await fetcher(new URL(`/objects/${selection.id}/entry.json`, url.origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!entry.ok) throw new RangeError('Prepared focus is unavailable.');
  const selected = catalogueObject(await entry.json() as unknown, () => async () => { throw new Error('A focus has no scene of its own.'); });
  if (!isHostedObject(selected)) throw new RangeError('Prepared focus is unavailable.');
  const objectId = selected.id;
  const root = sectionElements(shell, '[data-prepared-focus-card]')[0];
  if (!root) throw new Error('Prepared focus card is missing.');
  if (focusBanksPending(root)) {
    const html = await fetchFocusFragment(path => fetcher(new URL(path, url.origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) }));
    spliceFocusBanks(root, parseHTML(html).document);
  }
  const unavailable = (root.querySelector<HTMLElement>('[data-focus-unavailable]')?.dataset.unavailableObjects?.split(' ') ?? []).includes(objectId);
  const bank = unavailable ? undefined : sectionElements(root, '[data-focus-dataset-bank]').find(bank => bank.dataset.focusDatasetBank === objectId);
  let presentation: PreparedFocusPresentation | undefined;
  if (bank) {
    const input: unknown = JSON.parse(requiredElement(bank, 'script[data-focus-resources]').textContent ?? '');
    if (!isRecord(input) || !isRecord(input.resources)) throw new TypeError('Prepared focus resources are missing.');
    const descriptor = parseObjectDescriptor(input.descriptor), resources = input.resources;
    if (descriptor.id !== objectId) throw new TypeError('Prepared focus resource identity differs.');
    // Image-layer galaxies such as M31 are already drawn by the world context; only volume banks mount focus datasets.
    if (descriptor.type === 'image-layer-bank') {
      const datasets = imageFocusDatasets(descriptor.id);
      resolvePreparedFocusDataset(selection.dataset, datasets);
      presentation = { ...datasets, selectDataset() {} };
    } else {
      const resolve = (path: string): string => {
        const value = resources[path];
        if (typeof value !== 'string' || !value) throw new TypeError('Prepared focus resource is undeclared.');
        return value;
      };
      const payload = await loadPreparedVolumeDatasets(descriptor, { read: async path => {
        const response = await fetcher(new URL(resolve(path), url.origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error('Prepared focus bank could not load.');
        return response.arrayBuffer();
      } });
      const datasetId = resolvePreparedFocusDataset(selection.dataset, payload)!;
      const focus = resolvePreparedFocus(selected, PREPARED_WORLD_PRESENTATION.galaxies);
      const focalCss = definition.camera.projection.cssPerspective;
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
      const runtime = createPreparedVolumeDatasets({ payload, resolveResource: path => resolve(`prepared/${path}`) }).mount({ host: stage, before: end, nativeFocalCss: focalCss });
      runtime.selectDataset(datasetId); runtime.publish({ world, viewport });
      end.remove();
      presentation = { ...runtime.state(), selectDataset() {} };
    }
  } else resolvePreparedFocusDataset(selection.dataset, null, unavailable);
  const card = createPreparedFocusCard(root, id => {
    for (const radio of root.querySelectorAll<HTMLInputElement>(':scope > .object-native-tabs > input')) radio.toggleAttribute('checked', radio.value === id);
  });
  card.set(selected, presentation);
  card.destroy();
  syncTabPanels(root);
  return saved;
}
