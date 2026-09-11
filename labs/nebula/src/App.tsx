import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { labObjects, mountNebulaLab, type LabShellState } from './main';
import { labView } from './viewer/lab-routing';
import { subjects } from './viewer/viewer';
import { EmissionComparison } from './components/emission-comparison';
import { labWorkflows, readLabWorkflow } from './utils/lab-workflows';
import { ObservationAlignment } from './components/observation-alignment';

type Controller = Awaited<ReturnType<typeof mountNebulaLab>>;
export function App() {
  const [shell, setShell] = useState<LabShellState>({ objectId: 'lmc-clouds', view: labView(new URL(location.href)), busy: true, alignmentAvailable: true, pose: 'front' });
  const controller = useRef<Controller | null>(null), navigation = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    void mountNebulaLab({ onShellState(next) {
      if (!disposed) setShell(previous => Object.entries(next).every(([key, value]) => previous[key as keyof LabShellState] === value) ? previous : next);
    } }).then(value => { if (disposed) value.destroy(); else controller.current = value; });
    return () => { disposed = true; controller.current?.destroy(); controller.current = null; };
  }, []);
  function navigateKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
    const button = navigation.current?.querySelectorAll<HTMLButtonElement>('button')[next];
    if (!button || button.disabled) return;
    void controller.current?.selectView(next === 0 ? 'alignment' : 'reconstruction'); button.focus();
  }
  const alignment = shell.alignment;
  const selectedSubject = subjects.find(item => item.id === shell.objectId);
  const emission = selectedSubject?.emissionExperiment;
  const workflow = selectedSubject?.workflow ? labWorkflows[readLabWorkflow(selectedSubject.workflow)] : undefined;
  const updateAlignment = (partial: Partial<NonNullable<LabShellState['alignment']>>) => setShell(value => value.alignment ? { ...value, alignment: { ...value.alignment, ...partial } } : value);
  return <>
    <header className="lab-header">
      <h1>Nebula Lab</h1>
      <div className="subject-field"><label htmlFor="subject">Object</label><select id="subject" value={shell.objectId} disabled={shell.busy} onChange={event => void controller.current?.changeObject(event.target.value)}>{labObjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      {workflow && <span className="interaction-hint" title={workflow.description}>{workflow.label}</span>}
      <div role="tablist" aria-label="View" ref={navigation}>
        <button id="density-tab" type="button" role="tab" aria-selected={shell.view === "alignment"} aria-controls="render-panel" tabIndex={shell.view === "alignment" ? 0 : -1} disabled={shell.busy || !shell.alignmentAvailable} onClick={() => void controller.current?.selectView("alignment")} onKeyDown={event => navigateKey(event, 0)}>Alignment</button>
        <button id="render-tab" type="button" role="tab" aria-selected={shell.view === "reconstruction"} aria-controls="render-panel" tabIndex={shell.view === "reconstruction" ? 0 : -1} disabled={shell.busy} onClick={() => void controller.current?.selectView("reconstruction")} onKeyDown={event => navigateKey(event, 1)}>Reconstruction</button>
      </div>
    </header>
    <main className="lab-layout">
      <section className="lab-workspace" aria-label="Object inspection">
        <div className="workspace-content">
          <div id="render-panel" role="tabpanel" aria-labelledby={shell.view === "alignment" ? "density-tab" : "render-tab"}>
            <div id="viewer" aria-label="Interactive prepared object" tabIndex={0}></div>
          </div>
          {emission && shell.view === 'reconstruction' && <EmissionComparison {...emission} credit={selectedSubject?.credit} />}
          {selectedSubject?.observationAlignment && shell.view === 'alignment' && <ObservationAlignment key={selectedSubject.observationAlignment.manifest} manifestPath={selectedSubject.observationAlignment.manifest} />}
          <aside id="inspection-panel" className="floating-panel density-adjustment-panel" aria-label="Camera and density adjustments">
            <fieldset id="render-controls" disabled>
              <legend>Camera</legend>
              <label className="field-label" htmlFor="camera-pose">View</label>
              <select id="camera-pose" aria-label="Fixed camera pose" value={shell.pose} onChange={event => void controller.current?.setPose(event.target.value as Parameters<Controller["setPose"]>[0])}>
                <option value="front">Front</option><option value="x-minus-60">X −60°</option><option value="x-minus-30">X −30°</option>
                <option value="x-plus-30">X +30°</option><option value="x-plus-60">X +60°</option><option value="y-minus-60">Y −60°</option>
                <option value="y-minus-30">Y −30°</option><option value="y-plus-30">Y +30°</option><option value="y-plus-60">Y +60°</option>
                <option value="edge-x">Edge X</option><option value="edge-y">Edge Y</option><option value="manual">Manual</option>
              </select>
              <div className="camera-actions"><button id="reset" type="button" onClick={() => void controller.current?.resetCamera()}>Reset camera</button></div>
              <div id="density-view-controls" className="camera-actions" hidden>
                <button id="reference-view" type="button" title="Reset orientation and distance to the prepared Earth observer." onClick={() => void controller.current?.referenceView()}>Earth view</button><button id="fit-cloud" type="button" hidden={shell.view !== 'alignment'} onClick={() => void controller.current?.fitCloud()}>Fit cloud</button>
              </div>
              <p className="interaction-hint">Drag to orbit. Scroll to zoom.</p>
            </fieldset>
            <section id="density-adjustment-panel" className="inspection-section" hidden>
              <fieldset id="density-tone-fieldset" disabled><legend>Density adjustments</legend><div id="density-tone-controls"></div></fieldset>
            </section>
            <section id="cloud-density-panel" className="inspection-section" aria-label="Reconstruction density filter" hidden>
              <div id="cloud-density-controls"></div>
            </section>
            <p id="status" role="status" aria-live="polite">Loading…</p>
            <a id="source-link" className="model-source" hidden target="_blank" rel="noreferrer">Model source ↗</a>
          </aside>
          <aside id="image-overlay-panel" className="image-overlay-panel" aria-label="Image placement" hidden>
            <fieldset id="overlay-controls" disabled>
              <legend>Image adjustments</legend>
              <label className="field-label" htmlFor="overlay-choice">Image</label>
              <select id="overlay-choice" value={alignment?.imageId ?? ""} onChange={event => controller.current?.chooseImage(event.target.value)}>{alignment?.images.map(image => <option key={image.id} value={image.id}>{image.label}</option>)}</select>
              <div id="overlay-layer-control" hidden>
                <div id="overlay-layer" className="image-layer-buttons" role="group" aria-label="Image layer" data-value={alignment?.layer ?? "original"}>
                  <button type="button" data-image-layer="original" onClick={() => controller.current?.chooseLayer("original")} disabled={!alignment?.layers.includes("original")} aria-label="Original" aria-pressed={alignment?.layer === "original"} title="Original"><span aria-hidden="true">▧</span><span>Original</span></button>
                  <button type="button" data-image-layer="diffuse" onClick={() => controller.current?.chooseLayer("diffuse")} disabled={!alignment?.layers.includes("diffuse")} aria-label="Without stars" aria-pressed={alignment?.layer === "diffuse"} title="Without stars"><span aria-hidden="true">☁</span><span>Without stars</span></button>
                  <button type="button" data-image-layer="stars" onClick={() => controller.current?.chooseLayer("stars")} disabled={!alignment?.layers.includes("stars")} aria-label="Residual" aria-pressed={alignment?.layer === "stars"} title="Residual"><span aria-hidden="true">✧</span><span>Residual</span></button>
                </div>
                <p id="overlay-layer-note" className="overlay-detail"></p>
                <div id="star-removal-controls">
                  <div className="tone-control">
                    <label htmlFor="star-removal-range">Star removal</label>
                    <input id="star-removal-range" onChange={event => { updateAlignment({ removalStrength: event.target.valueAsNumber }); controller.current?.setRemovalStrength(event.target.valueAsNumber); }} title="0% shows the original image; 100% shows the prepared removal. Remove stars prepares a new NOX result." type="range" min="0" max="100" step="1" value={alignment?.removalStrength ?? 100} aria-describedby="star-removal-note" />
                    <input id="star-removal" onChange={event => { if (Number.isFinite(event.target.valueAsNumber)) { updateAlignment({ removalStrength: event.target.valueAsNumber }); controller.current?.setRemovalStrength(event.target.valueAsNumber); } }} type="number" min="0" max="100" step="1" value={alignment?.removalStrength ?? 100} aria-label="Star removal percent" />
                  </div>
                  <p id="star-removal-note" className="visually-hidden">0% Original · 100% Prepared removal</p>
                </div>
              </div>
              <div id="automatic-star-removal"></div>
              <div className="overlay-visibility">
                <label id="overlay-enabled-label" htmlFor="overlay-enabled"><input id="overlay-enabled" type="checkbox" checked={alignment?.enabled ?? false} onChange={event => { updateAlignment({ enabled: event.target.checked }); controller.current?.showImage(event.target.checked); }} /> Show image</label>
                <label htmlFor="overlay-opacity">Opacity</label>
                <input id="overlay-opacity" type="range" min="0" max="100" value={alignment?.opacity ?? 55} onChange={event => { updateAlignment({ opacity: event.target.valueAsNumber }); controller.current?.setImageOpacity(event.target.valueAsNumber); }} />
              </div>
              <div id="image-tone-controls"></div>
              <div id="overlay-options"></div>
              <p id="overlay-status" className="overlay-status" role="status">{alignment?.status}</p>
              <button className="text-button" type="button" popoverTarget="image-source-info" aria-label="Image source and alignment information">ⓘ Source and alignment</button>
              <div id="image-source-info" className="lab-info-popover" popover="auto">
                <button type="button" popoverTarget="image-source-info" popoverTargetAction="hide" aria-label="Close image information">×</button>
                <p id="overlay-registration" className="overlay-detail">{alignment?.registrationNote}</p>
                <p id="overlay-credit" className="overlay-detail">{alignment?.credit}</p>
                <a id="overlay-source" className="overlay-detail" href={alignment?.sourcePageUrl} target="_blank" rel="noreferrer">Image source ↗</a>
              </div>
            </fieldset>
          </aside>
          <aside id="cloud-adjustment-panel" className="floating-panel cloud-adjustment-panel" aria-label="Reconstruction adjustments" hidden>
            <fieldset id="reconstruction-image-controls" hidden>
              <legend>Reconstruction</legend>
              <div id="reconstruction-processing"></div>
            </fieldset>
            {shell.view === 'reconstruction' && <fieldset className="inspection-section" id="reconstruction-original-controls"
              disabled={shell.busy || !shell.originalOverlay?.available || shell.originalOverlay.loading}
              title={shell.originalOverlay?.available ? 'Original photograph in this saved reconstruction’s exact registration.' : 'Select a saved reconstruction prepared with an original-image reference.'}>
              <legend>Image comparison</legend>
              <label htmlFor="reconstruction-original-enabled"><input id="reconstruction-original-enabled" type="checkbox"
                checked={shell.originalOverlay?.enabled ?? false} onChange={event => void controller.current?.showOriginal(event.target.checked)} /> Original image</label>
              <div className="cloud-brightness-control">
                <label htmlFor="reconstruction-original-opacity">Opacity</label>
                <input id="reconstruction-original-opacity" type="range" min="0" max="100" step="1" value={(shell.originalOverlay?.opacity ?? .5) * 100}
                  disabled={!shell.originalOverlay?.enabled} onChange={event => void controller.current?.setOriginalOpacity(event.currentTarget.valueAsNumber / 100)} />
                <output htmlFor="reconstruction-original-opacity">{Math.round((shell.originalOverlay?.opacity ?? .5) * 100)}%</output>
              </div>
              {shell.originalOverlay?.loading && <span role="status">Loading image…</span>}
            </fieldset>}
            <div id="cloud-star-controls" hidden></div>
            <div id="cloud-controls"></div>
          </aside>
        </div>
      </section>
    </main>
  </>;
}
