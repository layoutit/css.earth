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
  { key: 'x', label: 'X (kpc)', min: -30, max: 30, step: .1 },
  { key: 'y', label: 'Y (kpc)', min: -30, max: 30, step: .1 },
  { key: 'z', label: 'Z (kpc)', min: -30, max: 30, step: .1 },
];
const ROTATION: ControlSpec = { key: 'rotationZ', label: 'Rotation', min: -180, max: 180, step: 1, numberMin: -180, numberMax: 180 };
const TILT: ControlSpec[] = [
  { key: 'rotationX', label: 'X tilt', min: -180, max: 180, step: 1, numberMin: -180, numberMax: 180 },
  { key: 'rotationY', label: 'Y tilt', min: -180, max: 180, step: 1, numberMin: -180, numberMax: 180 },
];
const SIZE: ControlSpec = { key: 'scale', label: 'Size (%)', min: 10, max: 300, step: 1, numberMin: .01 };

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

export function createOverlayPlacementControls({ id, label, placement, defaults, onChange, onCopy }: {
  id: string;
  label: string;
  placement: OverlayPlacement;
  defaults: OverlayPlacement;
  onChange(partial: Partial<OverlayPlacement>): void;
  onCopy(): Promise<void>;
}) {
  const details = document.createElement('details'); details.className = 'overlay-placement';
  details.dataset.placementFor = id;
  const summary = document.createElement('summary'); summary.textContent = 'Adjust placement'; details.append(summary);
  const hint = document.createElement('p'); hint.className = 'placement-hint';
  hint.textContent = 'Manual placement for this session. Reset restores the original. Local +Y points up in Reference view.';
  details.append(hint);
  const controls = [...TRANSLATION.map(spec => addControl(details, `placement-${id}`, spec, placement[spec.key], onChange)),
    addControl(details, `placement-${id}`, ROTATION, placement.rotationZ, onChange),
    addControl(details, `placement-${id}`, SIZE, placement.scale, onChange)];
  const tilt = document.createElement('details'); tilt.className = 'overlay-tilt';
  const tiltSummary = document.createElement('summary'); tiltSummary.textContent = '3D tilt'; tilt.append(tiltSummary);
  controls.push(...TILT.map(spec => addControl(tilt, `placement-${id}`, spec, placement[spec.key], onChange)));
  details.append(tilt);
  const actions = document.createElement('div'); actions.className = 'placement-actions';
  const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'text-button placement-reset';
  reset.id = `reset-placement-${id}`;
  reset.textContent = 'Reset placement';
  reset.addEventListener('click', () => {
    onChange(defaults);
    for (const control of controls) {
      const value = control.spec.key === 'scale' ? defaults.scale * 100 : defaults[control.spec.key];
      control.range.value = String(value); control.number.value = String(value);
    }
  });
  reset.setAttribute('aria-label', `Reset ${label} placement`);
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
  actions.append(reset, copy); details.append(actions);
  return details;
}
