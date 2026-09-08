import type { ToneResource } from './tone-runtime';

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
  let context: CloudDensityContext | null = null, filter = defaultFilter(), generation = 0, destroyed = false;
  let pending: AbortController | null = null, copyTimer: number | undefined;
  const needsApply = new Set<string>();

  const fieldset = document.createElement('fieldset'); fieldset.className = 'cloud-density-fieldset'; fieldset.disabled = true;
  const legend = document.createElement('legend'); legend.textContent = 'Cloud cutoff'; fieldset.append(legend);
  const hint = document.createElement('p'); hint.className = 'cloud-control-hint';
  hint.textContent = 'Remove faint regions using the original Earth-facing view. The selection stays fixed through the cloud as you rotate. 0% restores the original.';
  fieldset.append(hint);

  const createPercentControl = (id: string, labelText: string) => {
    const row = document.createElement('div'); row.className = 'cloud-density-control';
    const label = document.createElement('label'); label.htmlFor = id; label.textContent = labelText;
    const range = document.createElement('input'); range.type = 'range'; range.id = id;
    range.min = '0'; range.max = '100'; range.step = '.1';
    const output = document.createElement('output'); output.htmlFor = id;
    row.append(label, range, output); fieldset.append(row); return { range, output };
  };
  const cutoff = createPercentControl('cloud-density-cutoff', 'Signal cutoff');
  const softness = createPercentControl('cloud-density-softness', 'Edge softness');
  const removedLabel = document.createElement('label'); removedLabel.className = 'cloud-density-removed';
  const removed = document.createElement('input'); removed.type = 'checkbox'; removed.id = 'cloud-density-show-removed';
  removedLabel.htmlFor = removed.id; removedLabel.append(removed, document.createTextNode(' Show removed signal'));
  fieldset.append(removedLabel);

  const actions = document.createElement('div'); actions.className = 'cloud-actions';
  const button = (id: string, text: string) => {
    const item = document.createElement('button'); item.type = 'button'; item.id = id; item.className = 'text-button'; item.textContent = text;
    actions.append(item); return item;
  };
  const apply = button('apply-cloud-density', 'Apply density filter');
  const reset = button('reset-cloud-density', 'Reset to original');
  const copy = button('copy-cloud-density', 'Copy filter JSON');
  const status = document.createElement('p'); status.className = 'cloud-control-status'; status.setAttribute('role', 'status');
  fieldset.append(actions, status); host.replaceChildren(fieldset);

  const render = () => {
    cutoff.range.value = String(filter.cutoff * 100); cutoff.output.textContent = `${(filter.cutoff * 100).toFixed(1)}%`;
    softness.range.value = String(filter.softness * 100); softness.output.textContent = `${(filter.softness * 100).toFixed(1)}%`;
    removed.checked = filter.showRemoved;
  };
  const updateDraft = () => {
    filter = { cutoff: Number(cutoff.range.value) / 100, softness: Number(softness.range.value) / 100,
      showRemoved: removed.checked };
  };
  cutoff.range.addEventListener('input', () => { updateDraft(); cutoff.output.textContent = `${cutoff.range.value}%`;
    status.textContent = 'Changes not applied'; delete status.dataset.error; });
  softness.range.addEventListener('input', () => { updateDraft(); softness.output.textContent = `${softness.range.value}%`;
    status.textContent = 'Changes not applied'; delete status.dataset.error; });

  const prepare = async (next: CloudDensityFilter) => {
    if (!context || destroyed) return;
    generation++; pending?.abort(); pending = new AbortController();
    const expected = generation, expectedContext: AppliedCloudDensityContext = { ...context, filter: { ...next } };
    const current = () => !destroyed && expected === generation && context?.subjectId === expectedContext.subjectId;
    needsApply.add(expectedContext.subjectId); save(expectedContext.subjectId, expectedContext.filter);
    status.textContent = 'Preparing density filter…'; delete status.dataset.error;
    try {
      const response = await fetch('/__nebula/prepare-cloud-density', { method: 'POST', signal: pending.signal,
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(expectedContext) });
      if (!response.ok) throw new Error(`Density preparation failed (HTTP ${response.status}).`);
      const body = await response.json() as { resources?: ToneResource[] };
      if (!Array.isArray(body.resources) || body.resources.some(resource => !resource || typeof resource.sourcePath !== 'string' ||
          typeof resource.url !== 'string' || !Number.isInteger(resource.width) || !Number.isInteger(resource.height))) {
        throw new TypeError('Density preparation returned invalid resources.');
      }
      if (!current()) return;
      status.textContent = 'Applying density filter…'; await onApply(expectedContext, body.resources, current);
      if (current()) {
        needsApply.delete(expectedContext.subjectId);
        status.textContent = sameFilter(filter, expectedContext.filter) ? 'Density filter applied' : 'Changes not applied';
      }
    } catch (error) {
      if (current() && (error as { name?: string }).name !== 'AbortError') {
        status.textContent = error instanceof Error ? error.message : String(error); status.dataset.error = 'true';
      }
    } finally { if (expected === generation) pending = null; }
  };

  apply.addEventListener('click', () => { updateDraft(); void prepare(filter); });
  removed.addEventListener('change', () => { updateDraft(); void prepare(filter); });
  reset.addEventListener('click', () => { filter = defaultFilter(); render(); void prepare(filter); });
  copy.addEventListener('click', async () => {
    if (!context) return; if (copyTimer !== undefined) window.clearTimeout(copyTimer); copy.disabled = true;
    try {
      await navigator.clipboard.writeText(JSON.stringify({ schema: STORAGE_SCHEMA, subjectId: context.subjectId, filter }, null, 2));
      copy.textContent = 'Copied!'; copyTimer = window.setTimeout(() => { copy.textContent = 'Copy filter JSON'; }, 2000);
    } catch { copy.textContent = 'Copy failed — try again'; } finally { copy.disabled = false; }
  });

  render();
  return Object.freeze({
    setContext(next: CloudDensityContext | null) {
      if (context && next && context.subjectId === next.subjectId) return;
      generation++; pending?.abort(); pending = null; context = next ? { ...next } : null;
      filter = context ? { ...(savedFilters.get(context.subjectId) ?? defaultFilter()) } : defaultFilter();
      fieldset.disabled = !context; status.textContent = ''; delete status.dataset.error; render();
      if (context && (!sameFilter(filter, defaultFilter()) || needsApply.has(context.subjectId))) void prepare(filter);
    },
    getValue: () => ({ ...filter }),
    destroy() { destroyed = true; generation++; pending?.abort(); if (copyTimer !== undefined) window.clearTimeout(copyTimer); host.replaceChildren(); },
  });
}
