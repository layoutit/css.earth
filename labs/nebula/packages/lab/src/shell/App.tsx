import { useEffect, useState } from 'react';
import { LabNavigation } from '../ui/lab-navigation';
import { labObjects } from './controller';
import { useLabController } from '../state/use-lab-controller';
import { ControlPortalContents } from '../ui/control-portals';
import { CameraPanel } from '../ui/camera-panel';
import { AlignmentControls } from '../pages/alignment/controls';
import { ReconstructionControlsPanel } from '../pages/reconstruction/controls';
import { subjects } from '../features/legacy-viewer/controller';
import { labStep, labStepUrl, type LabStep } from '../features/legacy-viewer/lab-routing';
import { labWorkflows, readLabWorkflow } from '../state/lab-workflows.ts';
import { PlatesPanel } from '../features/plates/plates-panel';
import { SiteVolumePanel } from '../features/plates/site-volume-panel';
import { ResearchPanel } from '../features/research/research-panel';
import { solverPreview, type Preview } from '../features/model/model-preview';
import { AnnotateOverlay } from '../features/annotate/annotate-overlay';
import { ProgressStrip } from '../ui/progress-strip';

/** One nebula, four steps: Research · Model · Edit · Bake & publish. The viewport and the left camera panel stay
 * mounted across steps; the right panel shows the step. */
export function App() {
  const { shell, controller, controls, updateAlignment } = useLabController();
  const [step, setStep] = useState<LabStep>(() => labStep(new URL(location.href)));
  const [preview, setPreview] = useState<Preview>('surfaces');
  useEffect(() => {
    const follow = () => setStep(labStep(new URL(location.href)));
    window.addEventListener('popstate', follow);
    return () => window.removeEventListener('popstate', follow);
  }, []);
  const selectedSubject = subjects.find(item => item.id === shell.objectId);
  const workflow = selectedSubject?.workflow ? labWorkflows[readLabWorkflow(selectedSubject.workflow)] : undefined;
  // A derived dataset shares its picker entry; the shown subject is the one its panel edits.
  const shownSubject = subjects.find(item => item.id === (shell.subjectId ?? shell.objectId));
  useEffect(() => { setPreview('surfaces'); }, [shell.objectId]);
  const reload = (id: string) => void controller.current?.changeObject(id);
  const changeStep = (next: LabStep) => {
    setStep(next);
    const url = labStepUrl(new URL(location.href), next, shell.objectId);
    if (url.href !== location.href) history.pushState(history.state, '', url);
  };
  // A solver (Velocity, Joint fit) draws its own chart and camera in place of the viewport.
  const solver = step === 'model' && solverPreview(preview);
  const stepProps = { step, preview, onPreview: setPreview };
  return <>
    <LabNavigation step={step} objectId={shell.objectId} objects={labObjects} busy={shell.busy}
      method={workflow?.label} onObjectChange={id => void controller.current?.changeObject(id)} onStepChange={changeStep} />
    <main className="lab-layout" data-lab-step={step}>
      <section className="lab-workspace" aria-label="Object inspection">
        <div className="workspace-content">
          <div id="render-panel" role="region" aria-labelledby={`step-${step}`} hidden={solver}>
            <div id="viewer" aria-label="Interactive prepared object" tabIndex={0} aria-busy={shell.busy}
              hidden={shell.presentation?.viewerHidden ?? false} inert={shell.busy || shell.presentation?.viewerHidden}></div>
          </div>
          <CameraPanel shell={shell} controller={controller} step={step} />
          {step === 'edit' && shell.view === 'reconstruction' && <AnnotateOverlay shell={shell} controller={controller} />}
          {/* Hosts the shared controller still fills for density objects; hidden for every plate and site volume. */}
          <AlignmentControls shell={shell} controller={controller} updateAlignment={updateAlignment} />
          <ReconstructionControlsPanel shell={shell} controller={controller} />
          {shell.view === 'reconstruction' && step === 'research' && shownSubject && <ResearchPanel key={`research:${shownSubject.id}`} subjectId={shownSubject.id} />}
          {shell.view === 'reconstruction' && shownSubject?.plates &&
            <PlatesPanel subjectId={shownSubject.id} busy={shell.busy} onReload={reload} shell={shell} controller={controller} {...stepProps} />}
          {shell.view === 'reconstruction' && shownSubject?.siteVolume &&
            <SiteVolumePanel key={`volume:${shownSubject.id}`} subjectId={shownSubject.id} busy={shell.busy} onReload={reload} shell={shell} controller={controller} {...stepProps} />}
        </div>
      </section>
    </main>
    <ControlPortalContents controls={controls} />
    <ProgressStrip />
  </>;
}
