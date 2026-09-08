import { defaultOverlayTone, updateOverlayTone, type OverlayTone } from './overlay-tone';

export interface ToneResource { sourcePath: string; url: string; width: number; height: number; }
type ToneTarget = 'image' | 'density';
interface ToneContext { subjectId: string; imageId?: string; imageLayer?: 'original' | 'diffuse' | 'stars'; removalStrength?: number; samplingResultId?: string; }
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

export function createToneControls({ host, target, onApply }: {
  host: HTMLElement;
  target: ToneTarget;
  onApply(context: ToneContext, resources: ToneResource[], isCurrent: () => boolean): Promise<void>;
}) {
  const saved = savedTones, controls = new Map<keyof OverlayTone, { range: HTMLInputElement; number: HTMLInputElement }>();
  const group = document.createElement('section'); group.className = 'tone-controls'; group.dataset.toneTarget = target;
  const heading = document.createElement('h3'); heading.textContent = 'Tone'; group.append(heading);
  const touched = new Set<string>();
  let context: ToneContext | null = null, tone = defaultOverlayTone(), revision = 0;
  let timer: number | undefined, pending: AbortController | null = null;
  const status = document.createElement('p'); status.className = 'tone-status'; status.setAttribute('role', 'status');
  const render = () => {
    for (const spec of SPECS) {
      const control = controls.get(spec.key)!; control.range.value = String(tone[spec.key]); control.number.value = String(tone[spec.key]);
    }
  };
  const prepare = async (expected: number, expectedContext: ToneContext, expectedTone: OverlayTone) => {
    pending = new AbortController(); status.textContent = target === 'image' ? 'Preparing image…' : 'Baking tone…';
    try {
      const response = await fetch('/__nebula/prepare-tone', { method: 'POST', signal: pending.signal,
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...expectedContext, target, tone: expectedTone }) });
      if (!response.ok) throw new Error(`Tone preparation failed (HTTP ${response.status}).`);
      const body = await response.json() as { resources?: ToneResource[] };
      if (!Array.isArray(body.resources) || body.resources.some(resource => !resource || typeof resource.sourcePath !== 'string' ||
          typeof resource.url !== 'string' || !Number.isInteger(resource.width) || !Number.isInteger(resource.height))) {
        throw new TypeError('Tone preparation returned invalid resources.');
      }
      const current = () => expected === revision && contextKey(target, expectedContext) === (context && contextKey(target, context));
      if (!current()) return;
      status.textContent = 'Applying tone…'; await onApply(expectedContext, body.resources, current);
      if (current()) { touched.delete(contextKey(target, expectedContext)); status.textContent = 'Tone applied'; }
    } catch (error) {
      if (expected === revision && (error as { name?: string }).name !== 'AbortError') {
        status.textContent = error instanceof Error ? error.message : String(error);
      }
    } finally { if (expected === revision) pending = null; }
  };
  const schedule = () => {
    if (!context) return;
    revision++; pending?.abort(); if (timer !== undefined) window.clearTimeout(timer);
    const expected = revision, expectedContext = { ...context }, expectedTone = { ...tone };
    status.textContent = 'Tone change queued…';
    timer = window.setTimeout(() => { timer = undefined; void prepare(expected, expectedContext, expectedTone); }, 200);
  };
  for (const spec of SPECS) {
    const row = document.createElement('div'); row.className = 'tone-control';
    const label = document.createElement('label'); label.textContent = spec.label;
    const range = document.createElement('input'); range.type = 'range'; range.id = `${target}-tone-${spec.key}-range`;
    range.min = String(spec.min); range.max = String(spec.max); range.step = String(spec.step); label.htmlFor = range.id;
    const number = document.createElement('input'); number.type = 'number'; number.id = `${target}-tone-${spec.key}`;
    number.min = range.min; number.max = range.max; number.step = range.step; number.setAttribute('aria-label', `${target} ${spec.label} value`);
    const change = (value: number) => {
      try {
        tone = updateOverlayTone(tone, { [spec.key]: value }); render();
        if (context) { const key = contextKey(target, context); touched.add(key); saved.set(key, { ...tone }); writeSaved(saved); }
        schedule();
      } catch (error) { render(); status.textContent = error instanceof Error ? error.message : String(error); }
    };
    range.addEventListener('input', () => change(Number(range.value)));
    number.addEventListener('change', () => { if (Number.isFinite(number.valueAsNumber)) change(number.valueAsNumber); else render(); });
    controls.set(spec.key, { range, number }); row.append(label, range, number); group.append(row);
  }
  const actions = document.createElement('div'); actions.className = 'tone-actions';
  const reset = document.createElement('button'); reset.type = 'button'; reset.id = `reset-${target}-tone`; reset.className = 'text-button'; reset.textContent = 'Reset tone';
  reset.addEventListener('click', () => { tone = defaultOverlayTone(); render(); if (context) {
    const key = contextKey(target, context); touched.add(key); saved.delete(key); writeSaved(saved);
  } schedule(); });
  const copy = document.createElement('button'); copy.type = 'button'; copy.id = `copy-${target}-tone`; copy.className = 'text-button'; copy.textContent = 'Copy tone';
  copy.addEventListener('click', async () => {
    if (!context) return; copy.disabled = true;
    try {
      await navigator.clipboard.writeText(JSON.stringify({ schema: 'cssearth-nebula-tone@1', ...context, target, tone }, null, 2));
      copy.textContent = 'Copied!'; window.setTimeout(() => { copy.textContent = 'Copy tone'; }, 2000);
    } catch { copy.textContent = 'Copy failed — try again'; } finally { copy.disabled = false; }
  });
  actions.append(reset, copy); group.append(actions, status); host.replaceChildren(group); render();
  return Object.freeze({
    setContext(next: ToneContext | null) {
      if (context && next && contextKey(target, context) === contextKey(target, next) &&
        context.imageLayer === next.imageLayer && context.removalStrength === next.removalStrength && context.samplingResultId === next.samplingResultId) return;
      if (!context && !next) return;
      revision++; pending?.abort(); if (timer !== undefined) window.clearTimeout(timer); timer = undefined; context = next ? { ...next } : null;
      tone = context ? { ...(saved.get(contextKey(target, context)) ?? defaultOverlayTone()) } : defaultOverlayTone();
      status.textContent = ''; render();
      if (context && (context.imageLayer !== undefined || !sameTone(tone, defaultOverlayTone()) || touched.has(contextKey(target, context)))) schedule();
    },
    getValue: () => ({ ...tone }),
    destroy() { revision++; pending?.abort(); if (timer !== undefined) window.clearTimeout(timer); },
  });
}
