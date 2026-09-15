import type { LabController, LabControlsProps } from '../state/use-lab-controller';

export function CameraPanel({ shell, controller }: LabControlsProps) {
  return <aside id="inspection-panel" className="floating-panel density-adjustment-panel" aria-label="Camera and density adjustments">
            <fieldset id="render-controls" disabled={shell.busy}>
              <legend>Camera</legend>
              <label className="field-label" htmlFor="camera-pose">View</label>
              <select id="camera-pose" aria-label="Fixed camera pose" value={shell.pose} disabled={shell.presentation?.cameraDisabled ?? true} onChange={event => void controller.current?.setPose(event.target.value as Parameters<LabController["setPose"]>[0])}>
                <option value="front">Front</option><option value="x-minus-60">X −60°</option><option value="x-minus-30">X −30°</option>
                <option value="x-plus-30">X +30°</option><option value="x-plus-60">X +60°</option><option value="y-minus-60">Y −60°</option>
                <option value="y-minus-30">Y −30°</option><option value="y-plus-30">Y +30°</option><option value="y-plus-60">Y +60°</option>
                <option value="edge-x">Edge X</option><option value="edge-y">Edge Y</option><option value="manual">Manual</option>
              </select>
              <div className="camera-actions"><button id="reset" type="button" disabled={shell.presentation?.cameraDisabled ?? true} onClick={() => void controller.current?.resetCamera()}>Reset camera</button></div>
              <div id="density-view-controls" className="camera-actions" hidden={!shell.presentation?.densityCamera}>
                <button id="reference-view" type="button" disabled={shell.presentation?.referenceDisabled ?? true} title="Reset orientation and distance to the prepared Earth observer." onClick={() => void controller.current?.referenceView()}>Earth view</button><button id="fit-cloud" type="button" disabled={shell.presentation?.cameraDisabled ?? true} hidden={shell.view !== 'alignment'} onClick={() => void controller.current?.fitCloud()}>Fit cloud</button>
              </div>
              <p className="interaction-hint">Drag to orbit. Scroll to zoom.</p>
            </fieldset>
            <section id="density-adjustment-panel" className="inspection-section" hidden={!shell.presentation?.densityAdjustments}>
              <fieldset id="density-tone-fieldset" disabled={shell.presentation?.toneDisabled ?? true}><legend>Model</legend><div id="density-tone-controls"></div></fieldset>
            </section>
            <section id="cloud-density-panel" className="inspection-section" aria-label="Reconstruction density filter" hidden={!shell.presentation?.cloudDensity}>
              <fieldset><legend>Model</legend><div id="cloud-density-controls"></div></fieldset>
            </section>
            {!shell.presentation?.densityAdjustments && !shell.presentation?.cloudDensity && <fieldset className="workspace-model" disabled title="This prepared scene does not expose editable model controls."><legend>Model</legend><p className="interaction-hint">No editable model controls</p></fieldset>}
            <p id="status" role="status" aria-live="polite" hidden={shell.presentation?.status.hidden ?? false}
              data-error={shell.presentation?.status.error ? 'true' : undefined}>{shell.presentation?.status.message ?? 'Loading…'}</p>
            <a id="source-link" className="model-source" hidden={!shell.presentation?.sourceUrl} href={shell.presentation?.sourceUrl} title={shell.presentation?.sourceCredit} target="_blank" rel="noreferrer">Model source ↗</a>
          </aside>;
}
