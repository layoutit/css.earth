import { parseHTML } from 'linkedom';
import { parseObjectDescriptor } from '@cssearth/objects';
import { serializePreparedScene, createPreparedAssetResolver, loadPreparedCssObject, loadPreparedSurfaceFeature, surfaceFeatureCaption, publishPreparedNativeView, initialObjectSelection, publishDatasetSelection, sectionElements } from '@cssearth/renderer';
import { parseSharedView, parsePreparedWorldCameraFrame, formatSharedView } from '@cssearth/renderer/navigation';
import { renderNativeFocus } from './focus-response.mts';
import { requiredElement, requiredSection } from './browser/browser-types.mts';
import { PLACE_FEATURE_PREFIX } from './search/feature-search.mts';
import { readSceneDatasetUrl } from './dataset-url.mts';
import { drawnPageFromUrl, preparedFocusFromUrl } from './navigation/navigation-scope.mts';

function region(html: string, name: string) {
  const marker = `<!--${name}:start-->`, start = html.indexOf(marker) + marker.length;
  const end = html.indexOf(`<!--${name}:end-->`);
  if (start < marker.length || end < start) throw new Error(`Prepared ${name} is missing.`);
  return { start, end, document: parseHTML(`<html><body>${html.slice(start, end)}</body></html>`).document };
}

/** A saved view (`v`) this build cannot read: an old or damaged shared link, not a malformed request. The page answers
 * without it rather than refusing the visit. */
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
  // The page of a subject the scene draws (a catalogue focus, an overview) always renders its scene and subject; a scene's
  // own page changes only for what its query asks.
  if (!drawnPage && !url.searchParams.has('dataset') && !settingRequest && !featureIds.length && !views.length) return html;
  if (views.length > 1) throw new RangeError(`Invalid saved view: ${views.length} v parameters.`);
  let saved;
  try { saved = views.length ? parseSharedView(`v=${views[0]}`) : null; }
  catch { throw new UnreadableSavedView(views[0]!); }
  // The page's scene: the page's own object, or the host of the catalogue focus the page is.
  const descriptorRegion = region(html, 'prepared-descriptor');
  const descriptor = parseObjectDescriptor(JSON.parse(requiredElement(descriptorRegion.document, 'script[data-prepared-descriptor]').textContent ?? ''));
  const objectId = descriptor.id, focusId = preparedFocusFromUrl(url, objectId);
  if ((pageId !== objectId && drawnPageFromUrl(url, objectId) !== pageId) || descriptor.prepared?.url !== 'prepared/object.json') {
    throw new Error(`Prepared dataset descriptor identity drifted: page ${pageId}, scene ${objectId}, focus ${String(focusId)}.`);
  }
  // On a catalogue focus's page `dataset` selects the focus's dataset; the scene keeps its own default.
  const dataset = readSceneDatasetUrl(url, objectId);
  const focusing = focusId !== null;
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
    read: () => read(`/objects/${objectId}/object.json`),
  });
  if (definition.id !== objectId) throw new Error('Prepared dataset object identity drifted.');
  const feature = featureIds.length && definition.features ? await loadPreparedSurfaceFeature(definition.features, objectId, featureIds[0]!,
    AbortSignal.timeout(15_000), (path, init) => fetcher(new URL(path, url.origin), { ...init, redirect: 'error' })) : null;
  if (featureIds.length && !feature) throw new RangeError('Feature unavailable on this object.');
  if (feature && definition.features && !definition.features.datasetIds.includes(datasetId ?? definition.controls.datasets?.defaultDataset ?? '')) {
    datasetId = definition.features.datasetIds[0];
  }
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
  // The page embeds only its first view's hashes: read the groups of the textures this view writes before rendering it.
  const published = createPreparedAssetResolver(definition.assetOrigin, async path => {
    const response = await fetcher(new URL(path, url.origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`${objectId}: hash group ${path} answered ${response.status}.`);
    return response.json();
  });
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
  if (saved || focusing) {
    const frame = parsePreparedWorldCameraFrame(descriptor.properties.worldFrame);
    if (!frame) throw new RangeError('A saved view requires a prepared world frame.');
    saved = await renderNativeFocus(shell.document, stage, url, definition, frame, saved, fetcher);
    if (saved) {
      publishPreparedNativeView(definition, initialObjectSelection(definition.controls, datasetId, settings), stage, frame, saved);
      stage.dataset.preparedView = formatSharedView(saved).slice(2);
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
  if (dataset.requested || featureIds.length || focusing) requiredElement(shell.document, '.object-sheet-handle').setAttribute('checked', '');
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
