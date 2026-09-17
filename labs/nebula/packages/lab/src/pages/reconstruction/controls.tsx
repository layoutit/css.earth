import { ImageAppearancePanel, ImageAppearanceCheckbox } from '../../ui/image-appearance-panel';
import { subjects } from '../../features/legacy-viewer/controller';
import { WorkspaceSections } from './workspace-sections';
import '../../features/workspace/workspace-controls.css';
import type { LabControlsProps } from '../../state/use-lab-controller';

export function ReconstructionControlsPanel({ shell, controller }: LabControlsProps) {
  const emission = subjects.find(item => item.id === shell.objectId)?.emissionExperiment;
  return <aside id="cloud-adjustment-panel" className="floating-panel cloud-adjustment-panel" aria-label="Reconstruction adjustments" hidden={shell.view !== 'reconstruction' || !shell.presentation?.cloudAdjustments && Boolean(emission)}>
            <ImageAppearancePanel
              image={shell.presentation?.reconstructionImages ? <div id="reconstruction-image-picker" /> : <><label className="visually-hidden" htmlFor="unavailable-reconstruction-image">Image</label><select id="unavailable-reconstruction-image" disabled><option>No image reconstruction configured</option></select><div id="reconstruction-image-picker" hidden /></>}
              material={shell.material?.available && !shell.material.loading && !shell.busy ? { mode: shell.material.mode, onChange: mode => void controller.current?.setMaterial(mode) } : { mode: shell.material?.mode, reason: shell.material?.loading ? 'Loading the prepared material bank.' : 'This saved reconstruction does not include a matching prepared neutral bank.' }}
              stars={<div id="reconstruction-stars-toggle" />}
              original={<ImageAppearanceCheckbox id="reconstruction-original-enabled" label="Original" control={shell.busy || !shell.originalOverlay?.available || shell.originalOverlay.loading ?
                { checked: shell.originalOverlay?.enabled, reason: 'Select a saved reconstruction prepared with an original-image reference.' } :
                { checked: shell.originalOverlay.enabled, onChange: enabled => void controller.current?.showOriginal(enabled) }} />} />
            <WorkspaceSections visible={shell.view === 'reconstruction' && !emission} active="compiler" capabilities={{ compiler: true }} onChange={() => {}} />
            {!shell.presentation?.cloudAdjustments && <fieldset disabled title="This object has a prepared density model but no image reconstruction workflow."><legend>Image and processing</legend><p className="interaction-hint">No image reconstruction is configured.</p></fieldset>}
            <fieldset id="reconstruction-image-controls" hidden={!shell.presentation?.reconstructionImages}>
              <legend>Processing</legend>
              <div id="reconstruction-processing"></div>
            </fieldset>
            {shell.view === 'reconstruction' && <fieldset className="inspection-section" id="reconstruction-original-controls"
              disabled={shell.busy || !shell.originalOverlay?.available || shell.originalOverlay.loading}
              title={shell.originalOverlay?.available ? 'Original photograph in this saved reconstruction’s exact registration.' : 'Select a saved reconstruction prepared with an original-image reference.'}>
              <legend>Image comparison</legend>
              <div className="cloud-brightness-control">
                <label htmlFor="reconstruction-original-opacity">Opacity</label>
                <input id="reconstruction-original-opacity" type="range" min="0" max="100" step="1" value={(shell.originalOverlay?.opacity ?? .5) * 100}
                  disabled={!shell.originalOverlay?.enabled} onChange={event => void controller.current?.setOriginalOpacity(event.currentTarget.valueAsNumber / 100)} />
                <output htmlFor="reconstruction-original-opacity">{Math.round((shell.originalOverlay?.opacity ?? .5) * 100)}%</output>
              </div>
              {shell.originalOverlay?.loading && <span role="status">Loading image…</span>}
            </fieldset>}
            <div id="cloud-star-controls"></div>
            <div id="cloud-controls"></div>
          </aside>;
}
