import type { SurfaceFeatureNavigationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';
import { record, requiredElement } from './browser-types.mts';
import { searchDestinations } from './destination-search.mts';

/** A row of the prepared cross-body feature index: enough to list, navigate and select. */
export interface IndexedFeature { readonly objectId: string; readonly id: string; readonly name: string; readonly type: string; readonly diameterKm: number; readonly searchNames: readonly string[]; readonly searchContext: string; }
interface FeatureIndex { readonly objects: readonly { readonly id: string; readonly name: string; readonly route: string; readonly count: number }[]; readonly features: readonly IndexedFeature[]; }
interface FeatureIndexPin { readonly url: string; readonly bytes: number; readonly sha256: string; readonly count: number; }

const kilometres = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

function parsePin(source: string | undefined): FeatureIndexPin | null {
  const value: unknown = JSON.parse(source ?? 'null');
  if (!record(value) || value.count === 0) return null;
  if (typeof value.url !== 'string' || !value.url.startsWith('/') || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(value.sha256) ||
      !Number.isSafeInteger(value.bytes) || Number(value.bytes) < 1 || !Number.isSafeInteger(value.count)) throw new TypeError('Feature index pin is invalid.');
  return { url: value.url, bytes: Number(value.bytes), sha256: value.sha256, count: Number(value.count) };
}
function parseIndex(value: unknown, pin: FeatureIndexPin): FeatureIndex {
  if (!record(value) || value.schema !== 'cssearth-prepared-feature-index@1' || !Array.isArray(value.objects) || !Array.isArray(value.features) || value.features.length !== pin.count) throw new TypeError('Feature index is incompatible.');
  for (const feature of value.features as unknown[]) {
    if (!record(feature) || ['objectId', 'id', 'name', 'type', 'searchContext'].some(key => typeof feature[key] !== 'string') || typeof feature.diameterKm !== 'number' ||
        !Array.isArray(feature.searchNames) || !feature.searchNames.every(name => typeof name === 'string')) throw new TypeError('Feature index row is invalid.');
  }
  for (const object of value.objects as unknown[]) {
    if (!record(object) || ['id', 'name', 'route'].some(key => typeof object[key] !== 'string')) throw new TypeError('Feature index object is invalid.');
  }
  return value as unknown as FeatureIndex;
}

/** Retained search rows over every body's prepared named features. Selecting a feature of the
 * mounted body asks its runtime to fly there; another body's feature navigates first, carrying
 * the feature in the URL so the router selects it once that body mounts. */
export function createFeatureBrowser({ documentTarget, objectId, onSelected, onResults }: { documentTarget: Document; objectId: string; onSelected(feature: IndexedFeature): void; onResults(count: number): void }) {
  const candidate = documentTarget.querySelector<HTMLElement>('.planet-feature-results');
  if (!candidate) return null;
  const root = candidate;
  const pin = parsePin(root.dataset.featureIndex);
  const hint = requiredElement(root, '.planet-feature-hint');
  const buttons = [...root.querySelectorAll('button')];
  const events = new AbortController();
  let provider: SurfaceFeatureNavigationRuntime | null = null, index: FeatureIndex | null = null, pending: Promise<FeatureIndex> | null = null;
  let matches: IndexedFeature[] = [], query = '', revision = 0, destroyed = false, selecting = false;
  function clearRows() {
    matches = [];
    for (const button of buttons) button.parentElement!.hidden = true;
  }
  async function load(): Promise<FeatureIndex> {
    if (!pin) throw new Error('No prepared feature index.');
    const response = await fetch(pin.url, { signal: events.signal });
    if (!response.ok) throw new Error('Feature index request failed.');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== pin.bytes) throw new Error('Feature index size drifted.');
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
    if (digest !== pin.sha256) throw new Error('Feature index identity drifted.');
    return parseIndex(JSON.parse(new TextDecoder().decode(bytes)), pin);
  }
  async function search(value: string) {
    if (destroyed) return;
    query = value;
    const request = ++revision;
    clearRows();
    root.hidden = !value.trim() || !pin;
    if (root.hidden) { onResults(0); return; }
    try {
      pending ??= load().catch(error => { pending = null; throw error; });
      index ??= await pending;
      if (destroyed || request !== revision) return;
      const names = new Map(index.objects.map(object => [object.id, object.name]));
      // The mounted body's own matches list first; other bodies follow in search order.
      const ranked = searchDestinations(index.features.map(feature => ({ feature, names: feature.searchNames, searchContext: `${feature.searchContext} ${names.get(feature.objectId)?.toLocaleLowerCase('en') ?? ''}` })), value, buttons.length).map(match => match.feature);
      matches = [...ranked.filter(feature => feature.objectId === objectId), ...ranked.filter(feature => feature.objectId !== objectId)];
      for (const [row, button] of buttons.entries()) {
        const feature = matches[row];
        button.parentElement!.hidden = !feature;
        if (!feature) continue;
        const body = feature.objectId === objectId ? '' : ` · ${names.get(feature.objectId) ?? feature.objectId}`;
        requiredElement(button, '.planet-destination-result-name').textContent = feature.name;
        requiredElement(button, '.planet-destination-result-context').textContent = `${feature.type} · ${kilometres.format(feature.diameterKm)} km${body}`;
        button.ariaLabel = `${feature.name}, ${feature.type}, ${kilometres.format(feature.diameterKm)} kilometres${body}`;
      }
      hint.textContent = matches.length ? 'Named features · IAU Gazetteer' : 'No matching named features.';
      onResults(matches.length || 1);
    } catch {
      if (destroyed || request !== revision) return;
      hint.textContent = 'Feature names could not load. Change your search to retry.';
      onResults(1);
    }
  }
  async function select(feature: IndexedFeature | undefined) {
    if (destroyed || selecting || !feature) return;
    selecting = true;
    for (const button of buttons) button.disabled = true;
    try {
      onSelected(feature);
      if (feature.objectId === objectId && provider) await provider.select(feature.id);
      else documentTarget.dispatchEvent(new CustomEvent('objectnavigate', { bubbles: true, detail: { objectId: feature.objectId, feature: feature.id } }));
    } finally {
      selecting = false;
      if (!destroyed) for (const button of buttons) button.disabled = false;
    }
  }
  buttons.forEach((button, row) => button.addEventListener('click', () => void select(matches[row]), { signal: events.signal }));
  return Object.freeze({
    bind(next: SurfaceFeatureNavigationRuntime | null | undefined) { if (destroyed) return; provider = next ?? null; if (query) void search(query); },
    search,
    destroy() { if (destroyed) return; destroyed = true; revision++; events.abort(); clearRows(); root.hidden = true; },
  });
}
