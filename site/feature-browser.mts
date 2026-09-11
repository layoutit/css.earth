import type { PreparedSurfaceFeature } from '../src/renderers/css/labels/surface-feature-types.js';
import type { SurfaceFeatureNavigationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';
import { requiredElement } from './browser-types.mts';
import { searchDestinations } from './destination-search.mts';

const kilometres = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

/** Retained search rows for an object's prepared named features. The runtime owns the
 * catalogue and the flight; this only fills the rows and forwards a selection. */
export function createFeatureBrowser({ documentTarget, onSelected, onResults }: { documentTarget: Document; onSelected(feature: PreparedSurfaceFeature): void; onResults(count: number): void }) {
  const candidate = documentTarget.querySelector<HTMLElement>('.planet-feature-results');
  if (!candidate) return null;
  const root = candidate;
  const hint = requiredElement(root, '.planet-feature-hint');
  const buttons = [...root.querySelectorAll('button')];
  const events = new AbortController();
  let provider: SurfaceFeatureNavigationRuntime | null = null, matches: PreparedSurfaceFeature[] = [], query = '', revision = 0, destroyed = false, selecting = false;
  function clearRows() {
    matches = [];
    for (const button of buttons) button.parentElement!.hidden = true;
  }
  async function search(value: string) {
    if (destroyed) return;
    query = value;
    const request = ++revision;
    clearRows();
    root.hidden = !value.trim() || !provider;
    if (root.hidden) { onResults(0); return; }
    try {
      const catalog = provider!.catalog() ?? await provider!.loaded();
      if (destroyed || request !== revision) return;
      matches = searchDestinations(catalog.features.map(feature => ({ feature, names: feature.searchNames, searchContext: feature.searchContext })), value, buttons.length).map(match => match.feature);
      for (const [index, button] of buttons.entries()) {
        const feature = matches[index];
        button.parentElement!.hidden = !feature;
        if (!feature) continue;
        requiredElement(button, '.planet-destination-result-name').textContent = feature.name;
        requiredElement(button, '.planet-destination-result-context').textContent = `${feature.type} · ${kilometres.format(feature.diameterKm)} km`;
        button.ariaLabel = `${feature.name}, ${feature.type}, ${kilometres.format(feature.diameterKm)} kilometres`;
      }
      hint.textContent = matches.length ? 'Named features · IAU Gazetteer' : 'No matching named features.';
      root.hidden = false;
      onResults(matches.length || 1);
    } catch {
      if (destroyed || request !== revision) return;
      hint.textContent = 'Feature names could not load. Change your search to retry.';
      onResults(1);
    }
  }
  async function select(feature: PreparedSurfaceFeature | undefined) {
    if (destroyed || !provider || selecting || !feature) return;
    selecting = true;
    for (const button of buttons) button.disabled = true;
    try {
      onSelected(feature);
      await provider.select(feature.id);
    } finally {
      selecting = false;
      if (!destroyed) for (const button of buttons) button.disabled = false;
    }
  }
  buttons.forEach((button, index) => button.addEventListener('click', () => void select(matches[index]), { signal: events.signal }));
  return Object.freeze({
    bind(next: SurfaceFeatureNavigationRuntime | null | undefined) { if (destroyed) return; provider = next ?? null; if (query) void search(query); else root.hidden = true; },
    search,
    destroy() { if (destroyed) return; destroyed = true; revision++; events.abort(); clearRows(); root.hidden = true; },
  });
}
