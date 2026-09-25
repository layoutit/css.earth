import type { CloudAppearance } from '@cssearth/bake/volume';

const controls = [
  { key: 'brightness', label: 'Brightness', max: 200, min: 0, step: 5, factor: 100, suffix: '%',
    title: 'Material light level. 100% is neutral. High values can clip highlights. Catalogue stars remain independent.' },
  { key: 'gamma', label: 'Gamma', max: 300, min: 25, step: 5, factor: 100, suffix: '',
    title: 'RGB midtones. 1 is neutral; higher values lighten midtones, lower values deepen them. Cloud density stays fixed.' },
  { key: 'saturation', label: 'Saturation', max: 250, min: 0, step: 5, factor: 100, suffix: '%',
    title: 'Color intensity. 100% keeps the source colors; 0% removes color.' },
  { key: 'detailStrength', label: 'Detail strength', max: 200, min: 0, step: 5, factor: 100, suffix: '%',
    title: 'Deepen local dark lanes so bright knots stand out. 0% keeps the current material. Cloud shape and opacity stay fixed.' },
  { key: 'detailScale', label: 'Detail scale', max: 128, min: 2, step: 2, factor: 1, suffix: ' px',
    title: 'Small values emphasize fine detail; larger values emphasize broad structures. Radius at 1024px registered image width.' },
] as const;

export function CloudAppearanceControls({ value, disabled, reason, onChange }: {
  value: CloudAppearance; disabled: boolean; reason?: string; onChange(value: CloudAppearance): void;
}) {
  return <fieldset className="cloud-appearance-controls" disabled={disabled} title={disabled ? reason : undefined}>
    <legend>Cloud detail</legend>
    {controls.map(control => <div className="cloud-brightness-control" key={control.key}>
      <label htmlFor={`cloud-appearance-${control.key}`}>{control.label}</label>
      <input id={`cloud-appearance-${control.key}`} type="range" title={control.title}
        min={control.min} max={control.max} step={control.step} value={Math.round(value[control.key] * control.factor)}
        onInput={event => onChange({ ...value, [control.key]: Number(event.currentTarget.value) / control.factor })} />
      <output htmlFor={`cloud-appearance-${control.key}`}>{control.key === 'gamma' ? value.gamma.toFixed(2) : Math.round(value[control.key] * control.factor)}{control.suffix}</output>
    </div>)}
  </fieldset>;
}
