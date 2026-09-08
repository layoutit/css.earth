import type { OverlayPlacement } from './overlay-placement';

type PlacementKey = keyof OverlayPlacement;

interface ControlSpec {
  key: PlacementKey;
  label: string;
  min: number;
  max: number;
  step: number;
  numberMin?: number;
  numberMax?: number;
}

const TRANSLATION: ControlSpec[] = [
  { key: 'x', label: 'X (kpc)', min: -30, max: 30, step: .05 },
  { key: 'y', label: 'Y (kpc)', min: -30, max: 30, step: .05 },
  { key: 'z', label: 'Z (kpc)', min: -30, max: 30, step: .05 },
];
const ROTATION: ControlSpec = { key: 'rotationZ', label: 'Rotation', min: -180, max: 180, step: .25, numberMin: -180, numberMax: 180 };
const TILT: ControlSpec[] = [
  { key: 'rotationX', label: 'X tilt', min: -180, max: 180, step: .25, numberMin: -180, numberMax: 180 },
  { key: 'rotationY', label: 'Y tilt', min: -180, max: 180, step: .25, numberMin: -180, numberMax: 180 },
];
const SIZE: ControlSpec = { key: 'scale', label: 'Size (%)', min: 1, max: 2000, step: .5, numberMin: .01 };

function addControl(host: HTMLElement, prefix: string, spec: ControlSpec, value: number,
  onChange: (partial: Partial<OverlayPlacement>) => void) {
  const row = document.createElement('div'); row.className = 'placement-control';
  const label = document.createElement('label'); label.textContent = spec.label;
  const range = document.createElement('input'); range.type = 'range'; range.id = `${prefix}-${spec.key}-range`; label.htmlFor = range.id;
  range.min = String(spec.min); range.max = String(spec.max); range.step = String(spec.step);
  const number = document.createElement('input'); number.type = 'number'; number.id = `${prefix}-${spec.key}`;
  number.setAttribute('aria-label', `${spec.label} value`);
  number.step = String(spec.step);
  if (spec.numberMin !== undefined) number.min = String(spec.numberMin);
  if (spec.numberMax !== undefined) number.max = String(spec.numberMax);
  const displayValue = spec.key === 'scale' ? value * 100 : value;
  range.value = String(displayValue); number.value = String(displayValue);
  const publish = (next: number) => onChange({ [spec.key]: spec.key === 'scale' ? next / 100 : next });
  range.addEventListener('input', () => { number.value = range.value; publish(Number(range.value)); });
  number.addEventListener('input', () => {
    const next = number.valueAsNumber;
    if (!Number.isFinite(next) || (spec.numberMin !== undefined && next < spec.numberMin) ||
        (spec.numberMax !== undefined && next > spec.numberMax)) return;
    range.value = String(Math.max(spec.min, Math.min(spec.max, next))); publish(next);
  });
  row.append(label, range, number); host.append(row);
  return { spec, range, number };
}

export function createOverlayPlacementControls({ id, label, placement, defaults, original, savedLocally, onChange, onCopy }: {
  id: string;
  label: string;
  placement: OverlayPlacement;
  defaults: OverlayPlacement;
  original?: OverlayPlacement;
  savedLocally: boolean;
  onChange(partial: Partial<OverlayPlacement>): void;
  onCopy(): Promise<void>;
}) {
  const panel = document.createElement('section'); panel.className = 'overlay-placement';
  panel.dataset.placementFor = id;
  const hint = document.createElement('p'); hint.className = 'placement-hint';
  hint.textContent = `100% is calibrated sky scale. Local +Y points up in Reference view. ${savedLocally ? 'Changes are saved locally.' : 'Changes last for this session.'}`;
  panel.append(hint);
  const controls = [...TRANSLATION.map(spec => addControl(panel, `placement-${id}`, spec, placement[spec.key], onChange)),
    addControl(panel, `placement-${id}`, ROTATION, placement.rotationZ, onChange),
    ...TILT.map(spec => addControl(panel, `placement-${id}`, spec, placement[spec.key], onChange)),
    addControl(panel, `placement-${id}`, SIZE, placement.scale, onChange)];
  const setValues = (value: OverlayPlacement) => {
    for (const control of controls) {
      const next = control.spec.key === 'scale' ? value.scale * 100 : value[control.spec.key];
      control.range.value = String(next); control.number.value = String(next);
    }
  };
  const actions = document.createElement('div'); actions.className = 'placement-actions';
  const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'text-button placement-reset';
  reset.id = `reset-placement-${id}`;
  reset.textContent = 'Reset fit';
  reset.addEventListener('click', () => { onChange(defaults); setValues(defaults); });
  reset.setAttribute('aria-label', `Reset ${label} fit`);
  if (original) {
    const originalButton = document.createElement('button'); originalButton.type = 'button';
    originalButton.className = 'text-button placement-original'; originalButton.id = `original-placement-${id}`;
    originalButton.textContent = 'Calibrated sky';
    originalButton.addEventListener('click', () => { onChange(original); setValues(original); });
    originalButton.setAttribute('aria-label', `Restore ${label} original sky placement`); actions.append(originalButton);
  }
  const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'text-button placement-copy';
  copy.id = `copy-placement-${id}`; copy.textContent = 'Copy positioning';
  copy.setAttribute('aria-label', `Copy ${label} positioning`);
  let feedbackTimer: number | undefined;
  copy.addEventListener('click', async () => {
    if (feedbackTimer !== undefined) window.clearTimeout(feedbackTimer);
    copy.disabled = true; copy.textContent = 'Copying…';
    try {
      await onCopy(); copy.textContent = 'Copied!';
      feedbackTimer = window.setTimeout(() => { copy.textContent = 'Copy positioning'; feedbackTimer = undefined; }, 2000);
    } catch {
      copy.textContent = 'Copy failed — try again';
    } finally { copy.disabled = false; }
  });
  actions.prepend(reset); actions.append(copy); panel.append(actions);
  return panel;
}
