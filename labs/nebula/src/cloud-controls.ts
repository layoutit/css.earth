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
  host: HTMLElement;
  onChange(selection: CloudSelection): void;
  onBrightness(balance: CloudBrightness): void;
}) {
  let context: CloudContext | null = null;
  let enabled = new Set<string>();
  let brightness = nativeBrightness();
  let fieldset: HTMLFieldSetElement | null = null;
  let status: HTMLParagraphElement | null = null;
  let externalStatus = '';
  let busy = false, hasError = false;
  let copyTimer: number | undefined;

  const selection = (): CloudSelection | null => context ? { contextId: context.id, enabledIds: context.parts
    .filter(part => enabled.has(part.id)).map(part => part.id) } : null;
  const persist = () => {
    const current = selection();
    if (!current) return;
    savedValues.set(current.contextId, { enabledIds: [...current.enabledIds], brightness: { ...brightness } });
    writeSaved();
  };
  const publishSelection = () => { const current = selection(); if (current) { persist(); onChange(current); } };
  const publishBrightness = () => { if (context) { persist(); onBrightness({ ...brightness }); } };
  const render = () => {
    host.replaceChildren(); fieldset = null; status = null;
    if (!context) return;
    const current = context;
    const box = document.createElement('fieldset'); box.className = 'cloud-controls-fieldset'; box.id = 'cloud-controls-panel';
    box.disabled = busy; fieldset = box;
    const legend = document.createElement('legend'); legend.textContent = 'Reconstruction filters'; box.append(legend);

    const signalSummary = document.createElement('p'); signalSummary.className = 'cloud-signal-summary';
    const updateSummary = () => {
      const retained = current.parts.reduce((sum, part) => sum + (enabled.has(part.id) ? part.signalFraction : 0), 0);
      signalSummary.textContent = `Source signal retained: ${(retained * 100).toFixed(1)}%`;
    };

    const brightnessHeading = document.createElement('h3'); brightnessHeading.textContent = 'Live brightness';
    const brightnessHint = document.createElement('p'); brightnessHint.className = 'cloud-control-hint';
    brightnessHint.textContent = '100% uses native prepared brightness. These controls only attenuate.';
    box.append(brightnessHeading, brightnessHint);
    for (const spec of BRIGHTNESS) {
      const row = document.createElement('div'); row.className = 'cloud-brightness-control';
      const label = document.createElement('label'); label.textContent = spec.label;
      const range = document.createElement('input'); range.type = 'range';
      range.id = `cloud-brightness-${spec.key}`; range.min = '0'; range.max = '100'; range.step = '1';
      range.value = String(brightness[spec.key] * 100); label.htmlFor = range.id;
      const output = document.createElement('output'); output.htmlFor = range.id; output.textContent = `${Math.round(brightness[spec.key] * 100)}%`;
      range.addEventListener('input', () => {
        brightness = { ...brightness, [spec.key]: Number(range.value) / 100 };
        output.textContent = `${range.value}%`; publishBrightness();
      });
      row.append(label, range, output); box.append(row);
    }
    const resetBrightness = document.createElement('button'); resetBrightness.type = 'button';
    resetBrightness.id = 'cloud-brightness-reset'; resetBrightness.className = 'text-button'; resetBrightness.textContent = 'Reset brightness';
    resetBrightness.addEventListener('click', () => { brightness = nativeBrightness(); render(); publishBrightness(); });
    box.append(resetBrightness);

    const addPartRow = (part: CloudPart, list: HTMLElement) => {
      const row = document.createElement('div'); row.className = 'cloud-part'; row.dataset.cloudPart = part.id;
      const label = document.createElement('label');
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = enabled.has(part.id);
      checkbox.id = `cloud-part-${part.id}`; checkbox.dataset.cloudPartId = part.id; label.htmlFor = checkbox.id;
      const name = document.createElement('span'); name.textContent = part.label;
      const fraction = document.createElement('span'); fraction.className = 'cloud-part-signal';
      fraction.textContent = part.signalFraction > 0 && part.signalFraction < .001 ? '<0.1%' : `${(part.signalFraction * 100).toFixed(1)}%`;
      fraction.title = 'Source signal';
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) enabled.add(part.id); else enabled.delete(part.id);
        updateSummary(); syncMaster(); publishSelection();
      });
      label.append(checkbox, name); row.append(label, fraction);
      if (part.kind === 'extended') {
        const solo = document.createElement('button'); solo.type = 'button'; solo.className = 'text-button cloud-solo';
        solo.dataset.cloudSolo = part.id;
        solo.textContent = 'Solo'; solo.setAttribute('aria-label', `Show only ${part.label}`);
        solo.addEventListener('click', () => { enabled = new Set([part.id]); render(); publishSelection(); });
        row.append(solo);
      }
      list.append(row);
    };

    const broad = current.parts.filter(part => part.kind !== 'extended');
    const extended = current.parts.filter(part => part.kind === 'extended');
    const broadHeading = document.createElement('h3'); broadHeading.textContent = 'Broad light'; box.append(broadHeading);
    const broadList = document.createElement('div'); broadList.className = 'cloud-part-list cloud-broad-list';
    broad.forEach(part => addPartRow(part, broadList)); box.append(broadList);

    const extendedHeader = document.createElement('div'); extendedHeader.className = 'cloud-extended-header';
    const extendedTitle = document.createElement('h3'); extendedTitle.textContent = `Detected structures (${extended.length})`;
    const masterLabel = document.createElement('label');
    const master = document.createElement('input'); master.type = 'checkbox'; master.id = 'cloud-extended-master';
    masterLabel.htmlFor = master.id; masterLabel.append(master, document.createTextNode(' All'));
    const syncMaster = () => {
      const count = extended.filter(part => enabled.has(part.id)).length;
      master.checked = extended.length > 0 && count === extended.length; master.indeterminate = count > 0 && count < extended.length;
    };
    master.addEventListener('change', () => {
      extended.forEach(part => master.checked ? enabled.add(part.id) : enabled.delete(part.id));
      render(); publishSelection();
    });
    extendedHeader.append(extendedTitle, masterLabel); box.append(extendedHeader);
    const columns = document.createElement('p'); columns.className = 'cloud-part-columns'; columns.textContent = 'Source signal %'; box.append(columns);
    const extendedList = document.createElement('div'); extendedList.className = 'cloud-part-list cloud-structure-list';
    extended.forEach(part => addPartRow(part, extendedList)); box.append(extendedList, signalSummary); syncMaster(); updateSummary();

    const actions = document.createElement('div'); actions.className = 'cloud-actions';
    const action = (text: string, handler: () => void) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button';
      button.textContent = text; button.addEventListener('click', handler); actions.append(button); return button;
    };
    const showAll = action('Show all', () => { enabled = new Set(current.parts.map(part => part.id)); render(); publishSelection(); });
    showAll.id = 'cloud-all';
    const restore = action('Restore default', () => { enabled = new Set(current.parts.filter(part => part.defaultEnabled).map(part => part.id));
      render(); publishSelection(); }); restore.id = 'cloud-default';
    const hideAll = action('Hide all', () => { enabled.clear(); render(); publishSelection(); }); hideAll.id = 'cloud-none';
    const copy = action('Copy selection + brightness', () => { void copyState(copy); }); copy.id = 'copy-cloud-controls';
    const message = document.createElement('p'); message.className = 'cloud-control-status'; message.setAttribute('role', 'status');
    message.textContent = externalStatus; if (hasError) message.dataset.error = 'true'; status = message;
    box.append(actions, message); host.append(box);
  };

  const copyState = async (button: HTMLButtonElement) => {
    const current = selection(); if (!current) return;
    if (copyTimer !== undefined) window.clearTimeout(copyTimer);
    button.disabled = true;
    try {
      await navigator.clipboard.writeText(JSON.stringify({ schema: 'cssearth-nebula-cloud-controls@1',
        selection: current, brightness }, null, 2));
      button.textContent = 'Copied!'; copyTimer = window.setTimeout(() => { button.textContent = 'Copy selection + brightness'; }, 2000);
    } catch { button.textContent = 'Copy failed — try again'; } finally { button.disabled = false; }
  };

  host.replaceChildren();
  return Object.freeze({
    setContext(next: CloudContext | null) {
      if (!next) { context = null; enabled.clear(); brightness = nativeBrightness(); render(); return; }
      validateContext(next); context = { ...next, parts: next.parts.map(part => ({ ...part })) };
      const allowed = new Set(context.parts.map(part => part.id));
      const explicit: readonly string[] | undefined = next.selection
        ? (Array.isArray(next.selection) ? next.selection : (next.selection as CloudSelection).enabledIds)
        : undefined;
      const saved = savedValues.get(context.id);
      enabled = new Set((explicit ?? saved?.enabledIds ?? context.parts.filter(part => part.defaultEnabled).map(part => part.id))
        .filter(id => allowed.has(id)));
      brightness = saved ? { ...saved.brightness } : nativeBrightness(); externalStatus = ''; render();
      onChange(selection()!); onBrightness({ ...brightness });
    },
    setBusy(nextBusy: boolean) { busy = nextBusy; if (fieldset) fieldset.disabled = busy; },
    setError(error: unknown) { hasError = Boolean(error); externalStatus = error ? (error instanceof Error ? error.message : String(error)) : ''; if (status) {
      status.textContent = externalStatus; status.dataset.error = String(Boolean(error));
    } },
    setStatus(message: string) { hasError = false; externalStatus = message; if (status) { status.textContent = message; delete status.dataset.error; } },
    getSelection: selection,
    getBrightness: () => ({ ...brightness }),
    destroy() { if (copyTimer !== undefined) window.clearTimeout(copyTimer); context = null; host.replaceChildren(); },
  });
}
