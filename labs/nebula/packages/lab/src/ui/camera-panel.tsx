import { CameraModelPanel } from './camera-model-panel';
import type { LabControlsProps } from '../state/use-lab-controller';

export function CameraPanel({ shell, controller }: LabControlsProps) {
  const cameraReady = !shell.presentation?.cameraDisabled;
  const earthAvailable = shell.presentation?.densityCamera && !shell.presentation.referenceDisabled;
  return <CameraModelPanel id="inspection-panel" className="density-adjustment-panel" controlsId="render-controls"
    busy={shell.busy} camera={{
      earth: earthAvailable ? { id: 'reference-view', description: 'Reset orientation and distance to the prepared Earth observer.', onActivate: () => void controller.current?.referenceView() }
        : 'A prepared Earth observer is not available for this view.',
      orbit: 'Drag to orbit this prepared scene. A rotation lock is not available.',
      fit: cameraReady && shell.presentation?.densityCamera && shell.view === 'alignment'
        ? { id: 'fit-cloud', onActivate: () => void controller.current?.fitCloud() } : 'Cloud fitting is available in density Alignment.',
      reset: cameraReady ? { id: 'reset', onActivate: () => void controller.current?.resetCamera() } : 'The prepared camera is not available yet.',
    }} cameraHint="Drag to orbit · scroll to zoom"
    footer={<p id="status" role="status" aria-live="polite" hidden={shell.presentation?.status.hidden ?? false}
      data-error={shell.presentation?.status.error ? 'true' : undefined}>{shell.presentation?.status.message ?? 'Loading…'}</p>}>
    <section id="density-adjustment-panel" className="inspection-section" hidden={!shell.presentation?.densityAdjustments}>
      <fieldset id="density-tone-fieldset" disabled={shell.presentation?.toneDisabled ?? true}><div id="density-tone-controls" /></fieldset>
    </section>
    <section id="cloud-density-panel" className="inspection-section" aria-label="Reconstruction density filter" hidden={!shell.presentation?.cloudDensity}>
      <div id="cloud-density-controls" />
    </section>
    {!shell.presentation?.densityAdjustments && !shell.presentation?.cloudDensity && <p className="interaction-hint">Fixed prepared model · no editable model parameters</p>}
  </CameraModelPanel>;
}
