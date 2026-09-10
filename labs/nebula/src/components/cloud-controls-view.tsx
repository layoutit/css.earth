import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createControlStore } from '../utils/control-store';

export type CloudPartKind = 'extended' | 'diffuse' | 'compact';

export interface CloudPart {
  id: string;
  label: string;
  kind: CloudPartKind;
  signalFraction: number;
  defaultEnabled: boolean;
}

export interface CloudSelection { contextId: string; enabledIds: string[]; }
export interface CloudBrightness { overall: number; x: number; y: number; z: number; }
export interface CloudContext {
  id: string;
  parts: CloudPart[];
  selection?: CloudSelection | readonly string[];
}

interface SavedValue { enabledIds: string[]; brightness: CloudBrightness; }
interface BrightnessSpec { key: keyof CloudBrightness; label: string; }

const STORAGE_KEY = 'cssearth-nebula-cloud-controls-v1';
const STORAGE_SCHEMA = 'cssearth-nebula-cloud-controls@1';
const BRIGHTNESS: BrightnessSpec[] = [
  { key: 'overall', label: 'Overall' },
  { key: 'x', label: 'X balance' },
  { key: 'y', label: 'Y balance' },
  { key: 'z', label: 'Z balance' },
];
const nativeBrightness = (): CloudBrightness => ({ overall: 1, x: 1, y: 1, z: 1 });
const validBrightness = (value: unknown): value is CloudBrightness => {
  if (!value || typeof value !== 'object') return false;
  return (['overall', 'x', 'y', 'z'] as const).every(key => {
    const number = (value as Record<string, unknown>)[key];
    return typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 1;
  });
};

function readSaved(): Map<string, SavedValue> {
  const result = new Map<string, SavedValue>();
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (value?.schema !== STORAGE_SCHEMA || !Array.isArray(value.values)) return result;
    for (const row of value.values) {
      if (!Array.isArray(row) || typeof row[0] !== 'string' || !row[1] ||
          !Array.isArray(row[1].enabledIds) || row[1].enabledIds.some((id: unknown) => typeof id !== 'string') ||
          !validBrightness(row[1].brightness)) continue;
      result.set(row[0], { enabledIds: [...row[1].enabledIds], brightness: { ...row[1].brightness } });
    }
  } catch { /* Storage is optional in the local lab. */ }
  return result;
}

const savedValues = readSaved();
function writeSaved() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema: STORAGE_SCHEMA, values: [...savedValues] }));
  } catch { /* Controls remain available for this session. */ }
}

function validateContext(context: CloudContext) {
  if (!context.id) throw new TypeError('Cloud control context id is required.');
  const ids = new Set<string>();
  for (const part of context.parts) {
    if (!part.id || !part.label || ids.has(part.id) ||
        !['extended', 'diffuse', 'compact'].includes(part.kind) ||
        !Number.isFinite(part.signalFraction) || part.signalFraction < 0 || part.signalFraction > 1) {
      throw new TypeError(`Invalid cloud part ${part.id || '(unnamed)'}.`);
    }
    ids.add(part.id);
  }
}

export function createCloudControls({ host, onChange, onBrightness }: {
  host: HTMLElement; onChange(selection: CloudSelection): void; onBrightness(balance: CloudBrightness): void;
}) {
  const root = createRoot(host);
  let context: CloudContext | null = null, enabled = new Set<string>(), brightness = nativeBrightness();
  let busy = false, error = false, message = '', copyLabel = 'Copy selection + brightness', copying = false, destroyed = false;
  let copyTimer: number | undefined;
  const snapshot = () => ({ context, enabled: new Set(enabled), brightness: { ...brightness }, busy, error, message, copyLabel, copying });
  const store = createControlStore(snapshot());
  const render = () => { if (!destroyed) store.set(snapshot()); };
  const selection = (): CloudSelection | null => context ? { contextId: context.id,
    enabledIds: context.parts.filter(part => enabled.has(part.id)).map(part => part.id) } : null;
  const persist = () => {
    const value = selection(); if (!value) return;
    savedValues.set(value.contextId, { enabledIds: value.enabledIds, brightness: { ...brightness } }); writeSaved();
  };
  const publishSelection = () => { render(); const value = selection(); if (value) { persist(); onChange(value); } };
  const publishBrightness = () => { render(); if (context) { persist(); onBrightness({ ...brightness }); } };
  async function copyState() {
    const value = selection(); if (!value) return;
    if (copyTimer !== undefined) window.clearTimeout(copyTimer);
    copying = true; render();
    try {
      await navigator.clipboard.writeText(JSON.stringify({ schema: STORAGE_SCHEMA, selection: value, brightness }, null, 2));
      if (destroyed) return;
      copyLabel = 'Copied!'; copyTimer = window.setTimeout(() => { copyLabel = 'Copy selection + brightness'; render(); }, 2000);
    } catch { copyLabel = 'Copy failed — try again'; } finally { copying = false; render(); }
  }
  function CloudControlsView() {
    const state = useSyncExternalStore(store.subscribe, store.snapshot), current = state.context;
    if (!current) return null;
    const extended = current.parts.filter(part => part.kind === 'extended');
    const selected = extended.filter(part => state.enabled.has(part.id)).length;
    const retained = current.parts.reduce((sum, part) => sum + (state.enabled.has(part.id) ? part.signalFraction : 0), 0);
    const partRow = (part: CloudPart) => <div key={part.id} className="cloud-part" data-cloud-part={part.id}>
      <label htmlFor={`cloud-part-${part.id}`}><input id={`cloud-part-${part.id}`} data-cloud-part-id={part.id} type="checkbox"
        checked={state.enabled.has(part.id)} onChange={event => { if (event.currentTarget.checked) enabled.add(part.id); else enabled.delete(part.id); publishSelection(); }} />
        <span>{part.label}</span></label>
      <span className="cloud-part-signal" title="Source signal">{part.signalFraction > 0 && part.signalFraction < .001 ? '<0.1%' : `${(part.signalFraction * 100).toFixed(1)}%`}</span>
      {part.kind === 'extended' && <button type="button" className="text-button cloud-solo" data-cloud-solo={part.id}
        aria-label={`Show only ${part.label}`} onClick={() => { enabled = new Set([part.id]); publishSelection(); }}>Solo</button>}
    </div>;
    return <fieldset className="cloud-controls-fieldset" id="cloud-controls-panel" disabled={state.busy}>
      <legend>Reconstruction filters</legend><h3>Live brightness</h3>
      <p className="cloud-control-hint">100% uses native prepared brightness. These controls only attenuate.</p>
      {BRIGHTNESS.map(spec => <div key={spec.key} className="cloud-brightness-control">
        <label htmlFor={`cloud-brightness-${spec.key}`}>{spec.label}</label>
        <input type="range" id={`cloud-brightness-${spec.key}`} min="0" max="100" step="1" value={state.brightness[spec.key] * 100}
          onInput={event => { brightness = { ...brightness, [spec.key]: Number(event.currentTarget.value) / 100 }; publishBrightness(); }} />
        <output htmlFor={`cloud-brightness-${spec.key}`}>{Math.round(state.brightness[spec.key] * 100)}%</output>
      </div>)}
      <button type="button" id="cloud-brightness-reset" className="text-button" onClick={() => { brightness = nativeBrightness(); publishBrightness(); }}>Reset brightness</button>
      <h3>Broad light</h3><div className="cloud-part-list cloud-broad-list">{current.parts.filter(part => part.kind !== 'extended').map(partRow)}</div>
      <div className="cloud-extended-header"><h3>Detected structures ({extended.length})</h3>
        <label htmlFor="cloud-extended-master"><input type="checkbox" id="cloud-extended-master" checked={extended.length > 0 && selected === extended.length}
          ref={element => { if (element) element.indeterminate = selected > 0 && selected < extended.length; }}
          onChange={event => { extended.forEach(part => event.currentTarget.checked ? enabled.add(part.id) : enabled.delete(part.id)); publishSelection(); }} /> All</label></div>
      <p className="cloud-part-columns">Source signal %</p><div className="cloud-part-list cloud-structure-list">{extended.map(partRow)}</div>
      <p className="cloud-signal-summary">Source signal selected: {(retained * 100).toFixed(1)}%</p>
      <div className="cloud-actions">
        <button type="button" id="cloud-all" className="text-button" onClick={() => { enabled = new Set(current.parts.map(part => part.id)); publishSelection(); }}>Show all</button>
        <button type="button" id="cloud-default" className="text-button" onClick={() => { enabled = new Set(current.parts.filter(part => part.defaultEnabled).map(part => part.id)); publishSelection(); }}>Restore default</button>
        <button type="button" id="cloud-none" className="text-button" onClick={() => { enabled.clear(); publishSelection(); }}>Hide all</button>
        <button type="button" id="copy-cloud-controls" className="text-button" disabled={state.copying} onClick={() => void copyState()}>{state.copyLabel}</button>
      </div><p className="cloud-control-status" role="status" data-error={state.error ? 'true' : undefined}>{state.message}</p>
    </fieldset>;
  }
  root.render(<CloudControlsView />);
  return Object.freeze({
    setContext(next: CloudContext | null) {
      if (!next) { context = null; enabled.clear(); brightness = nativeBrightness(); render(); return; }
      validateContext(next); context = { ...next, parts: next.parts.map(part => ({ ...part })) };
      const allowed = new Set(context.parts.map(part => part.id));
      const explicit: readonly string[] | undefined = next.selection
        ? (Array.isArray(next.selection) ? next.selection : (next.selection as CloudSelection).enabledIds) : undefined;
      const saved = savedValues.get(context.id);
      enabled = new Set((explicit ?? saved?.enabledIds ?? context.parts.filter(part => part.defaultEnabled).map(part => part.id)).filter(id => allowed.has(id)));
      brightness = saved ? { ...saved.brightness } : nativeBrightness(); message = ''; error = false; render();
      onChange(selection()!); onBrightness({ ...brightness });
    },
    setBusy(value: boolean) { busy = value; render(); },
    setError(value: unknown) { error = Boolean(value); message = value ? (value instanceof Error ? value.message : String(value)) : ''; render(); },
    setStatus(value: string) { error = false; message = value; render(); },
    getSelection: selection,
    getBrightness: () => ({ ...brightness }),
    destroy() { destroyed = true; if (copyTimer !== undefined) window.clearTimeout(copyTimer); context = null; queueMicrotask(() => root.unmount()); },
  });
}
