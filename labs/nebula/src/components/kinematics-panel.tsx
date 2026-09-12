import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { KinematicParameters, PreparedKinematics } from '../reconstruction/kinematics/types';
import { readKinematicParameters, readPreparedKinematics, record } from '../reconstruction/kinematics/validation';
import './kinematics-panel.css';

/** Sliders transport assumptions; the server prepares all velocities and SVG coordinates. */
export function KinematicsPanel({ sourcePath, endpoint = '/__nebula/kinematics' }: { sourcePath: string; endpoint?: string }) {
  const [result, setResult] = useState<PreparedKinematics | null>(null);
  const [parameters, setParameters] = useState<KinematicParameters | null>(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showFigure, setShowFigure] = useState(false);
  const generation = useRef(0), sourceIdentity = useRef(''), loadedSettings = useRef('');
  const query = `${endpoint}?source=${encodeURIComponent(sourcePath)}`;
  const storageKey = `nebula-kinematics:${sourcePath}`;
  useEffect(() => {
    const controller = new AbortController(); const serial = ++generation.current;
    setResult(null); setParameters(null); setError(''); setUpdating(true); sourceIdentity.current = ''; loadedSettings.current = '';
    void (async () => {
      try {
        const response = await fetch(query, { signal: controller.signal, cache: 'no-store' });
        const value: unknown = await response.json();
        if (!response.ok) throw new Error(typeof record(value).error === 'string' ? String(record(value).error) : 'Slit data unavailable.');
        const next = readPreparedKinematics(value);
        if (serial !== generation.current) return;
        sourceIdentity.current = next.evidenceSha256; loadedSettings.current = JSON.stringify(next.parameters);
        let savedParameters = next.parameters;
        try {
          const stored = localStorage.getItem(storageKey);
          if (stored) { const saved = record(JSON.parse(stored) as unknown); if (saved.evidenceSha256 === next.evidenceSha256) savedParameters = readKinematicParameters(saved.parameters); }
        } catch { /* Invalid/obsolete local edits cannot change scientific input. */ }
        setResult(next); setParameters(savedParameters);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Slit data unavailable.'); }
      finally { if (!controller.signal.aborted) setUpdating(false); }
    })();
    return () => controller.abort();
  }, [query, storageKey]);
  useEffect(() => {
    if (!parameters || !sourceIdentity.current) return;
    const serial = ++generation.current;
    if (JSON.stringify(parameters) === loadedSettings.current) { setUpdating(false); setError(''); return; }
    const controller = new AbortController();
    setUpdating(true);
    const timer = setTimeout(() => { void (async () => {
      try {
        const response = await fetch(endpoint, { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sourcePath, parameters }) });
        const value: unknown = await response.json();
        if (!response.ok) throw new Error(typeof record(value).error === 'string' ? String(record(value).error) : 'Prediction unavailable.');
        const next = readPreparedKinematics(value);
        if (next.evidenceSha256 !== sourceIdentity.current) throw new Error('Slit evidence changed; reopen this comparison.');
        if (serial !== generation.current) return;
        loadedSettings.current = JSON.stringify(next.parameters); setResult(next); setError('');
        try { localStorage.setItem(storageKey, JSON.stringify({ evidenceSha256: next.evidenceSha256, parameters: next.parameters })); }
        catch { setError('Comparison updated; local storage could not save these controls.'); }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Prediction unavailable.'); }
      finally { if (!controller.signal.aborted) setUpdating(false); }
    })(); }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [parameters, endpoint, sourcePath, storageKey]);
  if (!result || !parameters) return <section className="kinematics-panel" aria-label="Velocity comparison"><p role={error ? 'alert' : 'status'}>{error || 'Loading measured slit…'}</p></section>;
  const { evidence, chart, metrics } = result;
  const workspace = document.querySelector('.workspace-content');
  const controls = [
    { key: 'inclinationDegrees', label: 'Inclination', min: -80, max: 80, step: 1, unit: '°', value: parameters.inclinationDegrees,
      title: 'Polar axis from the line of sight, tilted toward west in the E–W slit. A sphere has no preferred orientation.' },
    { key: 'depthRatio', label: 'Depth ratio', min: .25, max: 3, step: .05, unit: '×', value: parameters.depthRatio,
      title: 'Authored polar-to-equatorial size ratio. 1 is spherical. Keep the measured projected E–W radius fixed.' },
    { key: 'expansionKmS', label: 'Speed', min: 1, max: 40, step: .5, unit: ' km/s', value: parameters.expansionKmS,
      title: 'Outward homologous expansion: velocity proportional to distance. This is a hypothesis, not a velocity measured from image pixels.' },
  ];
  return <><section className="kinematics-panel" aria-label="Velocity comparison" data-source-id={evidence.id} data-evidence-sha={result.evidenceSha256}
    data-updating={updating} data-prediction-settings={JSON.stringify(result.parameters)}>
    <header><div><h2>Independent shell</h2><p>Measured [O III] slit</p></div></header>
    <aside className="kinematics-controls">
      {controls.map(control => <div className="kinematics-slider" key={control.key}>
        <label htmlFor={`kinematics-${control.key}`} title={control.title}>{control.label}</label>
        <output htmlFor={`kinematics-${control.key}`}>{Number(control.value.toFixed(2))}{control.unit}</output>
        <input id={`kinematics-${control.key}`} type="range" min={control.min} max={control.max} step={control.step} value={control.value}
          aria-valuetext={`${Number(control.value.toFixed(2))}${control.unit}`} onChange={event => setParameters({ ...parameters, [control.key]: event.target.valueAsNumber })} />
      </div>)}
      <p className="kinematics-small" title="The projected E–W radius is fixed by the literature brightness-peak separation. This is a shape hypothesis, not a measured depth.">Radius {parameters.radiusArcsec}″ · {parameters.depthRatio === 1 ? 'sphere; tilt has no effect' : 'assumed depth'}</p>
      <button type="button" onClick={() => setParameters(evidence.defaults)}>Reset hypothesis</button>
      <p className="kinematics-small" role="status">{updating ? 'Updating prediction…' : 'Hypothesis ready'}</p>
      {metrics.outsideProjectedShell > 0 && <p className="kinematics-small">{metrics.outsideProjectedShell} samples lie outside this shell’s projected extent.</p>}
    </aside>{error && <p className="kinematics-error" role="alert">{error}</p>}</section>
    {workspace && createPortal(<section className="kinematics-workspace" aria-label="Measured slit workspace"><header><h2>{evidence.title}</h2></header><div className="kinematics-comparison">
      <div className="kinematics-legend"><span className="kinematics-observed-key">● Observed centroids ≈</span><span className="kinematics-model-key">— Predicted shell surfaces</span></div>
      <svg className="kinematics-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Measured line velocity versus slit offset, with two predicted shell surfaces">
        <title>Published [O III] slit centroids and predicted expanding shell</title>
        <rect className="kinematics-systemic" x={chart.left} y={chart.systemicBandTop} width={chart.right - chart.left} height={chart.systemicBandHeight} />
        {chart.yTicks.map(tick => <g key={`y${tick.value}`}><line className="kinematics-grid" x1={chart.left} y1={tick.position} x2={chart.right} y2={tick.position} /><text x={chart.left - 10} y={tick.position + 4} textAnchor="end">{tick.value}</text></g>)}
        {chart.xTicks.map(tick => <g key={`x${tick.value}`}><line className="kinematics-grid" x1={tick.position} y1={chart.top} x2={tick.position} y2={chart.bottom} /><text x={tick.position} y={chart.bottom + 22} textAnchor="middle">{tick.value}</text></g>)}
        <line className="kinematics-zero" x1={chart.left} y1={chart.zeroY} x2={chart.right} y2={chart.zeroY} />
        <path className="kinematics-model" d={chart.approachingPath} /><path className="kinematics-model" d={chart.recedingPath} />
        {chart.points.map(point => <circle className="kinematics-observed" key={point.id} cx={point.cx} cy={point.cy} r="3.4"><title>{point.offsetArcsec.toFixed(1)}″ · {point.heliocentricKmS.toFixed(1)} km/s heliocentric · {point.relativeKmS.toFixed(1)} km/s relative</title></circle>)}
        <text className="kinematics-axis" x="15" y="180" textAnchor="middle" transform="rotate(-90 15 180)">v − v systemic (km/s)</text>
        <text className="kinematics-axis" x="401" y="370" textAnchor="middle">East ← slit offset from central star (arcsec) → West</text>
      </svg>
      <p className="kinematics-small" title="Nearest-surface RMS is descriptive, not a statistical fit. The faster sampled branches are retained and remain unexplained by one inner shell.">{metrics.comparedPoints} measured samples · mismatch {metrics.nearestSurfaceRmsKmS?.toFixed(1) ?? '—'} km/s RMS · faster components remain unexplained.</p>
      <p className="kinematics-small" title="Shaded band: shared systemic-velocity uncertainty. Approximate readout precision is not a statistical uncertainty; published error bars have not been transcribed.">v systemic {evidence.systemic.valueKmS} ± {evidence.systemic.uncertaintyKmS} km/s · figure readout ≈ ±{metrics.velocityReadoutKmS.toFixed(1)} km/s</p>
    </div>
    <details className="kinematics-evidence"><summary>Measurements, assumptions and original slit</summary>
      <p><a href={evidence.citation.pdfUrl} target="_blank" rel="noreferrer">{evidence.citation.label}</a></p>
      <p>The measured slit tests an independent literature-scale shell. It is not yet fitted to the combined ESO structures. Positive velocities recede. Readout precision: ±{metrics.offsetReadoutArcsec.toFixed(1)}″ and ±{metrics.velocityReadoutKmS.toFixed(1)} km/s.</p>
      <p>{evidence.slit.direction}. {evidence.slit.lengthArcsec}″ long, {evidence.slit.widthArcsec}″ wide, {evidence.slit.instrumentalWidthKmS} km/s instrumental slit width.</p>
      <button type="button" onClick={() => setShowFigure(!showFigure)}>{showFigure ? 'Hide published figure' : 'Show published figure'}</button>
      {showFigure && <figure><img src={`${query}&figure=1`} alt="Original Meaburn2005 Figure9: registered [O III] image with E–W slit above measured centroid velocities." width={evidence.figure.width} height={evidence.figure.height} /><figcaption>Original figure raster, hash checked on the server. Digitized markers retain their original pixel coordinates in the source recipe.</figcaption></figure>}
      <ul>{evidence.defaultEvidence.map(note => <li key={note}>{note}</li>)}</ul>
      <p>{evidence.figure.readoutNote}</p><p>{evidence.slit.instrumentNote}</p>
      <ul>{evidence.limitations.map(note => <li key={note}>{note}</li>)}</ul>
    </details>
  </section>, workspace)}</>;
}
