import { nextFrame } from "./next-frame.mts";
import type { SurfaceFeatureNavigationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';
import { requiredElement } from './browser-types.mts';
import { presentFeatureResults } from './search-results-presentation.mts';

import { parseFeaturePin, parseFeatureIndex, matchFeatures, featureResult } from './feature-search.mts';
import type { IndexedFeature, FeatureIndex } from './feature-search.mts';
export type { IndexedFeature } from './feature-search.mts';

/** Retained search rows over every body's prepared named features. Selecting a feature of the
 * mounted body asks its runtime to fly there; another body's feature navigates first, carrying
 * the feature in the URL so the router selects it once that body mounts. */
export function createFeatureBrowser({ documentTarget, objectId, onSelected, onResults }: { documentTarget: Document; objectId: string; onSelected(feature: IndexedFeature): void; onResults(count: number): void }) {
  const candidate = documentTarget.querySelector<HTMLElement>('.planet-feature-results');
  if (!candidate) return null;
  const root = candidate;
  const pin = parseFeaturePin(root.dataset.featureIndex);
  const buttons = [...root.querySelectorAll<HTMLAnchorElement>('.planet-destination-result')];
  const events = new AbortController();
  const currentObjectId = () => documentTarget.body.dataset.objectShell || objectId;
  let provider: SurfaceFeatureNavigationRuntime | null = null, index: FeatureIndex | null = null, pending: Promise<FeatureIndex> | null = null;
  let matches: IndexedFeature[] = [], query = documentTarget.querySelector<HTMLInputElement>('.planet-sidebar-search')?.value.trim().toLocaleLowerCase('en') ?? '', revision = 0, destroyed = false, selecting = false;
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
    return parseFeatureIndex(JSON.parse(new TextDecoder().decode(bytes)), pin);
  }
  async function search(value: string) {
    if (destroyed) return;
    if (query !== value) { clearRows(); root.removeAttribute('open'); }
    query = value;
    const request = ++revision;
    if (!value.trim() || !pin) { root.hidden = true; clearRows(); onResults(0); return; }
    root.hidden = matches.length === 0;
    try {
      pending ??= load().catch(error => { pending = null; throw error; });
      index ??= await pending;
      // Typing faster than the page draws queues one search per keystroke; each scans every name. Wait for the next
      // frame, by which time every queued keystroke has arrived, and search only the newest text.
      await nextFrame(documentTarget);
      if (destroyed || request !== revision) return;
      matches = matchFeatures(index, value, currentObjectId(), buttons.length);
      for (const [row, button] of buttons.entries()) {
        const feature = matches[row];
        button.parentElement!.hidden = !feature;
        if (!feature) continue;
        const result = featureResult(feature, index, currentObjectId());
        requiredElement(button, '.planet-destination-result-name').textContent = result.name;
        requiredElement(button, '.planet-destination-result-context').textContent = result.context;
        button.ariaLabel = result.label;
        button.href = result.href;
      }
      presentFeatureResults(root, matches.length);
      onResults(matches.length);
    } catch {
      if (destroyed || request !== revision) return;
      presentFeatureResults(root, 0, 'Feature names could not load. Change your search to retry.');
      onResults(1);
    }
  }
  async function select(feature: IndexedFeature | undefined) {
    if (destroyed || selecting || !feature) return;
    selecting = true;
    for (const button of buttons) button.ariaDisabled = 'true';
    try {
      onSelected(feature);
      if (feature.objectId === currentObjectId() && provider) {
        const lensIds = index?.objects.find(object => object.id === feature.objectId)?.lensIds;
        if (lensIds) {
          const lenses = [...documentTarget.querySelectorAll<HTMLButtonElement>('button[name="dataset"]')];
          if (!lenses.some(button => button.ariaPressed === 'true' && lensIds.includes(button.value))) {
            const lens = lenses.find(button => lensIds.includes(button.value));
            if (!lens) throw new Error('The feature source dataset is unavailable.');
            lens.click();
          }
        }
        await provider.select(feature.id);
      }
      else documentTarget.dispatchEvent(new CustomEvent('objectnavigate', { bubbles: true, detail: { objectId: feature.objectId, feature: feature.id } }));
    } finally {
      selecting = false;
      if (!destroyed) for (const button of buttons) button.ariaDisabled = 'false';
    }
  }
  buttons.forEach((button, row) => button.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !matches[row]) return;
    event.preventDefault();
    void select(matches[row]);
  }, { signal: events.signal }));
  return Object.freeze({
    bind(next: SurfaceFeatureNavigationRuntime | null | undefined) { if (destroyed) return; provider = next ?? null; if (query) void search(query); },
    search,
    destroy() { if (destroyed) return; destroyed = true; revision++; events.abort(); clearRows(); root.hidden = true; },
  });
}
