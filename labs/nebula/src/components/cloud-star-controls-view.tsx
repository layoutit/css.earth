import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createControlStore } from '../utils/control-store';
/** Visible lab controls for the independently prepared bright-star layer. */
export interface CloudStarOptions { enabled: boolean; brightness: number; size: number; }
export interface CloudStarContext { id: string; count: number; sourceUrl: string; }
const KEY = 'cssearth-nebula-bright-stars@1';
const defaults = (): CloudStarOptions => ({ enabled: true, brightness: .7, size: 1 });
type SavedOptions = Omit<CloudStarOptions, 'size'> & { size?: number };
const valid = (value: unknown): value is SavedOptions => {
  if (!value || typeof value !== 'object') return false;
  const item = value as SavedOptions;
  return typeof item.enabled === 'boolean' && Number.isFinite(item.brightness) && item.brightness >= 0 && item.brightness <= 1 &&
    (item.size === undefined || (Number.isFinite(item.size) && item.size >= .5 && item.size <= 3));
};

export function createCloudStarControls({ host, onChange }: {
  host: HTMLElement; onChange(options: CloudStarOptions): void;
}) {
  const root = createRoot(host);
  let context: CloudStarContext | null = null, options = defaults(), destroyed = false;
  const saved = new Map<string, CloudStarOptions>();
  try {
    for (const row of JSON.parse(localStorage.getItem(KEY) ?? '[]'))
      if (Array.isArray(row) && typeof row[0] === 'string' && valid(row[1])) saved.set(row[0], { ...defaults(), ...row[1] });
  } catch { /* Local storage is optional. */ }
  const snapshot = () => ({ context, options: { ...options } });
  const store = createControlStore(snapshot());
  const render = () => { if (!destroyed) store.set(snapshot()); };
  function publish() {
    render(); if (!context) return;
    saved.set(context.id, { ...options });
    try { localStorage.setItem(KEY, JSON.stringify([...saved])); } catch { /* Session controls still work. */ }
    onChange({ ...options });
  }
  function CloudStarControlsView() {
    const state = useSyncExternalStore(store.subscribe, store.snapshot);
    if (!state.context) return null;
    return <fieldset className="cloud-star-fieldset"><legend>Bright stars</legend>
      <label className="cloud-density-removed" htmlFor="cloud-stars-enabled"><input id="cloud-stars-enabled" type="checkbox"
        checked={state.options.enabled} onChange={event => { options = { ...options, enabled: event.currentTarget.checked }; publish(); }} /> Show catalog stars</label>
      {(['brightness', 'size'] as const).map(key => <div className="cloud-brightness-control" key={key}>
        <label htmlFor={`cloud-stars-${key}`}>{key === 'brightness' ? 'Exposure' : 'Size'}</label>
        <input type="range" title={key === 'brightness' ? 'Scale the prepared star light together, preserving relative brightness.' : 'Scale all point diameters together.'} id={`cloud-stars-${key}`} min={key === 'size' ? 50 : 0} max={key === 'size' ? 300 : 100} step={key === 'size' ? 5 : 1}
          value={Math.round(state.options[key] * 100)} onInput={event => { options = { ...options, [key]: Number(event.currentTarget.value) / 100 }; publish(); }} />
        <output htmlFor={`cloud-stars-${key}`}>{Math.round(state.options[key] * 100)}%</output>
      </div>)}
      <p className="cloud-control-hint">{state.context.count.toLocaleString()} catalog stars. Sky positions are measured; depths are modeled.</p>
      <a className="cloud-star-source" href={state.context.sourceUrl} target="_blank" rel="noreferrer">Catalog source ↗</a>
    </fieldset>;
  }
  host.hidden = true; root.render(<CloudStarControlsView />);
  return {
    setContext(next: CloudStarContext | null) {
      if (context?.id === next?.id) { if (next) onChange({ ...options }); return; }
      context = next; host.hidden = !next;
      if (!next) { render(); return; }
      options = { ...(saved.get(next.id) ?? defaults()) }; render(); onChange({ ...options });
    },
    getValue: () => ({ ...options }),
    destroy() { destroyed = true; context = null; queueMicrotask(() => root.unmount()); },
  };
}
