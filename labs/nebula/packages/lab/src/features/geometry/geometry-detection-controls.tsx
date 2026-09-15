import type { StructureImage } from '../observations/models/structures-model';
import type { useGeometryDetection } from './geometry-detection-state';
import './geometry-detection.css';

export function GeometryDetectionControls({ detector, image }: {
  detector: ReturnType<typeof useGeometryDetection>; image: StructureImage;
}) {
  const { settings, active, ready, job } = detector;
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
  const status = active ? job?.progress?.message || 'Updating structures…' : ready ?
    `${detector.effectiveGeometry?.candidates.length ?? 0} structures · ${detector.quality === 'draft' ? 'refining…' : 'live'}` : 'Loading detector…';
  return <section className="geometry-detection-controls" aria-label="Detector" data-job-id={job?.id ?? ''} data-job-status={job?.status ?? ''}
    data-active={active} data-applied-sha={detector.appliedPin?.sha256 ?? ''} data-quality={detector.quality}>
    <h3>Detector</h3>
    {controls.map(control => <div className="structure-slider" key={control.id}>
      <label htmlFor={`detector-${control.id}`} title={control.title}>{control.label}</label>
      <input id={`detector-${control.id}`} type="range" min={control.min} max={control.max} step={control.step} value={control.value}
        disabled={!ready} aria-valuetext={control.display} onChange={event => control.edit(event.target.valueAsNumber)}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); detector.begin(); }}
        onPointerUp={detector.settle} onPointerCancel={detector.settle} onKeyUp={detector.settle} onBlur={detector.settle} />
      <output htmlFor={`detector-${control.id}`}>{control.display}</output>
    </div>)}
    <div className="detector-feedback" data-active={active}>
      <progress aria-label="Detection progress" max={job?.progress?.total || 1} value={job?.progress?.current || 0} />
      <p className="interaction-hint" role="status" title={status}>{status}</p>
    </div>
    {(detector.error || detector.storageError) && <p className="interaction-hint shape-cloud-error" role="alert">{detector.error || detector.storageError}</p>}
    {detector.error && <button type="button" onClick={detector.retry}>Retry</button>}
  </section>;
}
