import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { GeometryMap } from '../alignment/observations-ui/geometry-model';
import type { Matrix } from '../alignment/observations-ui/model';
import type { StructureImage } from '../alignment/observations-ui/structures-model';
import type { ShapeCloudComponent, ShapeCloudMode } from '../reconstruction/shape-cloud/types';
import { formatShapeExpression, parseShapeExpression } from '../reconstruction/shape-cloud/expression';
import { localFile } from '../viewer/viewer';
import { componentScope, editShapeComponents, useShapeCloudState, type EditScope, type NumericField } from './shape-cloud-state';
import { ShapeCloudStage, earthCloudView, type CloudView } from './shape-cloud-stage';
import './shape-cloud.css';

interface Props {
  image: StructureImage; geometry: GeometryMap; cataloguePath: string; host: Element | null;
  matrix: Matrix; frame: { width: number; height: number }; onDetected(): void;
}
const modes = [
  { id: 'compare', label: 'Compare', symbol: '◫', title: 'Source and untextured cloud side by side, with linked framing.' },
  { id: 'overlay', label: 'Overlay', symbol: '▱', title: 'Untextured cloud over the registered source image.' },
  { id: 'textured', label: 'Textured', symbol: '◉', title: 'Source colors on exactly the same cloud.' },
] as const;
function Slider({ id, label, value, min, max, step = .01, display, title, onChange, onBegin, onSettle }: {
  id: string; label: string; value: number; min: number; max: number; step?: number; display?: string; title?: string; onChange(value: number): void;
  onBegin?(): void; onSettle?(): void;
}) {
  return <div className="structure-slider shape-cloud-slider"><label htmlFor={id} title={title}>{label}</label>
    <output htmlFor={id}>{display ?? value.toFixed(2)}</output>
    <input id={id} type="range" min={min} max={max} step={step} value={Math.max(min, Math.min(max, value))}
      aria-valuetext={display ?? value.toFixed(2)} onChange={event => onChange(event.target.valueAsNumber)}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); onBegin?.(); }} onPointerUp={onSettle}
      onPointerCancel={onSettle} onKeyUp={onSettle} onBlur={onSettle} />
  </div>;
}
function Session({ image, geometry, cataloguePath, host, matrix, frame, onDetected, mode, setMode, view, setView }: Props & {
  mode: ShapeCloudMode; setMode(value: ShapeCloudMode): void; view: CloudView; setView(value: CloudView): void;
}) {
  const state = useShapeCloudState(image, geometry, cataloguePath), { settings, result } = state;
  const selectionKey = `nebula:shape-cloud-selection:1:${cataloguePath}:${image.id}:${image.sourceSha256}:${image.mapSha256}:${image.geometry?.sha256}`;
  const [scope, setScope] = useState<EditScope>('selected'), [selectedId, selectId] = useState(() => {
    try { return localStorage.getItem(selectionKey) ?? ''; } catch { return ''; }
  });
  function setSelectedId(id: string) {
    selectId(id); try { localStorage.setItem(selectionKey, id); } catch { /* Editing remains available when selection persistence is unavailable. */ }
  }
  const [outlines, setOutlines] = useState(true), [opacity, setOpacity] = useState(.5), [beforeSolo, setBeforeSolo] = useState<Record<string, boolean> | null>(null);
  const [hoveredId, setHoveredId] = useState(''), [formula, setFormula] = useState<string | null>(null), [formulaError, setFormulaError] = useState('');
  const selected = settings.components.find(item => item.id === selectedId) ?? settings.components[0];
  const workingMatrix = useMemo<Matrix>(() => [matrix[0] * image.nativeWidth / image.width, matrix[1] * image.nativeWidth / image.width,
    matrix[2] * image.nativeHeight / image.height, matrix[3] * image.nativeHeight / image.height, matrix[4], matrix[5]], [matrix, image]);
  const source = `${localFile(result?.source.path ?? `${image.directory}/source.png`)}?v=${result?.source.sha256 ?? image.mapSha256}`;
  function edit(field: NumericField, value: number) {
    if (selected) state.edit(editShapeComponents(settings, selected, scope, field, value));
  }
  function componentPatch(patch: Partial<Pick<ShapeCloudComponent, 'shape' | 'operation'>>) {
    if (!selected) return; const ids = new Set(componentScope(settings.components, selected, scope).map(item => item.id));
    state.edit({ ...settings, components: settings.components.map(item => ids.has(item.id) ? { ...item, ...patch } : item) }, true);
  }
  function applyFormula() {
    if (formula === null) return;
    try { state.edit(parseShapeExpression(formula, settings), true); setFormula(null); setFormulaError(''); }
    catch (reason) { setFormulaError(reason instanceof Error ? reason.message : 'Invalid shape formula.'); }
  }
  function toggleEnabled(enabled: boolean) {
    if (!selected) return; const ids = new Set(componentScope(settings.components, selected, scope).map(item => item.id));
    state.edit({ ...settings, components: settings.components.map(item => ids.has(item.id) ? { ...item, enabled } : item) }, true); setBeforeSolo(null);
  }
  function solo() {
    if (!selected) return;
    if (beforeSolo) {
      state.edit({ ...settings, components: settings.components.map(item => ({ ...item, enabled: beforeSolo[item.id] ?? item.enabled })) }, true); setBeforeSolo(null);
    } else {
      setBeforeSolo(Object.fromEntries(settings.components.map(item => [item.id, item.enabled])));
      state.edit({ ...settings, components: settings.components.map(item => ({ ...item, enabled: item.id === selected.id })) }, true);
    }
  }
  const anyEnabled = selected && componentScope(settings.components, selected, scope).some(item => item.enabled);
  const previewMessage = state.active || state.dirty ? 'Updating live preview…' : result?.quality === 'draft' ? 'Draft · refining detail…' : result ? 'Live preview · up to date' : 'Preparing live preview…';
  const field = (key: NumericField, label: string, min: number, max: number, title: string, step = .01): ReactNode => selected &&
    <Slider key={key} id={`shape-cloud-${key}`} label={label} value={selected[key]} min={min} max={max} step={step} title={title}
      onChange={value => edit(key, value)} onBegin={state.begin} onSettle={state.settle} />;
  return <section className="shape-cloud-workbench" aria-label="Shape cloud controls" data-image-id={image.id}
    data-preview-quality={result?.quality ?? ''} data-result-id={result?.id ?? ''} data-preview-active={state.active} data-preview-current={!state.dirty}>
    <div className="image-layer-buttons shape-cloud-modes" role="group" aria-label="Cloud comparison mode">
      {modes.map(item => <button type="button" key={item.id} aria-pressed={mode === item.id} title={item.title} onClick={() => setMode(item.id)}>
        <span aria-hidden="true">{item.symbol}</span><span>{item.label}</span>
      </button>)}
    </div>
    <div className="shape-cloud-feedback" data-active={state.active}>
      <progress aria-label="Cloud preparation progress" aria-hidden={!state.active}
        max={state.job?.progress?.total ?? 1} value={state.job?.progress?.current ?? 0} />
      <p className="interaction-hint shape-cloud-status" role="status" data-unapplied={state.dirty}
        title={state.active ? state.job?.progress?.message || previewMessage : previewMessage}>{previewMessage}</p>
    </div>
    {(state.error || state.storageError) && <p className="interaction-hint shape-cloud-error" role="alert">{state.error || state.storageError}</p>}
    {state.error && <button type="button" onClick={state.retry}>Retry preview</button>}
    <div className="shape-cloud-camera-actions"><button type="button" onClick={() => setView(earthCloudView)}>Earth view</button>
      <button type="button" aria-pressed={!view.locked} onClick={() => setView(view.locked ? { ...view, locked: false } : { ...view, locked: true, yaw: 0, pitch: 0 })}>
        {view.locked ? 'Unlock rotation' : 'Lock to Earth'}</button></div>
    <label className="observation-check"><input type="checkbox" checked={outlines} onChange={event => setOutlines(event.target.checked)} /> Shape outlines</label>
    {mode === 'overlay' && <Slider id="shape-cloud-overlay-opacity" label="Cloud" value={opacity} min={0} max={1}
      display={`${Math.round(opacity * 100)}%`} onChange={setOpacity} />}
    <div className="shape-cloud-editing">
      <div className="shape-cloud-scope" role="group" aria-label="Edit scope">{(['all', 'group', 'selected'] as const).map(value =>
        <button type="button" key={value} aria-pressed={scope === value} onClick={() => setScope(value)}>{value === 'all' ? 'All' : value === 'group' ? 'Group' : 'Selected'}</button>)}</div>
      <label className="field-label" htmlFor="shape-cloud-component">Component</label>
      <select id="shape-cloud-component" value={selected?.id ?? ''} onChange={event => setSelectedId(event.target.value)}>
        {settings.components.map((item, index) => <option key={item.id} value={item.id}>S{index + 1} · {item.label}{item.memberIds.length > 1 ? ` · ${item.memberIds.length} merged contours` : ''}{item.enabled ? '' : ' · off'}</option>)}
      </select>
      <div className="shape-cloud-types"><label htmlFor="shape-cloud-shape">Shape<select id="shape-cloud-shape" value={selected?.shape ?? 'shell'} onChange={event => {
        const shape = event.target.value; if (shape === 'shell' || shape === 'ring' || shape === 'ellipsoid') componentPatch({ shape });
      }}><option value="shell">◯ Shell</option><option value="ring">◎ Ring</option><option value="ellipsoid">● Ellipsoid</option></select></label>
        <label htmlFor="shape-cloud-operation">Operation<select id="shape-cloud-operation" value={selected?.operation ?? 'add'} onChange={event => {
          const operation = event.target.value; if (operation === 'add' || operation === 'subtract') componentPatch({ operation });
        }}><option value="add">+ Add</option><option value="subtract">− Subtract</option></select></label></div>
      <div className="shape-cloud-component-actions"><label className="observation-check"><input type="checkbox" checked={Boolean(anyEnabled)} onChange={event => toggleEnabled(event.target.checked)} /> Enabled</label>
        <button type="button" aria-pressed={Boolean(beforeSolo)} disabled={!selected} onClick={solo}>{beforeSolo ? 'Restore others' : 'Solo'}</button></div>
      {field('weight', 'Weight', 0, 5, 'Relative emission of the selected scope. Zero emits no light.')}
      {field('thickness', 'Thickness', .01, .8, 'Relative wall thickness of the inferred shell.')}
      {field('softness', 'Softness', .005, .5, 'Smooth falloff at the inferred shell boundary.', .005)}
      {field('depth', 'Depth', .05, 2, 'Assumed line-of-sight depth relative to the fitted axes; not a measurement.')}
      {field('x', 'Horizontal', -image.width, image.width * 2, 'Position in source pixels. Bulk moves preserve relative centers.', .1)}
      {field('y', 'Vertical', -image.height, image.height * 2, 'Position in source pixels. Bulk moves preserve relative centers.', .1)}
      {field('radiusX', 'Size X', 2, Math.max(image.width, image.height) * 2, 'Radius in source pixels. Bulk changes preserve relative sizes.', .1)}
      {field('radiusY', 'Size Y', 2, Math.max(image.width, image.height) * 2, 'Radius in source pixels. Bulk changes preserve relative sizes.', .1)}
      {field('rotationDegrees', 'Rotation', -360, 360, 'Angle in the registered source plane. Bulk changes preserve relative angles.', .1)}
      <Slider id="shape-cloud-exposure" label="Exposure" value={settings.exposure} min={.05} max={5} title="Global baked exposure; identical across comparison modes."
        onChange={exposure => state.edit({ ...settings, exposure })} onBegin={state.begin} onSettle={state.settle} />
      <label className="field-label" htmlFor="shape-cloud-formula" title="Signed shape weights. S1 + 0.4 * S2 - 0.8 * S3. Omitted terms are disabled. Enter or leave the field to apply.">Formula</label>
      <input id="shape-cloud-formula" type="text" spellCheck={false} value={formula ?? formatShapeExpression(settings)} aria-invalid={Boolean(formulaError)}
        onChange={event => { setFormula(event.target.value); setFormulaError(''); }} onBlur={applyFormula}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyFormula(); } }} />
      {formulaError && <p className="interaction-hint shape-cloud-error" role="alert">{formulaError}</p>}
      <button type="button" className="text-button" onClick={() => { state.reset(); setBeforeSolo(null); }}>Reset to detected</button>
    </div>
    <div className="shape-cloud-foot"><button type="button" className="text-button" onClick={onDetected}>Detected lines</button>
      <span className="interaction-hint" title="Nearby duplicate contours are merged. Shell depth, thickness and falloff are model assumptions, not physical measurements.">{settings.components.length} inferred components</span></div>
    {host && createPortal(<section className="shape-cloud-workspace" aria-label="Shape cloud comparison">
      <ShapeCloudStage mode={mode} result={result} source={source} width={image.width} height={image.height} matrix={workingMatrix} frame={frame}
        components={settings.components} selectedId={selected?.id ?? ''} hoveredId={hoveredId} outlines={outlines} overlayOpacity={opacity} view={view} onView={setView} onSelect={setSelectedId} />
      <div className="shape-cloud-terms" role="group" aria-label="Cloud formula terms">{settings.components.map((component, index) => <button type="button" key={component.id}
        data-term-id={component.id} data-enabled={component.enabled} data-operation={component.operation} aria-pressed={component.id === selected?.id}
        title={`${component.label} · ${component.shape} · ${component.operation} · click to edit`} onClick={() => setSelectedId(component.id)}
        onMouseEnter={() => setHoveredId(component.id)} onMouseLeave={() => setHoveredId('')} onFocus={() => setHoveredId(component.id)} onBlur={() => setHoveredId('')}>
        <span aria-hidden="true">{component.shape === 'ring' ? '◎' : component.shape === 'ellipsoid' ? '●' : '◯'}</span>
        {component.operation === 'subtract' ? '−' : '+'}{component.enabled ? Number(component.weight.toFixed(2)) : 0} S{index + 1}
      </button>)}</div>
      <div className="shape-cloud-camera-hint">{view.locked ? 'Earth view · drag to pan · scroll to zoom' : 'Drag either pane to rotate · Shift-drag to pan · scroll to zoom'}</div>
    </section>, host)}
  </section>;
}
/** Camera and comparison mode survive source changes; drafts/jobs are isolated by source identity. */
export function ShapeCloudWorkbench(props: Props) {
  const [mode, setMode] = useState<ShapeCloudMode>('compare'), [view, setView] = useState<CloudView>(earthCloudView);
  return <Session key={`${props.image.id}:${props.image.geometry?.sha256}`} {...props} mode={mode} setMode={setMode} view={view} setView={setView} />;
}
