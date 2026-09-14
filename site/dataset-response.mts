import { parseHTML } from 'linkedom';
import { parseObjectDescriptor } from '@cssearth/objects';
import { loadPreparedCssObject } from '../src/renderers/css/dist/index.js';
import { serializePreparedScene } from '../tools/serialize-prepared-scene.mts';
import { requiredElement } from './browser-types.mts';

function region(html: string, name: string) {
  const marker = `<!--${name}:start-->`, start = html.indexOf(marker) + marker.length;
  const end = html.indexOf(`<!--${name}:end-->`);
  if (start < marker.length || end < start) throw new Error(`Prepared ${name} is missing.`);
  return { start, end, document: parseHTML(`<html><body>${html.slice(start, end)}</body></html>`).document };
}

/** A native request uses the same authenticated prepared records and serializer
 * as the static page. Only the existing scene and its dataset controls change. */
export async function renderDatasetResponse(html: string, url: URL, objectId: string, fetcher: typeof fetch = fetch): Promise<string> {
  const ids = url.searchParams.getAll('dataset');
  if (!ids.length) return html;
  if (ids.length !== 1 || !/^[a-z][a-z0-9-]*$/u.test(ids[0]) || ids[0].length > 128) throw new RangeError('Invalid dataset selection.');
  const lensId = ids[0];
  const descriptorRegion = region(html, 'prepared-descriptor');
  const descriptor = parseObjectDescriptor(JSON.parse(requiredElement(descriptorRegion.document, 'script[data-prepared-descriptor]').textContent ?? ''));
  if (descriptor.id !== objectId || descriptor.prepared?.url !== 'prepared/object.json') throw new Error('Prepared dataset descriptor identity drifted.');
  const shell = region(html, 'search-shell');
  const buttons = [...shell.document.querySelectorAll<HTMLButtonElement>('.planet-information-panel button[name="dataset"]')];
  if (!buttons.some(button => button.getAttribute('value') === lensId)) throw new RangeError('Dataset unavailable on this object.');
  const read = async (path: string) => {
    const response = await fetcher(new URL(path, url.origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('Prepared dataset could not load.');
    return response.arrayBuffer();
  };
  const definition = await loadPreparedCssObject(descriptor, {
    // The decoder authenticates the descriptor, then verifies every byte and bank.
    read: () => read(`/objects/${objectId}/${descriptor.prepared!.sha256}.json`),
    readShared: reference => read(`/shared/${reference.kind}/${reference.sha256}.json`),
  });
  if (definition.id !== objectId) throw new Error('Prepared dataset object identity drifted.');
  const selected = serializePreparedScene(definition, lensId);
  const scene = region(html, 'prepared-scene');
  const stage = requiredElement<HTMLElement>(scene.document, '.planet-stage');
  if (stage.dataset.objectId !== objectId || stage.dataset.preparedObject !== objectId || stage.dataset.preparedSha256 !== descriptor.prepared.sha256) throw new Error('Prepared scene identity drifted.');
  for (const name of stage.getAttributeNames()) {
    if (!['aria-label', 'data-object-id', 'data-prepared-object', 'data-prepared-sha256'].includes(name)) stage.removeAttribute(name);
  }
  stage.className = ['planet-stage', 'example-stage', ...selected.classes].join(' ');
  for (const [name, value] of Object.entries(selected.attributes)) stage.setAttribute(name, value);
  stage.setAttribute('style', selected.style);
  stage.dataset.preparedDataset = lensId;
  stage.innerHTML = selected.html;
  for (const button of buttons) button.setAttribute('aria-pressed', String(button.getAttribute('value') === lensId));
  requiredElement(shell.document, '.planet-sheet-handle').setAttribute('checked', '');
  for (const details of shell.document.querySelectorAll<HTMLElement>('[data-lens-details]')) details.hidden = details.dataset.lensDetails !== lensId;
  for (const tab of shell.document.querySelectorAll<HTMLInputElement>('.planet-information-panel [data-information-tab]')) {
    tab.toggleAttribute('checked', tab.dataset.informationTab === 'dataset');
  }
  // Replace from the end so the original shell offsets remain valid.
  html = html.slice(0, scene.start) + scene.document.body.innerHTML + html.slice(scene.end);
  return html.slice(0, shell.start) + shell.document.body.innerHTML + html.slice(shell.end);
}
