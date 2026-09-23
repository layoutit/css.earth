import { createCameraViewport } from '../src/renderers/css/dist/navigation.js';
import { worldVisibilityPolicy } from './application-world-visibility.mts';

/** The shell's camera viewport, shared by the body and the world. It is pure layout, so it exists before the
 * world's code loads. On phones, centre the focus between the floating header and drawer readout. */
export function createWorldViewport(stage: HTMLElement) {
  const document = stage.ownerDocument;
  return createCameraViewport(stage, document.querySelector<HTMLElement>('.object-sidebar'), worldVisibilityPolicy.compact ? {
    above: document.querySelector<HTMLElement>('.explorer-shell-header'),
    below: document.querySelector<HTMLElement>('.object-view-readout') } : null);
}
