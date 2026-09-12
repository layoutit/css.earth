import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { adjustedMatrix, imageCorners, readObservations, savedObservationFit, unchanged, type Observations } from '../alignment/observations-ui/model';
import { readStructureCatalogue, type StructureCatalogue } from '../alignment/observations-ui/structures-model';
import { readFusionSettings } from '../reconstruction/evidence-fusion/jobs-model';
import { defaultCompilerControls, readCompilerControls, type CompilerControls, type CompilerRequest } from '../reconstruction/compiler/model';
import { localFile } from '../viewer/viewer';
import { earthCloudView, type CloudView } from './shape-cloud-stage';
import { CompilerStage } from './compiler-stage';
import type { CompilerInspectionFrame } from '../viewer/compiler-framing';
import { useCompiler } from './compiler-state';
import './compiler.css';

export interface CompilerPanelProps { recipePath: string; cataloguePath: string; observationManifest?: string; publishedPath?: string }
interface Presentation { view: CloudView; mode: 'neutral' | 'textured'; lensId: string | null; stars: boolean; original: boolean }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function savedPresentation(key: string): Presentation {
  const fallback: Presentation = { view: { ...earthCloudView }, mode: 'textured', lensId: null, stars: true, original: false };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!object(saved) || !object(saved.view)) return fallback;
    const v = saved.view;
    if (!finite(v.zoom) || v.zoom < .15 || v.zoom > 12 || !finite(v.panX) || !finite(v.panY) || !finite(v.yaw) || !finite(v.pitch) || Math.abs(v.pitch) > 89 || typeof v.locked !== 'boolean') return fallback;
    return { view: { zoom: v.zoom, panX: v.panX, panY: v.panY, yaw: v.yaw, pitch: v.pitch, locked: v.locked },
      mode: saved.mode === 'neutral' ? 'neutral' : 'textured', lensId: typeof saved.lensId === 'string' ? saved.lensId : null,
      stars: saved.stars !== false, original: saved.original === true };
  } catch { return fallback; }
}

/** The final cloud is the workspace; its upstream evidence stays in the shared inspection bar. */
export function CompilerPanel(props: CompilerPanelProps) {
  return <CompilerSession key={`${props.recipePath}:${props.cataloguePath}`} {...props} />;
}
function CompilerSession({ recipePath, cataloguePath, observationManifest, publishedPath }: CompilerPanelProps) {
  const storageKey = `nebula:compiler:1:${recipePath}:${cataloguePath}`;
  const [catalogue, setCatalogue] = useState<StructureCatalogue | null>(null), [observations, setObservations] = useState<Observations | null>(null);
  const [inputsReady, setInputsReady] = useState(false);
  const [host, setHost] = useState<Element | null>(null), [sourceStatus, setSourceStatus] = useState('');
  const [controls, setControls] = useState<CompilerControls>(() => {
    try { return readCompilerControls(JSON.parse(localStorage.getItem(`${storageKey}:controls`) ?? 'null')); }
    catch { return { ...defaultCompilerControls }; }
  });
  const [presentation, setPresentation] = useState(() => savedPresentation(`${storageKey}:view`));
  const [storageError, setStorageError] = useState('');
  useEffect(() => { setHost(document.querySelector('.workspace-content')); }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function load(path: string): Promise<unknown> {
      const response = await fetch(localFile(path), { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`Prepared source metadata unavailable (${response.status}).`);
      return response.json();
    }
    void Promise.allSettled([load(cataloguePath).then(readStructureCatalogue), observationManifest ? load(observationManifest).then(readObservations) : Promise.resolve(null)]).then(([structures, manifest]) => {
      if (controller.signal.aborted) return;
      if (structures.status === 'fulfilled') setCatalogue(structures.value);
      if (manifest.status === 'fulfilled') setObservations(manifest.value);
      if (structures.status === 'rejected' && manifest.status === 'rejected') setSourceStatus('Compile restores missing prepared sources.');
      setInputsReady(true);
    });
    return () => controller.abort();
  }, [cataloguePath, observationManifest]);
  const registration = useMemo(() => {
    if (catalogue) return { frame: catalogue.frame, images: catalogue.images.map(image => ({ id: image.id, imageToFrame: image.imageToFrame,
      source: { width: image.nativeWidth, height: image.nativeHeight, sha256: image.sourceSha256 } })) };
    return observations;
  }, [catalogue, observations]);
  const matrices = useMemo(() => registration ? Object.fromEntries(registration.images.map(image => [image.id,
    adjustedMatrix(image, registration.frame, observationManifest ? savedObservationFit(observationManifest, image) : unchanged)])) : {}, [registration, observationManifest]);
  const liveInspectionFrame = useMemo<CompilerInspectionFrame | undefined>(() => {
    if (!registration) return undefined;
    const corners = registration.images.flatMap(image => imageCorners(image, matrices[image.id] ?? image.imageToFrame));
    if (!corners.length) return undefined;
    const xs = corners.map(point => point[0]), ys = corners.map(point => point[1]), frame = registration.frame;
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    return { boundsArcsec: { min: [(left - frame.width / 2) * frame.fieldArcminutes[0] * 60 / frame.width,
      (frame.height / 2 - bottom) * frame.fieldArcminutes[1] * 60 / frame.height],
    max: [(right - frame.width / 2) * frame.fieldArcminutes[0] * 60 / frame.width,
      (frame.height / 2 - top) * frame.fieldArcminutes[1] * 60 / frame.height] }, paddingPixels: 18 };
  }, [registration, matrices]);
  const evidence = useMemo(() => {
    if (catalogue) {
      const key = `nebula:joint-evidence:1:${cataloguePath}:${JSON.stringify(catalogue.images.map(image => [image.id, image.sourceSha256, image.mapSha256, matrices[image.id]]))}`;
      try {
        const value = readFusionSettings(JSON.parse(localStorage.getItem(key) ?? 'null'));
        if (value.weights.length === catalogue.images.length) return { sensitivity: value.sensitivity, weights: value.weights };
      } catch { /* Missing diagnostic edits leave the server's source defaults intact. */ }
    }
    return { sensitivity: 1, weights: [] };
  }, [catalogue, cataloguePath, matrices]);
  const request = useMemo<CompilerRequest>(() => ({ action: 'apply', imageId: 'compiler', recipePath, cataloguePath, imageToFrame: matrices,
    evidence, controls }), [recipePath, cataloguePath, matrices, evidence, controls]);
  const hasInspectionEdits = Boolean(registration?.images.some(image => {
    const actual = matrices[image.id]; return actual?.some((value, index) => Math.abs(value - image.imageToFrame[index]!) > 1e-10);
  })) || evidence.sensitivity !== 1 || evidence.weights.some(weight => weight !== 1);
  const state = useCompiler(request, storageKey, inputsReady, hasInspectionEdits ? undefined : publishedPath), { result } = state;
  const inspectionFrame: CompilerInspectionFrame | undefined = result?.inspectionBoundsArcsec
    ? { boundsArcsec: result.inspectionBoundsArcsec, paddingPixels: 18 } : liveInspectionFrame;
  const source = result?.sources.find(item => item.id === (presentation.lensId ?? result.defaultSourceId)) ?? result?.sources[0];
  const message = state.error || state.storageError || storageError || state.status;
  function updateControls(value: CompilerControls) {
    const checked = readCompilerControls(value); setControls(checked);
    try { localStorage.setItem(`${storageKey}:controls`, JSON.stringify(checked)); setStorageError(''); }
    catch { setStorageError('Session only · controls are not saved'); }
  }
  const updatePresentation = useCallback((value: Presentation) => {
    setPresentation(value);
    try { localStorage.setItem(`${storageKey}:view`, JSON.stringify(value)); setStorageError(''); }
    catch { setStorageError('Session only · view is not saved'); }
  }, [storageKey]);
  const onView = useCallback((view: CloudView) => updatePresentation({ ...presentation, view }), [presentation, updatePresentation]);
  const error = Boolean(state.error || state.storageError || storageError);
  return <fieldset className="compiler-controls" data-result-id={result?.id ?? ''} data-job-id={state.job?.id ?? ''}
    data-job-status={state.job?.status ?? ''} data-busy={state.busy}>
    <legend>Nebula compiler</legend>
    <div className="compiler-actions">
      <button type="button" className="compiler-primary" disabled={state.busy} onClick={state.error ? state.retry : state.compile}>
        {state.error ? 'Retry compile' : 'Compile nebula'}</button>
      {state.busy && <button type="button" onClick={state.cancel} disabled={state.job?.status === 'cancelling'}>Cancel</button>}
    </div>
    <div className="compiler-progress" aria-busy={state.busy}>
      <div role={error ? 'alert' : 'status'} title={message} data-error={error}>{message}</div>
      <progress aria-label="Nebula compilation progress" hidden={!state.busy} max={state.job?.progress?.total || 1}
        value={state.job?.progress ? state.job.progress.current : undefined} />
    </div>
    <CompilerSlider id="compiler-detail" label="Detail" value={controls.detail} min={0} max={1} step={.05} display={`${Math.round(controls.detail * 100)}%`}
      title="Retain more prepared small-scale image structure in the inferred cloud." onChange={detail => updateControls({ ...controls, detail })} />
    <CompilerSlider id="compiler-faint" label="Faint emission" value={controls.faint} min={0} max={1} step={.05} display={`${Math.round(controls.faint * 100)}%`}
      title="Change the contribution of faint, less constrained emission." onChange={faint => updateControls({ ...controls, faint })} />
    <CompilerSlider id="compiler-depth" label="Depth" value={controls.depth} min={.5} max={2} step={.05} display={`${controls.depth.toFixed(2)}×`}
      title="Scale the inferred line-of-sight extent. This remains a model assumption." onChange={depth => updateControls({ ...controls, depth })} />
    <p className="compiler-auto-note" title={sourceStatus || 'After the first completed compile, changes update automatically. Processing survives refresh.'}>{result ? 'Controls update automatically' : 'Prepared sources restored on compile'}</p>
    <label className="field-label" htmlFor="compiler-lens">Lens</label>
    <select id="compiler-lens" value={source?.id ?? ''} disabled={!result} onChange={event => updatePresentation({ ...presentation, lensId: event.target.value })}>
      {!result && <option value="">Available after compilation</option>}
      {result?.sources.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}
    </select>
    <div className="compiler-modes" role="group" aria-label="Cloud material">
      <button type="button" aria-pressed={presentation.mode === 'neutral'} onClick={() => updatePresentation({ ...presentation, mode: 'neutral' })}>Neutral</button>
      <button type="button" aria-pressed={presentation.mode === 'textured'} onClick={() => updatePresentation({ ...presentation, mode: 'textured' })}>Textured</button>
    </div>
    <div className="compiler-toggles">
      <label className="observation-check"><input type="checkbox" checked={presentation.stars} onChange={event => updatePresentation({ ...presentation, stars: event.target.checked })} />Stars</label>
      <label className="observation-check"><input type="checkbox" checked={presentation.original} onChange={event => updatePresentation({ ...presentation, original: event.target.checked })} />Original</label>
    </div>
    <div className="compiler-camera-actions">
      <button type="button" aria-pressed={presentation.view.locked} onClick={() => updatePresentation({ ...presentation, view: { ...earthCloudView } })}>Earth view</button>
      <button type="button" aria-pressed={!presentation.view.locked} onClick={() => updatePresentation({ ...presentation, view: { ...presentation.view, locked: !presentation.view.locked } })}>Orbit</button>
    </div>
    {result && <details className="compiler-receipt"><summary>Compilation details</summary>
      <ol>{result.pipeline.map(step => <li key={step.id}><span>{step.label}</span><span>{step.state === 'reused' ? 'Reused' : 'Complete'}</span></li>)}</ol>
      <p>{result.metrics.components} components · {result.metrics.unconstrainedComponents} outside velocity coverage</p>
    </details>}
    {host && createPortal(<section className="compiler-workspace" aria-label="Compiled nebula" data-result-id={result?.id ?? ''}>
      <CompilerStage result={result} lensId={source?.id ?? null} mode={presentation.mode} stars={presentation.stars}
        showOriginal={presentation.original} view={presentation.view} onView={onView} inspectionFrame={inspectionFrame} />
      {!result && !state.busy && <div className="compiler-empty"><span>Compile the registered observations into one nebula.</span></div>}
      <div className="compiler-view-hint">{presentation.view.locked ? 'Earth view · drag to pan · scroll to zoom' : 'Orbit · drag to rotate · Shift-drag to pan · scroll to zoom'}</div>
    </section>, host)}
  </fieldset>;
}
function CompilerSlider({ id, label, value, min, max, step, display, title, onChange }: {
  id: string; label: string; value: number; min: number; max: number; step: number; display: string; title: string; onChange(value: number): void;
}) {
  return <div className="compiler-slider"><label htmlFor={id} title={title}>{label}</label>
    <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={display} onChange={event => onChange(event.target.valueAsNumber)} />
    <output htmlFor={id}>{display}</output></div>;
}
