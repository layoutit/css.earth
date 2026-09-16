import type { ReactNode } from 'react';
import { InfoTip } from './info-tip';

export type CameraControl = { onActivate(): void; pressed?: boolean; description?: string; id?: string } | string;
export interface CameraModelPanelProps {
  id?: string; className?: string; hidden?: boolean; controlsId?: string;
  camera?: Partial<Record<'earth' | 'orbit' | 'fit' | 'reset', CameraControl>>;
  unavailableReason?: string; busy?: boolean; cameraHint?: ReactNode;
  children?: ReactNode; modelReason?: string; footer?: ReactNode;
}
const actions = [
  ['earth', 'Earth view', '⊕', 'Return to the configured Earth-facing view.'],
  ['orbit', 'Orbit', '⟳', 'Switch between free rotation and the Earth-facing view.'],
  ['fit', 'Fit', '⛶', 'Fit the prepared image or cloud to the preview.'],
  ['reset', 'Reset', '↺', 'Restore the initial camera framing.'],
] as const;

/** Shared controls and section order; each method supplies only real capabilities and model content. */
export function CameraModelPanel({ id, className = 'workspace-model-panel', hidden, controlsId, camera = {},
  unavailableReason = 'This camera action is not available for the current view.', busy = false,
  cameraHint, children, modelReason, footer }: CameraModelPanelProps) {
  return <aside id={id} className={`floating-panel ${className}`} hidden={hidden} aria-label="Camera and model" data-camera-model-panel>
    <div id={controlsId} className="image-layer-buttons" role="group" aria-label="Camera actions">
      {actions.map(([key, label, icon, explanation]) => {
        const capability = camera[key], action = typeof capability === 'object' ? capability : undefined;
        const disabled = busy || !action;
        const reason = busy ? 'The current scene is loading.' : typeof capability === 'string' ? capability : unavailableReason;
        return <InfoTip key={key} content={disabled ? `${explanation} ${reason}` : action?.description ?? explanation}>
          <button id={action?.id} type="button" data-camera-action={key} aria-label={label} aria-disabled={disabled}
            aria-pressed={action?.pressed} onClick={() => { if (!disabled) action?.onActivate(); }}>
            <span aria-hidden="true">{icon}</span><span>{label}</span>
          </button>
        </InfoTip>;
      })}
    </div>
    {cameraHint && <div className="interaction-hint">{cameraHint}</div>}
    <fieldset className="workspace-model"><legend>Model</legend>
      {children ?? <p className="interaction-hint">{modelReason ?? 'This prepared model has no editable parameters.'}</p>}
    </fieldset>
    {footer}
  </aside>;
}
