import { useEffect, useRef, useState } from 'react';
import type { ControlPortals } from '../../ui/control-portals';
import type { OverlayPlacement } from '@cssearth/bake/volume';

interface Props { id: string; label: string; placement: OverlayPlacement; defaults: OverlayPlacement; original?: OverlayPlacement;
  savedLocally: boolean; onChange(partial: Partial<OverlayPlacement>): void; onCopy(): Promise<void>; }
interface Spec { key: keyof OverlayPlacement; label: string; min: number; max: number; step: number; numberMin?: number; numberMax?: number; }
const specs: Spec[] = [
  ...(['x','y','z'] as const).map(key => ({ key, label: `${key.toUpperCase()} (kpc)`, min: -30, max: 30, step: .05 })),
  ...(['rotationZ','rotationX','rotationY'] as const).map((key,index) => ({ key, label: ['Rotation','X tilt','Y tilt'][index]!, min: -180, max: 180, step: .25, numberMin: -180, numberMax: 180 })),
  { key: 'scale', label: 'Size (%)', min: 1, max: 2000, step: .5, numberMin: .01 },
];
export function OverlayPlacementControls(props: Props) {
  const [placement, setPlacement] = useState(props.placement), [copy, setCopy] = useState('Copy positioning');
  const [copying, setCopying] = useState(false), revision = useRef(0), feedback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { setPlacement(props.placement); }, [props.placement]);
  useEffect(() => { revision.current++; setCopy('Copy positioning'); setCopying(false); return () => { revision.current++; clearTimeout(feedback.current); }; }, [props.id]);
  function change(partial: Partial<OverlayPlacement>) { props.onChange(partial); setPlacement(value => ({ ...value, ...partial })); }
  async function copyPlacement() {
    clearTimeout(feedback.current); const owner = revision.current; setCopying(true); setCopy('Copying…');
    try { await props.onCopy(); if (owner === revision.current) { setCopy('Copied!'); feedback.current = setTimeout(() => setCopy('Copy positioning'), 2000); } }
    catch { if (owner === revision.current) setCopy('Copy failed — try again'); }
    finally { if (owner === revision.current) setCopying(false); }
  }
  return <section className="overlay-placement" data-placement-for={props.id}>
    <p className="placement-hint" title="Placement is an inspection fit. It does not measure gas or dust depth.">100% is calibrated sky scale. Local +Y points up in Reference view. {props.savedLocally ? 'Changes are saved locally.' : 'Changes last for this session.'}</p>
    {specs.map(spec => {
      const value = spec.key === 'scale' ? placement.scale * 100 : placement[spec.key];
      const publish = (next: number) => { if (Number.isFinite(next) && (spec.numberMin === undefined || next >= spec.numberMin) && (spec.numberMax === undefined || next <= spec.numberMax)) change({ [spec.key]: spec.key === 'scale' ? next / 100 : next }); };
      return <div key={spec.key} className="placement-control"><label htmlFor={`placement-${props.id}-${spec.key}-range`}>{spec.label}</label>
        <input id={`placement-${props.id}-${spec.key}-range`} type="range" min={spec.min} max={spec.max} step={spec.step} value={Math.max(spec.min, Math.min(spec.max,value))} onChange={event => publish(event.target.valueAsNumber)} />
        <input id={`placement-${props.id}-${spec.key}`} type="number" aria-label={`${spec.label} value`} min={spec.numberMin} max={spec.numberMax} step={spec.step} value={value} onChange={event => publish(event.target.valueAsNumber)} />
      </div>;
    })}
    <div className="placement-actions"><button id={`reset-placement-${props.id}`} className="text-button placement-reset" type="button" aria-label={`Reset ${props.label} fit`} onClick={() => change(props.defaults)}>Reset fit</button>
      {props.original && <button id={`original-placement-${props.id}`} className="text-button placement-original" type="button" aria-label={`Restore ${props.label} original sky placement`} onClick={() => change(props.original!)}>Calibrated sky</button>}
      <button id={`copy-placement-${props.id}`} className="text-button placement-copy" type="button" aria-label={`Copy ${props.label} positioning`} disabled={copying} onClick={() => void copyPlacement()}>{copy}</button></div>
  </section>;
}
export function createOverlayPlacementControls(initial: Props, host: HTMLElement, controls: ControlPortals) {
  const root = controls.mount(host); let disposed = false;
  const update = (props: Props) => { if (!disposed) root.render(<OverlayPlacementControls {...props} />); };
  update(initial);
  return { update, destroy() { if (!disposed) { disposed = true; root.unmount(); } } };
}
