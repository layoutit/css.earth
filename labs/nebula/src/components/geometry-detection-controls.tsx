import type { StructureImage } from '../alignment/observations-ui/structures-model';
import type { useGeometryDetection } from './geometry-detection-state';
import './geometry-detection.css';

export function GeometryDetectionControls({ detector, image, onApply, onRestore }: {
  detector: ReturnType<typeof useGeometryDetection>; image: StructureImage; onApply(): void; onRestore(): void;
}) {
  const { settings, pending, pendingGeometry, active, ready, job } = detector;
  const changed = pending && JSON.stringify(settings) !== JSON.stringify(pending.settings);
  const same = pending?.geometry.sha256 === detector.appliedPin?.sha256;
  const controls = [
    { id: 'sensitivity', label: 'Sensitivity', min: 25, max: 400, step: 5, value: settings.sensitivity * 100,
      display: `${Math.round(settings.sensitivity * 100)}%`, title: '100% keeps the original detector. Higher values lower contrast and edge thresholds and inspect fainter contours; they can also include noise and remaining star halos.',
      edit: (value: number) => detector.edit({ ...settings, sensitivity: value / 100 }) },
    { id: 'minimum-size', label: 'Min. size', min: 2, max: 40, step: .5, value: settings.minRadiusFraction * 100,
      display: `${Number((settings.minRadiusFraction * 100).toFixed(1))}%`, title: `Minimum fitted ellipse radius as a fraction of the shorter image side. Currently about ${Math.round(settings.minRadiusFraction * Math.min(image.width, image.height))} working pixels. Smaller values allow smaller structures and stellar halos.`,
      edit: (value: number) => detector.edit({ ...settings, minRadiusFraction: value / 100 }) },
    { id: 'maximum-shapes', label: 'Max. shapes', min: 1, max: 32, step: 1, value: settings.maxCandidates,
      display: String(settings.maxCandidates), title: 'Maximum number of ranked proposals retained. This is a limit, not a requested number of physical structures.',
      edit: (value: number) => detector.edit({ ...settings, maxCandidates: value }) },
  ];
  const status = active ? job?.progress?.message || 'Starting detection…' : changed ? 'Settings changed · Detect again' : pending ?
    `${pendingGeometry?.candidates.length ?? 0} proposals · ${same ? 'already applied' : 'not applied'}` : ready ? 'Detect prepares proposals only' : 'Loading detector…';
  return <section className="geometry-detection-controls" aria-label="Detector" data-job-id={job?.id ?? ''} data-job-status={job?.status ?? ''}
    data-applied-sha={detector.appliedPin?.sha256 ?? ''} data-pending-sha={pending?.geometry.sha256 ?? ''} data-preview={detector.preview}>
    <h3>Detector</h3>
    {controls.map(control => <div className="structure-slider" key={control.id}>
      <label htmlFor={`detector-${control.id}`} title={control.title}>{control.label}</label>
      <input id={`detector-${control.id}`} type="range" min={control.min} max={control.max} step={control.step} value={control.value}
        disabled={!ready || active} aria-valuetext={control.display} onChange={event => control.edit(event.target.valueAsNumber)} />
      <output htmlFor={`detector-${control.id}`}>{control.display}</output>
    </div>)}
    <div className="detector-actions"><button type="button" disabled={!ready || active} onClick={() => void detector.detect()}>{detector.error ? 'Retry detection' : 'Detect'}</button>
      {active && <button type="button" onClick={detector.cancel}>Cancel</button>}</div>
    <div className="detector-feedback" data-active={active}>
      <progress aria-label="Detection progress" max={job?.progress?.total || 1} value={job?.progress?.current || 0} />
      <p className="interaction-hint" role="status" title={status}>{status}</p>
    </div>
    {pending && <div className="detector-actions detector-proposal-actions">
      <button type="button" disabled={active || Boolean(changed) || same || !pendingGeometry} onClick={onApply}>Apply proposals</button>
      <button type="button" disabled={active} onClick={detector.discard}>Discard</button>
      <button type="button" onClick={detector.preview ? detector.showCloud : detector.showPreview}>
        {detector.preview ? 'Back to cloud' : 'Inspect proposals'}</button>
    </div>}
    {detector.canRestore && <button type="button" className="detector-restore" disabled={active} onClick={onRestore}>Restore previous cloud</button>}
    {(detector.error || detector.storageError) && <p className="interaction-hint shape-cloud-error" role="alert">{detector.error || detector.storageError}</p>}
    {detector.error && !ready && <button type="button" onClick={detector.retry}>Reload detector</button>}
  </section>;
}
