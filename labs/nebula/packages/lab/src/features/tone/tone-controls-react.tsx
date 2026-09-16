import { useSyncExternalStore } from 'react';
import type { ControlPortals } from '../../ui/control-portals';
import { defaultOverlayTone, updateOverlayTone, type OverlayTone } from '../legacy-viewer/overlay-tone';

export interface ToneResource { sourcePath: string; url: string; width: number; height: number; }
type ToneTarget = 'image' | 'density';
interface ToneContext { subjectId: string; imageId?: string; imageLayer?: 'original' | 'diffuse' | 'stars'; removalStrength?: number; removalResultId?: string; }
interface ToneSpec { key: keyof OverlayTone; label: string; min: number; max: number; step: number; }

const STORAGE_KEY = 'cssearth-nebula-tone-state-v1';
const SPECS: ToneSpec[] = [
  { key: 'brightness', label: 'Brightness', min: .1, max: 4, step: .05 },
  { key: 'gamma', label: 'Gamma', min: .2, max: 4, step: .05 },
  { key: 'black', label: 'Black', min: 0, max: .95, step: .01 },
  { key: 'white', label: 'White', min: .05, max: 1, step: .01 },
];

function readSaved(): Map<string, OverlayTone> {
  const result = new Map<string, OverlayTone>();
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (value?.schema !== 'cssearth-nebula-tone-state@1' || !Array.isArray(value.values)) return result;
    for (const row of value.values) try {
      if (Array.isArray(row) && typeof row[0] === 'string' && row[1] && Object.keys(row[1]).length === 4) {
        result.set(row[0], updateOverlayTone(defaultOverlayTone(), row[1]));
      }
    } catch { /* Discard only the malformed tone. */ }
  } catch { /* Storage is optional in the local lab. */ }
  return result;
}
function writeSaved(values: Map<string, OverlayTone>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema: 'cssearth-nebula-tone-state@1', values: [...values] })); } catch { /* Session controls still work. */ }
}
const savedTones = readSaved();
const contextKey = (target: ToneTarget, context: ToneContext) =>
  `${target}:${context.subjectId}:${target === 'image' ? context.imageId ?? '' : ''}`;
const sameTone = (a: OverlayTone, b: OverlayTone) =>
  (Object.keys(a) as (keyof OverlayTone)[]).every(key => a[key] === b[key]);

interface ToneView { tone: OverlayTone; status: string; copy: string; copying: boolean; }
interface ToneStore { subscribe(listener: () => void): () => void; snapshot(): ToneView;
  change(key: keyof OverlayTone, value: number): void; reset(): void; copy(): Promise<void>; }
export function ToneControls({ target, store }: { target: ToneTarget; store: ToneStore }) {
  const view = useSyncExternalStore(store.subscribe, store.snapshot);
  return <section className="tone-controls" data-tone-target={target}><h3>Tone</h3>
    {SPECS.map(spec => <div className="tone-control" key={spec.key}>
      <label htmlFor={`${target}-tone-${spec.key}-range`}>{spec.label}</label>
      <input id={`${target}-tone-${spec.key}-range`} type="range" min={spec.min} max={spec.max} step={spec.step} value={view.tone[spec.key]} onChange={event => store.change(spec.key,event.target.valueAsNumber)} />
      <input id={`${target}-tone-${spec.key}`} type="number" min={spec.min} max={spec.max} step={spec.step} value={view.tone[spec.key]} aria-label={`${target} ${spec.label} value`} onChange={event => store.change(spec.key,event.target.valueAsNumber)} />
    </div>)}
    <div className="tone-actions"><button id={`reset-${target}-tone`} className="text-button" type="button" onClick={store.reset}>Reset tone</button>
      <button id={`copy-${target}-tone`} className="text-button" type="button" disabled={view.copying} onClick={() => void store.copy()}>{view.copy}</button></div>
    <p className="tone-status" role="status">{view.status}</p>
  </section>;
}
export function createToneControls({ host, controls, target, onApply }: {
  host: HTMLElement; controls: ControlPortals; target: ToneTarget;
  onApply(context: ToneContext, resources: ToneResource[], isCurrent: () => boolean): Promise<void>;
}) {
  const root = controls.mount(host), listeners = new Set<() => void>(), saved = savedTones, touched = new Set<string>();
  let context: ToneContext | null = null, tone = defaultOverlayTone(), revision = 0, disposed = false;
  let timer: number | undefined, feedback: number | undefined, pending: AbortController | null = null;
  let view: ToneView = { tone, status: '', copy: 'Copy tone', copying: false };
  const publish = (partial: Partial<ToneView> = {}) => { view = { ...view, ...partial, tone: { ...tone } }; for (const listener of listeners) listener(); };
  const prepare = async (expected: number, expectedContext: ToneContext, expectedTone: OverlayTone) => {
    pending = new AbortController(); publish({ status: target === 'image' ? 'Preparing image…' : 'Baking tone…' });
    try {
      const response = await fetch('/__nebula/prepare-tone', { method: 'POST', signal: pending.signal,
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...expectedContext, target, tone: expectedTone }) });
      if (!response.ok) throw new Error(`Tone preparation failed (HTTP ${response.status}).`);
      const body = await response.json() as { resources?: ToneResource[] };
      if (!Array.isArray(body.resources) || body.resources.some(resource => !resource || typeof resource.sourcePath !== 'string' ||
          typeof resource.url !== 'string' || !Number.isInteger(resource.width) || !Number.isInteger(resource.height))) throw new TypeError('Tone preparation returned invalid resources.');
      const current = () => !disposed && expected === revision && contextKey(target, expectedContext) === (context && contextKey(target, context));
      if (!current()) return;
      publish({ status: 'Applying tone…' }); await onApply(expectedContext, body.resources, current);
      if (current()) { touched.delete(contextKey(target, expectedContext)); publish({ status: 'Tone applied' }); }
    } catch (error) {
      if (!disposed && expected === revision && (error as { name?: string }).name !== 'AbortError') publish({ status: error instanceof Error ? error.message : String(error) });
    } finally { if (expected === revision) pending = null; }
  };
  const schedule = () => {
    if (!context || disposed) return;
    revision++; pending?.abort(); if (timer !== undefined) window.clearTimeout(timer);
    const expected = revision, expectedContext = { ...context }, expectedTone = { ...tone };
    publish({ status: 'Tone change queued…' });
    timer = window.setTimeout(() => { timer = undefined; void prepare(expected, expectedContext, expectedTone); }, 200);
  };
  const store: ToneStore = {
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }, snapshot: () => view,
    change(key, value) {
      if (!Number.isFinite(value)) return;
      try {
        tone = updateOverlayTone(tone, { [key]: value }); publish();
        if (context) { const id = contextKey(target, context); touched.add(id); saved.set(id, { ...tone }); writeSaved(saved); }
        schedule();
      } catch (error) { publish({ status: error instanceof Error ? error.message : String(error) }); }
    },
    reset() {
      tone = defaultOverlayTone(); publish();
      if (context) { const id = contextKey(target, context); touched.add(id); saved.delete(id); writeSaved(saved); }
      schedule();
    },
    async copy() {
      if (!context) return; const expected = revision; publish({ copying: true });
      try {
        await navigator.clipboard.writeText(JSON.stringify({ schema: 'cssearth-nebula-tone@1', ...context, target, tone }, null, 2));
        if (!disposed && expected === revision) { publish({ copy: 'Copied!' }); feedback = window.setTimeout(() => publish({ copy: 'Copy tone' }), 2000); }
      } catch { if (!disposed && expected === revision) publish({ copy: 'Copy failed — try again' }); }
      finally { if (!disposed && expected === revision) publish({ copying: false }); }
    },
  };
  root.render(<ToneControls target={target} store={store} />);
  return Object.freeze({
    setContext(next: ToneContext | null) {
      if (context && next && contextKey(target, context) === contextKey(target, next) && context.imageLayer === next.imageLayer &&
        context.removalStrength === next.removalStrength && context.removalResultId === next.removalResultId) return;
      if (!context && !next) return;
      revision++; pending?.abort(); if (timer !== undefined) window.clearTimeout(timer); timer = undefined; context = next ? { ...next } : null;
      tone = context ? { ...(saved.get(contextKey(target, context)) ?? defaultOverlayTone()) } : defaultOverlayTone();
      publish({ status: '', copying: false, copy: 'Copy tone' });
      if (context && (context.imageLayer !== undefined || !sameTone(tone, defaultOverlayTone()) || touched.has(contextKey(target, context)))) schedule();
    },
    getValue: () => ({ ...tone }),
    destroy() { disposed = true; revision++; pending?.abort(); window.clearTimeout(timer); window.clearTimeout(feedback); listeners.clear(); root.unmount(); },
  });
}
