import { CameraModelPanel } from './camera-model-panel';
import type { LabControlsProps } from '../state/use-lab-controller';
import type { LabStep } from '../features/legacy-viewer/lab-routing';
import { InfoTip } from './info-tip';
import { setAnnotating, useAnnotating } from '../features/annotate/annotate-store.ts';
import { FieldStarsToggle } from '../features/stars/field-stars-toggle';

/** The left panel on every step: camera buttons, and in Edit the tools (Annotate and the circle tools). */
export function CameraPanel({ shell, controller, step }: LabControlsProps & { step: LabStep }) {
  const cameraReady = !shell.presentation?.cameraDisabled;
  const annotating = useAnnotating(), annotateReady = !shell.busy && shell.view === 'reconstruction';
  const earthAvailable = shell.presentation?.densityCamera && !shell.presentation.referenceDisabled;
  const editing = step === 'edit';
  return <CameraModelPanel id="inspection-panel" className="density-adjustment-panel" controlsId="render-controls"
    busy={shell.busy} showModel={false} camera={{
      earth: earthAvailable ? { id: 'reference-view', description: 'Reset orientation and distance to the prepared Earth observer.', onActivate: () => void controller.current?.referenceView() }
        : 'A prepared Earth observer is not available for this view.',
      orbit: 'Drag to orbit this prepared scene. A rotation lock is not available.',
      fit: cameraReady && shell.presentation?.densityCamera && shell.view === 'alignment'
        ? { id: 'fit-cloud', onActivate: () => void controller.current?.fitCloud() } : 'Cloud fitting is available in density Alignment.',
      reset: cameraReady ? { id: 'reset', onActivate: () => void controller.current?.resetCamera() } : 'The prepared camera is not available yet.',
      turn: cameraReady ? { id: 'turn-60', onActivate: () => void controller.current?.setPose('x-plus-60') } : 'The prepared camera is not available yet.',
    }} cameraHint={annotating ? 'Click a patch to select · shift-click adds · drag orbits' : 'Drag to orbit · scroll to zoom'}
    toolbox={editing ? <>
      <FieldStarsToggle shell={shell} controller={controller} />
      <InfoTip content={annotateReady ? 'Click patches in the viewport to select them and copy their place, depth and stretch.' : 'Annotate works on a loaded object.'}>
        <button id="annotate-toggle" type="button" data-camera-action="annotate" aria-label="Annotate" aria-pressed={annotating} aria-disabled={!annotateReady}
          onClick={() => { if (annotateReady || annotating) setAnnotating(!annotating); }}><span aria-hidden="true">✎</span><span>Annotate</span></button>
      </InfoTip>
      <div id="workspace-left-tools" />
    </> : undefined}
    footer={<>
      {/* Density hosts the shared controller still fills; hidden unless a density model is shown. */}
      <section id="density-adjustment-panel" className="inspection-section" hidden={!shell.presentation?.densityAdjustments}>
        <fieldset id="density-tone-fieldset" disabled={shell.presentation?.toneDisabled ?? true}><div id="density-tone-controls" /></fieldset>
      </section>
      <section id="cloud-density-panel" className="inspection-section" aria-label="Reconstruction density filter" hidden={!shell.presentation?.cloudDensity}>
        <div id="cloud-density-controls" />
      </section>
      <p id="status" role="status" aria-live="polite" hidden={shell.presentation?.status.hidden ?? false}
        data-error={shell.presentation?.status.error ? 'true' : undefined}>{shell.presentation?.status.message ?? 'Loading…'}</p>
    </>} />;
}
