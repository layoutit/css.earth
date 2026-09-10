import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createControlStore } from '../utils/control-store';
import type { ToneResource } from '../viewer/tone-runtime';

export interface CloudDensityFilter { cutoff: number; softness: number; showRemoved: boolean; }
export interface CloudDensityContext { subjectId: string; }
export interface AppliedCloudDensityContext extends CloudDensityContext { filter: CloudDensityFilter; }

const STORAGE_KEY = 'cssearth-nebula-cloud-density-v2';
const STORAGE_SCHEMA = 'cssearth-nebula-cloud-density@2';
const defaultFilter = (): CloudDensityFilter => ({ cutoff: 0, softness: .25, showRemoved: false });
const sameFilter = (a: CloudDensityFilter, b: CloudDensityFilter) =>
  a.cutoff === b.cutoff && a.softness === b.softness && a.showRemoved === b.showRemoved;

function validFilter(value: unknown): value is CloudDensityFilter {
  if (!value || typeof value !== 'object') return false;
  const filter = value as Record<string, unknown>;
  return typeof filter.cutoff === 'number' && Number.isFinite(filter.cutoff) && filter.cutoff >= 0 && filter.cutoff <= 1 &&
    typeof filter.softness === 'number' && Number.isFinite(filter.softness) && filter.softness >= 0 && filter.softness <= 1 &&
    typeof filter.showRemoved === 'boolean';
}

function readSaved(): Map<string, CloudDensityFilter> {
  const result = new Map<string, CloudDensityFilter>();
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (value?.schema !== STORAGE_SCHEMA || !Array.isArray(value.values)) return result;
    for (const row of value.values) {
      if (Array.isArray(row) && typeof row[0] === 'string' && validFilter(row[1])) result.set(row[0], { ...row[1] });
    }
  } catch { /* Storage is optional in the local lab. */ }
  return result;
}

const savedFilters = readSaved();
function save(subjectId: string, filter: CloudDensityFilter) {
  savedFilters.set(subjectId, { ...filter });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema: STORAGE_SCHEMA, values: [...savedFilters] }));
  } catch { /* Controls remain available for this session. */ }
}

export function createCloudDensityControls({ host, onApply }: {
  host: HTMLElement;
  onApply(context: AppliedCloudDensityContext, resources: ToneResource[], isCurrent: () => boolean): Promise<void>;
}) {
  const root = createRoot(host);
  let context: CloudDensityContext | null = null, filter = defaultFilter(), generation = 0, destroyed = false;
  let pending: AbortController | null = null, copyTimer: number | undefined;
  let message = '', error = false, copyLabel = 'Copy filter JSON', copying = false;
  const needsApply = new Set<string>();
  const snapshot = () => ({ context, filter: { ...filter }, message, error, copyLabel, copying });
  const store = createControlStore(snapshot()), render = () => { if (!destroyed) store.set(snapshot()); };
  const status = (text: string, failed = false) => { message = text; error = failed; render(); };
  async function prepare(next: CloudDensityFilter) {
    if (!context || destroyed) return;
    generation++; pending?.abort(); pending = new AbortController();
    const expected = generation, expectedContext: AppliedCloudDensityContext = { ...context, filter: { ...next } };
    const current = () => !destroyed && expected === generation && context?.subjectId === expectedContext.subjectId;
    needsApply.add(expectedContext.subjectId); save(expectedContext.subjectId, expectedContext.filter);
    status('Preparing density filter…');
    try {
      const response = await fetch('/__nebula/prepare-cloud-density', { method: 'POST', signal: pending.signal,
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(expectedContext) });
      if (!response.ok) throw new Error(`Density preparation failed (HTTP ${response.status}).`);
      const body = await response.json() as { resources?: ToneResource[] };
      if (!Array.isArray(body.resources) || body.resources.some(resource => !resource || typeof resource.sourcePath !== 'string' ||
          typeof resource.url !== 'string' || !Number.isInteger(resource.width) || !Number.isInteger(resource.height)))
        throw new TypeError('Density preparation returned invalid resources.');
      if (!current()) return;
      status('Applying density filter…'); await onApply(expectedContext, body.resources, current);
      if (current()) { needsApply.delete(expectedContext.subjectId); status(sameFilter(filter, expectedContext.filter) ? 'Density filter applied' : 'Changes not applied'); }
    } catch (value) {
      if (current() && (value as { name?: string }).name !== 'AbortError') status(value instanceof Error ? value.message : String(value), true);
    } finally { if (expected === generation) pending = null; }
  }
  async function copy() {
    if (!context) return;
    if (copyTimer !== undefined) window.clearTimeout(copyTimer); copying = true; render();
    try {
      await navigator.clipboard.writeText(JSON.stringify({ schema: STORAGE_SCHEMA, subjectId: context.subjectId, filter }, null, 2));
      if (destroyed) return;
      copyLabel = 'Copied!'; copyTimer = window.setTimeout(() => { copyLabel = 'Copy filter JSON'; render(); }, 2000);
    } catch { copyLabel = 'Copy failed — try again'; } finally { copying = false; render(); }
  }
  function CloudDensityControlsView() {
    const state = useSyncExternalStore(store.subscribe, store.snapshot);
    return <fieldset className="cloud-density-fieldset" disabled={!state.context}>
      <legend>Cloud cutoff</legend><p className="cloud-control-hint">Remove faint regions using the original Earth-facing view. The selection stays fixed through the cloud as you rotate. 0% restores the original.</p>
      {(['cutoff', 'softness'] as const).map(key => <div className="cloud-density-control" key={key}>
        <label htmlFor={`cloud-density-${key}`}>{key === 'cutoff' ? 'Signal cutoff' : 'Edge softness'}</label>
        <input id={`cloud-density-${key}`} type="range" min="0" max="100" step=".1" value={state.filter[key] * 100}
          onInput={event => { filter = { ...filter, [key]: Number(event.currentTarget.value) / 100 }; status('Changes not applied'); }} />
        <output htmlFor={`cloud-density-${key}`}>{(state.filter[key] * 100).toFixed(1)}%</output>
      </div>)}
      <label htmlFor="cloud-density-show-removed" className="cloud-density-removed"><input type="checkbox" id="cloud-density-show-removed"
        checked={state.filter.showRemoved} onChange={event => { filter = { ...filter, showRemoved: event.currentTarget.checked }; render(); void prepare(filter); }} /> Show removed signal</label>
      <div className="cloud-actions">
        <button type="button" id="apply-cloud-density" className="text-button" onClick={() => void prepare(filter)}>Apply density filter</button>
        <button type="button" id="reset-cloud-density" className="text-button" onClick={() => { filter = defaultFilter(); render(); void prepare(filter); }}>Reset to original</button>
        <button type="button" id="copy-cloud-density" className="text-button" disabled={state.copying} onClick={() => void copy()}>{state.copyLabel}</button>
      </div><p className="cloud-control-status" role="status" data-error={state.error ? 'true' : undefined}>{state.message}</p>
    </fieldset>;
  }
  root.render(<CloudDensityControlsView />);
  return Object.freeze({
    setContext(next: CloudDensityContext | null) {
      if (context && next && context.subjectId === next.subjectId) return;
      generation++; pending?.abort(); pending = null; context = next ? { ...next } : null;
      filter = context ? { ...(savedFilters.get(context.subjectId) ?? defaultFilter()) } : defaultFilter(); status('');
      if (context && (!sameFilter(filter, defaultFilter()) || needsApply.has(context.subjectId))) void prepare(filter);
    },
    getValue: () => ({ ...filter }),
    destroy() { destroyed = true; generation++; pending?.abort(); if (copyTimer !== undefined) window.clearTimeout(copyTimer); queueMicrotask(() => root.unmount()); },
  });
}
