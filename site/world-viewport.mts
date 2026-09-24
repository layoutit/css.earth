import { createCameraViewport } from '../src/renderers/css/dist/navigation.js';
import { MOBILE_VIEWPORT_QUERY } from './runtime-policy.mts';

/** The shell's camera viewport, shared by the body and the world. It is pure layout, so it exists before the
 * world's code loads. On phones, centre the focus between the floating header and drawer readout. */
export function createWorldViewport(stage: HTMLElement) {
  const document = stage.ownerDocument;
  const header = document.querySelector<HTMLElement>('.explorer-shell-header');
  return createCameraViewport(stage, document.querySelector<HTMLElement>('.object-sidebar'), stage.ownerDocument.defaultView?.matchMedia?.(MOBILE_VIEWPORT_QUERY).matches ? {
    above: header,
    below: document.querySelector<HTMLElement>('.object-view-readout') } : null, { header });
}
