import { useRef, type KeyboardEvent } from 'react';
import { labObjects } from './controller';
import { useLabController } from '../state/use-lab-controller';
import { ControlPortalContents } from '../ui/control-portals';
import { CameraPanel } from '../ui/camera-panel';
import { AlignmentControls } from '../pages/alignment/controls';
import { ReconstructionControlsPanel } from '../pages/reconstruction/controls';
import { subjects } from '../features/legacy-viewer/controller';
import { EmissionComparison } from '../features/observations/emission-comparison';
import { labWorkflows, readLabWorkflow } from '../state/lab-workflows.ts';
import { ObservationAlignment } from '../features/observations/observation-alignment';

export function App() {
  const { shell, controller, controls, updateAlignment } = useLabController();
  const navigation = useRef<HTMLDivElement>(null);
  function navigateKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
    const button = navigation.current?.querySelectorAll<HTMLButtonElement>('button')[next];
    if (!button || button.disabled) return;
    void controller.current?.selectView(next === 0 ? 'alignment' : 'reconstruction'); button.focus();
  }
  const selectedSubject = subjects.find(item => item.id === shell.objectId);
  const emission = selectedSubject?.emissionExperiment;
  const observationWorkspace = selectedSubject?.observationAlignment?.candidates ?? selectedSubject?.observationAlignment;
  const workflow = selectedSubject?.workflow ? labWorkflows[readLabWorkflow(selectedSubject.workflow)] : undefined;
  return <>
    <header className="lab-header">
      <h1>Nebula Lab</h1>
      <div className="subject-field"><label htmlFor="subject">Object</label><select id="subject" value={shell.objectId} disabled={shell.busy} onChange={event => void controller.current?.changeObject(event.target.value)}>{labObjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      {workflow && <span className="interaction-hint" title={selectedSubject?.modelNote ?? workflow.description}>{selectedSubject?.alignmentOnly ? 'Source inspection' : workflow.label}</span>}
      <a className="text-button" href="/catalogue" target="_blank" rel="noreferrer" title="Open archive candidates without closing this workspace or changing its camera.">Catalogue ↗</a>
      <div role="tablist" aria-label="View" ref={navigation}>
        <button id="density-tab" type="button" role="tab" aria-selected={shell.view === "alignment"} aria-controls="render-panel" tabIndex={shell.view === "alignment" ? 0 : -1} disabled={shell.busy || !shell.alignmentAvailable} onClick={() => void controller.current?.selectView("alignment")} onKeyDown={event => navigateKey(event, 0)}>Alignment</button>
        <button id="render-tab" type="button" role="tab" aria-selected={shell.view === "reconstruction"} aria-controls="render-panel" tabIndex={shell.view === "reconstruction" ? 0 : -1} disabled={shell.busy || selectedSubject?.alignmentOnly} title={selectedSubject?.alignmentOnly ? 'Source inspection only; reconstruction has not been configured.' : undefined} onClick={() => void controller.current?.selectView("reconstruction")} onKeyDown={event => navigateKey(event, 1)}>Reconstruction</button>
      </div>
    </header>
    <main className="lab-layout">
      <section className="lab-workspace" aria-label="Object inspection">
        <div className="workspace-content">
          <div id="render-panel" role="tabpanel" aria-labelledby={shell.view === "alignment" ? "density-tab" : "render-tab"}>
            <div id="viewer" aria-label="Interactive prepared object" tabIndex={0} aria-busy={shell.busy}
              hidden={shell.presentation?.viewerHidden ?? false} inert={shell.busy || shell.presentation?.viewerHidden}></div>
          </div>
          {emission && shell.view === 'reconstruction' && <EmissionComparison key={selectedSubject?.id} {...emission} credit={selectedSubject?.credit}
            observationManifest={selectedSubject?.observationAlignment?.manifest}
            onModeChange={mode => void controller.current?.selectEmissionInspection(mode)} />}
          {observationWorkspace && shell.view === 'alignment' && <ObservationAlignment key={observationWorkspace.manifest} manifestPath={observationWorkspace.manifest} dossierPath={observationWorkspace.dossier}
            onOpenCompiler={emission?.compilerSource ? () => void controller.current?.selectView('reconstruction') : undefined} />}
          <CameraPanel shell={shell} controller={controller} />
          <AlignmentControls shell={shell} controller={controller} updateAlignment={updateAlignment} />
          <ReconstructionControlsPanel shell={shell} controller={controller} />
        </div>
      </section>
    </main>
    <ControlPortalContents controls={controls} />
  </>;
}
