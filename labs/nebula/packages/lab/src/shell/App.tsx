import { LabNavigation } from '../ui/lab-navigation';
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
  const selectedSubject = subjects.find(item => item.id === shell.objectId);
  const emission = selectedSubject?.emissionExperiment;
  const observationWorkspace = selectedSubject?.observationAlignment?.candidates ?? selectedSubject?.observationAlignment;
  const workflow = selectedSubject?.workflow ? labWorkflows[readLabWorkflow(selectedSubject.workflow)] : undefined;
  return <>
    <LabNavigation page={shell.view} objectId={shell.objectId} objects={labObjects}
      busy={shell.busy} alignmentAvailable={shell.alignmentAvailable} reconstructionAvailable={!selectedSubject?.alignmentOnly}
      method={workflow?.label} onObjectChange={id => void controller.current?.changeObject(id)}
      onViewChange={view => void controller.current?.selectView(view)} />
    <main className="lab-layout">
      <section className="lab-workspace" aria-label="Object inspection">
        <div className="workspace-content">
          <div id="render-panel" role="region" aria-labelledby={shell.view === "alignment" ? "density-tab" : "render-tab"}>
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
