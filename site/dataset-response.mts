import { CAMERA_POSE_SCHEMA, parseObjectDescriptor, parsePreparedWorldCameraFrame } from '@cssearth/objects';

import { parseHTML } from 'linkedom';

import { serializePreparedScene, createPreparedAssetResolver, loadPreparedCssObject, loadPreparedDataset,loadPreparedSurfaceFeature, surfaceFeatureCaption, publishPreparedNativeView, initialObjectSelection, publishDatasetSelection, sectionElements } from '@cssearth/renderer';
import { parseSharedView, formatSharedView, type SharedView } from '@cssearth/renderer/navigation';
import { preparedSceneMatrix } from '@cssearth/engine';
import { serializePreparedMatrix4 } from '@cssearth/core';
import { distanceForSilhouetteRadius } from '@cssearth/engine';

import { requiredElement, requiredSection } from './browser/browser-types.mts';
import { PLACE_FEATURE_PREFIX } from './search/feature-search.mts';
import { readSceneDatasetUrl } from './dataset-url.mts';
import { preparedObjectUrl } from './prepared-object-path.mts';
import { defaultWidthShare } from './default-width-share.mts';

function region(html: string, name: string) {
  const marker = `<!--${name}:start-->`, start = html.indexOf(marker) + marker.length;
  const end = html.indexOf(`<!--${name}:end-->`);
  if (start < marker.length || end < start) throw new Error(`Prepared ${name} is missing.`);
  return { start, end, document: parseHTML(`<html><body>${html.slice(start, end)}</body></html>`).document };
}

/** A saved view (`v`) this build cannot read: an old or damaged shared link, not a malformed request. The page answers
 * without it rather than refusing the visit. */
const SCENE_ADDRESSES = /\/scenes\/[a-z][a-z0-9-]*\/[^\s"')]+/gu;

export class UnreadableSavedView extends RangeError {
  readonly value: string;
  constructor(value: string) { super(`Invalid saved view: v=${value.slice(0, 80)}.`); this.value = value; }
}

/** A native request uses the same authenticated prepared records and serializer
 * as the static page. Only the existing scene and its dataset controls change. */
export async function renderDatasetResponse(html: string, url: URL, pageId: string, fetcher: typeof fetch = fetch,
  { drawnPage = false }: { drawnPage?: boolean } = {}): Promise<string> {
  const settingRequest = url.searchParams.has('settings');
  const featureParams = url.searchParams.getAll('feature');
  if (featureParams.length > 1 || featureParams.length && !/^(?:city-)?[0-9]{1,16}$/u.test(featureParams[0]!)) throw new RangeError('Invalid feature selection.');
  // A city link (`city-<id>`) is selected by the page on arrival; only surface features are drawn here.
  const featureIds = featureParams.filter(id => !id.startsWith(PLACE_FEATURE_PREFIX));
  const views = url.searchParams.getAll('v');
  // The page of a level the scene draws always renders its scene and subject; a scene's own page changes only for what its
  // query asks.
  if (!drawnPage && !url.searchParams.has('dataset') && !settingRequest && !featureIds.length && !views.length) return html;
  if (views.length > 1) throw new RangeError(`Invalid saved view: ${views.length} v parameters.`);
  let saved;
  try { saved = views.length ? parseSharedView(`v=${views[0]}`) : null; }
  catch { throw new UnreadableSavedView(views[0]!); }
  // The page's scene: the page's own object, or the host of the level the page is.
  const descriptorRegion = region(html, 'prepared-descriptor');
  const descriptor = parseObjectDescriptor(JSON.parse(requiredElement(descriptorRegion.document, 'script[data-prepared-descriptor]').textContent ?? ''));
  const objectId = descriptor.id;
  if (pageId !== objectId || descriptor.prepared?.url !== 'prepared/object.json') {
    throw new Error(`Prepared dataset descriptor identity drifted: page ${pageId}, scene ${objectId}.`);
  }
  const dataset = readSceneDatasetUrl(url, objectId);
  let datasetId = dataset.id ?? undefined;
  const shell = region(html, 'search-shell');
  const information = requiredSection(shell.document, '.object-information-panel');
  const buttons = [...information.querySelectorAll<HTMLButtonElement>('button[name="dataset"]:not([data-dataset-step])')];
  if (datasetId && !buttons.some(button => button.getAttribute('value') === datasetId)) throw new RangeError('Dataset unavailable on this object.');
  const read = async (path: string) => {
    const response = await fetcher(new URL(path, url.origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('Prepared dataset could not load.');
    return response.arrayBuffer();
  };
  const definition = await loadPreparedCssObject(descriptor, {
    read: reference => read(preparedObjectUrl(objectId, reference)),
  });
  if (definition.id !== objectId) throw new Error('Prepared dataset object identity drifted.');
  // The page embeds only its first view's hashes: read the groups of the files this view needs before fetching them.
  const published = createPreparedAssetResolver(definition.assetOrigin, async path => {
    const response = await fetcher(new URL(path, url.origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`${objectId}: hash group ${path} answered ${response.status}.`);
    return response.json();
  });
  // A feature catalogue is a published file like any texture. Read from the page's own origin it answered 404 on the
  // deployed site, and every feature link was a crashed function (2026-10-01).
  const feature = featureIds.length && definition.features ? await loadPreparedSurfaceFeature(definition.features, objectId, featureIds[0]!,
    AbortSignal.timeout(15_000), async (path, init) => {
      await published.ensure('features', path);
      return fetcher(new URL(published.url(path), url.origin), { ...init, redirect: 'error' });
    }) : null;
  if (featureIds.length && !feature) throw new RangeError('Feature unavailable on this object.');
  if (feature && definition.features && !definition.features.datasetIds.includes(datasetId ?? definition.controls.datasets?.defaultDataset ?? '')) {
    datasetId = definition.features.datasetIds[0];
  }
  // Another dataset's tables travel apart from the object transport (dataset-tables.ts in @cssearth/objects).
  await loadPreparedDataset(definition, datasetId ?? null);
  const settings: Record<string, number | boolean> = {};
  if (settingRequest) {
    if (url.searchParams.getAll('settings').length !== 1 || url.searchParams.get('settings') !== '1') throw new RangeError('Invalid settings selection.');
    for (const control of definition.controls.settings?.controls ?? []) {
      const values = url.searchParams.getAll(control.name);
      if (values.length > 1 || control.kind === 'toggle' && values.length && values[0] !== 'on') throw new RangeError(`Invalid setting: ${control.name}.`);
      if (control.kind === 'toggle') settings[control.name] = values.length > 0;
      else if (values.length) settings[control.name] = Number(values[0]);
    }
  }
  const written = serializePreparedScene(definition, datasetId, settings, (_key, address) => address).textures;
  await Promise.all(written.map(({ key, address }) => published.ensure(key, address)));
  const selected = serializePreparedScene(definition, datasetId, settings, (_key, address) => published.url(address));
  const activeDataset = datasetId ?? definition.controls.datasets?.defaultDataset;
  const scene = region(html, 'prepared-scene');
  const stage = requiredElement<HTMLElement>(scene.document, '.object-stage');
  // A page with an arrival billboard ships an empty stage without the prepared-object mark (ObjectLayout's startup). A
  // dataset request is never the default view, so it renders the full scene into that stage and marks it, as the client
  // expects for any non-default view (usesDefaultStartupView).
  const startupPage = /\sdata-startup-discovery[\s>=]/u.test(html);
  const prepared = stage.dataset.preparedObject ?? (startupPage ? objectId : undefined);
  if (stage.dataset.objectId !== objectId || prepared !== objectId)
    throw new Error(`Prepared scene identity drifted: requested ${objectId}, stage object ${String(stage.dataset.objectId)}, prepared ${String(stage.dataset.preparedObject)}, startup page ${startupPage}.`);
  stage.dataset.preparedObject = objectId;
  for (const name of stage.getAttributeNames()) {
    if (!['aria-label', 'data-object-id', 'data-prepared-object'].includes(name)) stage.removeAttribute(name);
  }
  stage.className = ['object-stage', ...selected.classes].join(' ');
  for (const [name, value] of Object.entries(selected.attributes)) stage.setAttribute(name, value);
  stage.setAttribute('style', selected.style);
  if (activeDataset) stage.dataset.preparedDataset = activeDataset;
  stage.dataset.preparedSettings = JSON.stringify(settings);
  stage.innerHTML = selected.html;
  const frame = parsePreparedWorldCameraFrame(descriptor.properties.worldFrame);
  if (saved && !frame) throw new RangeError('A saved view requires a prepared world frame.');
  // Without a saved view the scene takes the pose of a fresh mount, framed at the landscape share of the viewport width the
  // live camera fits a body to (camera-layout.ts); CSS resolves the focal length, so every screen gets that share. The
  // prepared tree's own pose is only a mount point: it leaves depth unscaled, which drew each polar cap as a hole, and its
  // fixed size overflowed a phone (2026-10-02).
  const share = defaultWidthShare(definition.camera);
  const view: SharedView | null = saved ?? (frame && share ? {
    camera: { distanceKilometers: distanceForSilhouetteRadius(frame.bodyRadiusM, 1, share.diameterOverFocal / 2) / 1000, pose: { schema: CAMERA_POSE_SCHEMA,
      scene: serializePreparedMatrix4(preparedSceneMatrix(definition.camera, definition.camera.defaultControlPitchDegrees, definition.camera.defaultControlYawDegrees)) } },
    playback: { speed: 1, motionRequested: false, times: (definition.motion ?? []).map(() => 0) }, preparedEpochJdTt: frame.epochJdTt,
  } : null);
  if (view && frame) {
    try {
      const publication = publishPreparedNativeView(definition, initialObjectSelection(definition.controls, datasetId, settings), stage, frame, view);
      // A page without script turns the body by dragging it; the turn applies to the body's own prepared rotation, marked
      // here for ObjectLayout's noscript rules. The live camera replaces it when it mounts.
      for (const plan of definition.motion ?? []) publication.nodes[plan.target]!.dataset.nativeTurn = '';
      // The frame publisher writes the lighting and material frames of this camera by their prepared address: give
      // each its published URL, as the scene's own textures have. A saved Moon link asked the site for
      // /scenes/moon/lighting-2x-shadowless.webp and got 404 (2026-10-01).
      const keys = new Map(definition.assets.entries.map(entry => [entry.url, entry.key]));
      const styled = [...stage.querySelectorAll<HTMLElement>('[style*="/scenes/"]')];
      const addresses = new Set(styled.flatMap(node => node.getAttribute('style')!.match(SCENE_ADDRESSES) ?? []));
      await Promise.all([...addresses].map(address => published.ensure(keys.get(address) ?? '', address)));
      for (const node of styled) node.setAttribute('style', node.getAttribute('style')!.replace(SCENE_ADDRESSES, address => published.url(address)));
      if (saved) stage.dataset.preparedView = formatSharedView(saved).slice(2);
    } catch (error) {
      // A view that reads but names no camera this scene can take (a rotation that is not orthonormal, a distance out
      // of range) is answered like one that does not read: the page without it, never a failed function. One such link
      // answered 502 with the function's stack (2026-10-01).
      if (saved && views.length && (error instanceof TypeError || error instanceof RangeError)) throw new UnreadableSavedView(views[0]!);
      throw error;
    }
  }
  if (feature) {
    const root = scene.document.createElement('div');
    root.className = 'prepared-surface-features';
    root.dataset.surfaceFeatures = objectId;
    // Only the selected caption, on a full-stage root (object-shell.css) until the label layer claims it.
    root.dataset.featureCaptionOnly = '';
    const caption = surfaceFeatureCaption(root);
    caption.show(feature);
    caption.element.dataset.featureTooltipPinned = 'true';
    caption.element.style.transform = 'translate(-50%,-100%)';
    stage.append(root);
  }
  publishDatasetSelection(buttons,
    sectionElements(shell.document, '[data-dataset-details]').map(panel => ({ id: panel.dataset.datasetDetails!, panel })),
    sectionElements(information, '[data-dataset-context]'), new Set([activeDataset ?? null]),
    information.querySelector('.object-datasets'));
  if (dataset.requested || featureIds.length) requiredElement(shell.document, '.object-sheet-handle').setAttribute('checked', '');
  for (const input of shell.document.querySelectorAll<HTMLInputElement>('.object-settings input[name]')) {
    if (Object.hasOwn(settings, input.name)) {
      if (input.type === 'checkbox') input.toggleAttribute('checked', settings[input.name] === true);
      else input.setAttribute('value', String(settings[input.name]));
    }
  }
  if (dataset.requested) information.querySelector(':scope > details[data-information-panel="dataset"]')?.setAttribute('open', '');
  // Replace from the end so the original shell offsets remain valid.
  html = html.slice(0, scene.start) + scene.document.body.innerHTML + html.slice(scene.end);
  return html.slice(0, shell.start) + shell.document.body.innerHTML + html.slice(shell.end);
}
