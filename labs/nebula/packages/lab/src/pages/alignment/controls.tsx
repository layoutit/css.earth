import '../../features/workspace/workspace-controls.css';
import type { LabControlsProps } from '../../state/use-lab-controller';
import type { AlignmentState } from '../../state/lab-shell';
import { ImageCredit } from '../../features/workspace/image-credit';

export function AlignmentControls({ shell, controller, updateAlignment }: LabControlsProps & { updateAlignment(value: Partial<AlignmentState>): void }) {
  const alignment = shell.alignment;
  return <aside id="image-overlay-panel" className="image-overlay-panel" aria-label="Image placement" hidden={shell.view !== 'alignment'} data-selected-overlay={alignment?.imageId}>
            <fieldset id="overlay-controls" disabled={!shell.presentation?.imageAdjustments || (shell.presentation?.toneDisabled ?? true)}>
              <legend className="visually-hidden">Image adjustments</legend>
              <ImageCredit credit={alignment?.credit} active={shell.view === 'alignment' && Boolean(shell.presentation?.imageAdjustments)} />
              {!shell.presentation?.imageAdjustments && <p className="interaction-hint">No image overlays are configured for this object.</p>}
              <label className="visually-hidden" htmlFor="overlay-choice">Image</label>
              <select id="overlay-choice" value={alignment?.imageId ?? ""} onChange={event => controller.current?.chooseImage(event.target.value)}>{alignment?.images.map(image => <option key={image.id} value={image.id}>{image.label}</option>)}</select>
              <div id="overlay-layer-control" hidden={!alignment || alignment.layers.length < 2}>
                <div id="overlay-layer" title="NOX estimates the background from the image. The residual is predicted compact light, not a measured star catalogue." className="image-layer-buttons" role="group" aria-label="Image layer" data-value={alignment?.layer ?? "original"}>
                  <button type="button" data-image-layer="original" onClick={() => controller.current?.chooseLayer("original")} disabled={!alignment?.layers.includes("original")} aria-label="Original" aria-pressed={alignment?.layer === "original"} title="Original"><span aria-hidden="true">▧</span><span>Original</span></button>
                  <button type="button" data-image-layer="diffuse" onClick={() => controller.current?.chooseLayer("diffuse")} disabled={!alignment?.layers.includes("diffuse")} aria-label="Without stars" aria-pressed={alignment?.layer === "diffuse"} title="Without stars"><span aria-hidden="true">☁</span><span>Without stars</span></button>
                  <button type="button" data-image-layer="stars" onClick={() => controller.current?.chooseLayer("stars")} disabled={!alignment?.layers.includes("stars")} aria-label="Residual" aria-pressed={alignment?.layer === "stars"} title="Residual"><span aria-hidden="true">✧</span><span>Residual</span></button>
                </div>
                <p id="overlay-layer-note" className="overlay-detail">{alignment?.layerNote}</p>
                <div id="star-removal-controls" hidden={!alignment?.layers.includes("diffuse")}>
                  <div className="tone-control">
                    <label htmlFor="star-removal-range">Star removal</label>
                    <input id="star-removal-range" onChange={event => { updateAlignment({ removalStrength: event.target.valueAsNumber }); controller.current?.setRemovalStrength(event.target.valueAsNumber); }} title="0% shows the original image; 100% shows the prepared removal. Remove stars prepares a new NOX result." type="range" min="0" max="100" step="1" value={alignment?.removalStrength ?? 100} aria-describedby="star-removal-note" />
                    <input id="star-removal" onChange={event => { if (Number.isFinite(event.target.valueAsNumber)) { updateAlignment({ removalStrength: event.target.valueAsNumber }); controller.current?.setRemovalStrength(event.target.valueAsNumber); } }} type="number" min="0" max="100" step="1" value={alignment?.removalStrength ?? 100} aria-label="Star removal percent" />
                  </div>
                  <p id="star-removal-note" className="visually-hidden">0% Original · 100% Prepared removal</p>
                </div>
              </div>
              <div id="automatic-star-removal"></div>
              <label htmlFor="density-overlay-enabled"><input id="density-overlay-enabled" type="checkbox" checked={alignment?.densityOverlayEnabled ?? false} onChange={event => controller.current?.showDensityOverlay(event.target.checked)} /> Density overlay</label>
              <div className="overlay-visibility">
                <label id="overlay-enabled-label" htmlFor="overlay-enabled"><input id="overlay-enabled" type="checkbox" checked={alignment?.enabled ?? false} onChange={event => { updateAlignment({ enabled: event.target.checked }); controller.current?.showImage(event.target.checked); }} /> Show image</label>
                <label htmlFor="overlay-opacity">Opacity</label>
                <input id="overlay-opacity" type="range" min="0" max="100" value={alignment?.opacity ?? 55} onChange={event => { updateAlignment({ opacity: event.target.valueAsNumber }); controller.current?.setImageOpacity(event.target.valueAsNumber); }} />
                <output htmlFor="overlay-opacity">{Math.round(alignment?.opacity ?? 55)}%</output>
              </div>
              <div id="image-tone-controls"></div>
              <div id="overlay-options"></div>
              <p id="overlay-status" className="overlay-status" role="status" title={alignment?.statusDetail}>{alignment?.status}</p>
              <button className="text-button" type="button" popoverTarget="image-source-info" aria-label="Alignment information">ⓘ Alignment information</button>
              <div id="image-source-info" className="lab-info-popover" popover="auto">
                <button type="button" popoverTarget="image-source-info" popoverTargetAction="hide" aria-label="Close image information">×</button>
                <p id="overlay-registration" className="overlay-detail">{alignment?.registrationNote}</p>
              </div>
            </fieldset>
          </aside>;
}
