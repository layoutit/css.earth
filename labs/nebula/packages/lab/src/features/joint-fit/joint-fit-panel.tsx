import { CameraModelPanel } from '../../ui/camera-model-panel';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { readStructureCatalogue, type StructureCatalogue } from '../observations/models/structures-model';
import { adjustedMatrix, savedObservationFit, unchanged } from '../observations/models/model';
import { defaultJointControls, readJointControls, type JointControls, type JointFamily } from '@cssearth/nebula-reconstruction/methods/joint/model';
import type { JointRequest } from './model.ts';
import type { JointCandidate } from './result.ts';
import { readFusionSettings } from '../evidence-fusion/jobs-model.ts';
import { localFile } from '../legacy-viewer/controller';
import { ImageCredit } from '../workspace/image-credit';
import { WorkspaceImagePicker } from '../workspace/workspace-image-picker';
import { earthJointFitView, JointFitStage, type CloudView } from './joint-fit-stage';
import { useJointFit } from './joint-fit-state';
import './joint-fit.css';

export interface JointFitPanelProps { cataloguePath: string; recipePath: string; observationManifest?: string }

export function JointFitPanel({ cataloguePath, recipePath, observationManifest }: JointFitPanelProps) {
  const [catalogue, setCatalogue] = useState<StructureCatalogue | null>(null), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setCatalogue(null); setError('');
    void fetch(localFile(cataloguePath), { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error(`Registered evidence unavailable (${response.status}).`);
      setCatalogue(readStructureCatalogue(await response.json()));
    }).catch((reason: unknown) => { if (!controller.signal.aborted)
      setError(reason instanceof Error ? reason.message : 'Registered evidence unavailable.'); });
    return () => controller.abort();
  }, [cataloguePath]);
  if (!catalogue) return <p className="interaction-hint" role={error ? 'alert' : 'status'}>{error || 'Loading registered observations…'}</p>;
  return <JointFitSession key={`${cataloguePath}:${recipePath}`} catalogue={catalogue} cataloguePath={cataloguePath}
    recipePath={recipePath} observationManifest={observationManifest} />;
}

function JointFitSession({ catalogue, cataloguePath, recipePath, observationManifest }: JointFitPanelProps & { catalogue: StructureCatalogue }) {
  const matrices = useMemo(() => Object.fromEntries(catalogue.images.map(image => [image.id,
    adjustedMatrix({ imageToFrame: image.imageToFrame, source: { width: image.nativeWidth, height: image.nativeHeight } }, catalogue.frame,
      observationManifest ? savedObservationFit(observationManifest, { id: image.id, source: { url: image.sourceUrl } }) : unchanged)])),
  [catalogue, observationManifest]);
  const evidenceKey = `nebula:joint-evidence:1:${cataloguePath}:${JSON.stringify(catalogue.images.map(image =>
    [image.id, image.sourceSha256, image.mapSha256, matrices[image.id]]))}`;
  const evidence = useMemo(() => {
    try {
      const saved = readFusionSettings(JSON.parse(localStorage.getItem(evidenceKey) ?? 'null'));
      if (saved.weights.length === catalogue.images.length) return { sensitivity: saved.sensitivity, weights: saved.weights };
    } catch { /* Missing or stale Combine settings use neutral source weights. */ }
    return { sensitivity: 1, weights: catalogue.images.map(() => 1) };
  }, [catalogue, evidenceKey]);
  const storageKey = `nebula:joint-fit:1:${recipePath}:${cataloguePath}:${JSON.stringify(catalogue.images.map(image =>
    [image.id, image.sourceSha256, image.mapSha256, matrices[image.id]]))}`;
  const [controls, setControls] = useState<JointControls>(() => {
    try {
      const saved = readJointControls(JSON.parse(localStorage.getItem(`${storageKey}:controls`) ?? 'null'));
      if (saved.imageWeight < .1 || saved.velocityWeight < .1) throw new TypeError('Weights fall outside the panel range.');
      return saved;
    }
    catch { return { ...defaultJointControls }; }
  });
  const [storageError, setStorageError] = useState('');
  function updateControls(next: JointControls) {
    const checked = readJointControls(next); setControls(checked);
    try { localStorage.setItem(`${storageKey}:controls`, JSON.stringify(checked)); setStorageError(''); }
    catch { setStorageError('Controls are available for this session only.'); }
  }
  const request = useMemo<JointRequest>(() => ({ action: 'apply', imageId: 'joint-fit', cataloguePath, recipePath,
    imageToFrame: matrices, evidence, controls }), [cataloguePath, recipePath, matrices, evidence, controls]);
  const state = useJointFit(request, storageKey), { result } = state;
  const [host, setHost] = useState<Element | null>(null), [family, setFamily] = useState<JointFamily | null>(null);
  const [sourceId, setSourceId] = useState(''), [showRidges, setShowRidges] = useState(true), [showPointings, setShowPointings] = useState(true);
  const [view, setView] = useState<CloudView>(earthJointFitView);
  useEffect(() => { setHost(document.querySelector('.workspace-content')); }, []);
  const best = result?.candidates.reduce((current, candidate) => candidate.fit.metrics.objective < current.fit.metrics.objective ? candidate : current);
  const candidate = result?.candidates.find(item => item.fit.parameters.family === family) ?? best;
  const source = result?.sources.find(item => item.id === sourceId) ?? result?.sources[0];
  const imageUrl = source ? `${localFile(source.image.path)}?v=${source.image.sha256}` : '';
  const withheldMismatch = candidate?.fit.metrics.heldOutRmsKmS !== null && candidate?.fit.metrics.heldOutRmsKmS !== undefined &&
    (candidate.fit.metrics.trainingRmsKmS === null || candidate.fit.metrics.heldOutRmsKmS > candidate.fit.metrics.trainingRmsKmS * 1.5);
  const status = state.error || storageError || (state.busy ? state.progress || 'Fitting registered evidence…' : result ? 'Joint fit up to date' : 'Preparing joint fit…');
  return <fieldset className="joint-fit-controls" data-result-id={result?.id ?? ''} data-busy={state.busy}
    data-candidate={candidate?.fit.parameters.family ?? ''}>
    <legend>Image and processing</legend>
    <div className="joint-fit-status" role={state.error || storageError ? 'alert' : 'status'} title={status}>{status}</div>
    {state.error && <button type="button" onClick={state.retry}>Retry</button>}
    <WorkspaceImagePicker><label className="visually-hidden" htmlFor="joint-fit-source">Image</label>
    <select id="joint-fit-source" value={source?.id ?? ''} disabled={!result} onChange={event => setSourceId(event.target.value)}>
      {result?.sources.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select></WorkspaceImagePicker>
    <ImageCredit credit={catalogue.images.find(image => image.id === source?.id)?.credit} />
    <div className="joint-fit-toggles">
      <label className="observation-check"><input type="checkbox" checked={showRidges} onChange={event => setShowRidges(event.target.checked)} /> Ridges</label>
      <label className="observation-check"><input type="checkbox" checked={showPointings} onChange={event => setShowPointings(event.target.checked)} /> Pointings</label>
    </div>
    {candidate && <div className="joint-fit-metrics" aria-label="Fit metrics">
      <span>Image <output>{candidate.fit.metrics.imageResidualArcsec.toFixed(1)}″</output></span>
      <span title={`RMS uses ${Math.max(0, candidate.fit.metrics.trainingCount - candidate.fit.metrics.missingTraining)} matched training velocities; ${candidate.fit.metrics.missingTraining} missing intersections remain penalized in the objective.`}>Train <output>{metric(candidate.fit.metrics.trainingRmsKmS)} · {candidate.fit.metrics.missingTraining} missing</output></span>
      <span title={`RMS uses ${Math.max(0, candidate.fit.metrics.heldOutCount - candidate.fit.metrics.missingHeldOut)} matched held-out velocities; ${candidate.fit.metrics.missingHeldOut} missing intersections are reported separately.`}>Held out <output>{metric(candidate.fit.metrics.heldOutRmsKmS)} · {candidate.fit.metrics.missingHeldOut} missing</output></span>
    </div>}
    {candidate && <div className="joint-fit-parameters" aria-label="Selected fitted parameters">
      <span>Radius <output>{candidate.fit.parameters.radiusArcsec.toFixed(0)}″</output></span>
      <span>Depth ratio <output>{candidate.fit.parameters.depthRatio.toFixed(2)}</output></span>
      <span>Inclination <output>{candidate.fit.parameters.inclinationDegrees.toFixed(0)}°</output></span>
      <span>PA <output>{candidate.fit.parameters.positionAngleDegrees.toFixed(0)}°</output></span>
      <span>Expansion <output>{candidate.fit.parameters.expansionKmS.toFixed(1)} km/s</output></span>
      <span>Systemic LSR <output>{candidate.fit.parameters.systemicLsrKmS.toFixed(1)} km/s</output></span>
    </div>}
    {candidate?.fit.metrics.heldOutRmsKmS !== null && candidate?.fit.metrics.heldOutRmsKmS !== undefined &&
      <p className="joint-fit-withheld" data-mismatch={withheldMismatch} title="Descriptive held-out comparison only; this is not a calibrated uncertainty or significance test.">{withheldMismatch ? 'Withheld mismatch advisory' : 'Withheld check'} · {candidate.fit.metrics.heldOutRmsKmS.toFixed(1)} km/s vs {metric(candidate.fit.metrics.trainingRmsKmS)} training</p>}
    <details><summary>Meaning and assumptions</summary><p>{result?.interpretation || 'The server compares projected image ridges with molecular velocities.'}</p>
      <p>Angular depth and simple expansion belong to the candidate model. They are not measured gas density or a physical-distance reconstruction.</p></details>
    <details><summary>Evidence accounting</summary><p>{result ? `${result.accounting.ridgePoints} ridge samples from ${result.sources.length} registered images; ${result.accounting.pointings} molecular pointings at ${result.accounting.beamFwhmArcsec.toFixed(0)}″ beam FWHM.` : 'Registered image accounting is prepared with the result.'}</p>
      <p>Combine sensitivity {evidence.sensitivity.toFixed(2)}×; source weights {evidence.weights.map(weight => weight.toFixed(2)).join(', ')}. Held-out velocities do not select the candidate.</p></details>
    {host && createPortal(<CameraModelPanel camera={{
      earth: { pressed: view.locked, onActivate: () => setView(earthJointFitView) },
      orbit: { pressed: !view.locked, onActivate: () => setView({ ...view, locked: !view.locked }) },
      reset: { onActivate: () => setView(earthJointFitView) },
      fit: 'This model uses its saved Earth framing; separate fit is not available.',
    }}>
    <ControlSlider id="joint-ridge" label="Ridge threshold" value={controls.ridgeThreshold} min={.05} max={.9} step={.01}
      display={controls.ridgeThreshold.toFixed(2)} onChange={ridgeThreshold => updateControls({ ...controls, ridgeThreshold })} />
    <ControlSlider id="joint-length" label="Minimum length" value={controls.minLengthArcseconds} min={10} max={240} step={5}
      display={`${controls.minLengthArcseconds.toFixed(0)}″`} onChange={minLengthArcseconds => updateControls({ ...controls, minLengthArcseconds })} />
    <ControlSlider id="joint-image-weight" label="Image weight" value={controls.imageWeight} min={.1} max={4} step={.05}
      display={`${controls.imageWeight.toFixed(2)}×`} onChange={imageWeight => updateControls({ ...controls, imageWeight })} />
    <ControlSlider id="joint-velocity-weight" label="Velocity weight" value={controls.velocityWeight} min={.1} max={4} step={.05}
      display={`${controls.velocityWeight.toFixed(2)}×`} onChange={velocityWeight => updateControls({ ...controls, velocityWeight })} />
    <div className="joint-fit-candidates" role="group" aria-label="Prepared model candidate">
      {([['ellipsoid', 'Shell'], ['bipolar', 'Lobes']] as const).map(([id, label]) => <button type="button" key={id}
        aria-pressed={candidate?.fit.parameters.family === id} disabled={!result?.candidates.some(item => item.fit.parameters.family === id)}
        onClick={() => setFamily(id)}>{label}</button>)}
    </div>
      </CameraModelPanel>, host)}
    {host && createPortal(<JointWorkspace resultId={result?.id ?? ''} source={imageUrl} candidate={candidate}
      ridgePaths={result?.ridgePaths ?? []} diagramSize={result?.diagramSize ?? 512} showRidges={showRidges}
      showPointings={showPointings} spanArcsec={result?.spanArcsec} view={view} setView={setView} />, host)}
  </fieldset>;
}

function JointWorkspace({ resultId, source, candidate, ridgePaths, diagramSize, showRidges, showPointings, spanArcsec, view, setView }: {
  resultId: string; source: string; candidate?: JointCandidate; ridgePaths: string[]; diagramSize: number;
  showRidges: boolean; showPointings: boolean; spanArcsec?: number; view: CloudView; setView(value: CloudView): void;
}) {
  const outer = diagramSize / .94, margin = (outer - diagramSize) / 2;
  return <section className="joint-fit-workspace" aria-label="Joint image and volume comparison" data-result-id={resultId}>
    <section className="joint-fit-earth" aria-label="Earth projection">
      <div className="joint-fit-pane-label">Earth projection</div>
      <svg viewBox={`${-margin} ${-margin} ${outer} ${outer}`} role="img" aria-label="Registered source, image ridges and molecular pointings">
        {source && <image href={source} x="0" y="0" width={diagramSize} height={diagramSize} />}
        {showRidges && <g className="joint-fit-ridges">{ridgePaths.map((path, index) => <path key={index} d={path} />)}</g>}
        {candidate && <path className="joint-fit-outline" d={candidate.outlinePath} />}
        {showPointings && candidate?.pointings.map(point => <circle key={point.id} className="joint-fit-pointing"
          data-held-out={point.heldOut} cx={point.x} cy={point.y} r="5" fill={point.heldOut ? 'none' : point.color}
          stroke={point.color}><title>{point.id} · {point.heldOut ? 'held out' : 'training'} · {point.measurements}</title></circle>)}
      </svg>
      <div className="joint-fit-caption">N ↑ · E ←</div>
    </section>
    <JointFitStage result={candidate?.volume ?? null} fieldOfViewArcsec={spanArcsec} view={view} onView={setView} />
    <div className="joint-fit-camera-hint">{view.locked ? 'Earth view · drag to pan · scroll to zoom' : 'Orbit · drag to rotate · Shift-drag to pan · scroll to zoom'}</div>
  </section>;
}

function ControlSlider({ id, label, value, min, max, step, display, onChange }: {
  id: string; label: string; value: number; min: number; max: number; step: number; display: string; onChange(value: number): void;
}) {
  return <div className="joint-fit-slider"><label htmlFor={id}>{label}</label><input id={id} type="range" min={min} max={max} step={step}
    value={value} onChange={event => onChange(event.target.valueAsNumber)} /><output>{display}</output></div>;
}
const metric = (value: number | null) => value === null ? '—' : `${value.toFixed(1)} km/s`;
