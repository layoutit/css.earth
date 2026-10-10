import { ObjectPicker } from './object-picker';
import type { MouseEvent } from 'react';
import { labSteps, labStepUrl, type LabStep } from '../features/legacy-viewer/lab-routing';

export interface NavigationObject { id: string; name: string }
interface Props {
  /** The shown step; none on a page outside the object workspace (the archive catalogue). */
  step?: LabStep;
  objectId: string;
  objects: readonly NavigationObject[];
  onObjectChange(id: string): void;
  onStepChange?(step: LabStep): void;
  busy?: boolean;
  method?: string;
}
/** One nebula, four steps in workflow order: Research · Model · Edit · Bake & publish. */
export function LabNavigation(props: Props) {
  function activate(event: MouseEvent<HTMLAnchorElement>, step: LabStep) {
    if (!props.onStepChange || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); props.onStepChange(step);
  }
  return <header className="lab-header">
    <h1>Nebula Lab</h1>
    <nav className="lab-navigation" aria-label="Workflow steps">
      {labSteps.map(([step, label], index) => {
        const href = labStepUrl(new URL(location.href), step, props.objectId);
        return <a key={step} id={`step-${step}`} data-lab-step={step} href={href.pathname + href.search + href.hash}
          aria-current={step === props.step ? 'page' : undefined} onClick={event => activate(event, step)}>
          <span className="lab-step-number" aria-hidden="true">{index + 1}</span>{label}</a>;
      })}
    </nav>
    <div className="subject-field" title={props.method}>
      <ObjectPicker value={props.objectId} objects={props.objects} disabled={props.busy} onChange={props.onObjectChange} />
    </div>
  </header>;
}
