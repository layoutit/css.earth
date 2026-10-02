import { createCameraViewport } from '@cssearth/renderer/navigation';

/** The shell's camera viewport, shared by the body and the world. It is pure layout, so it exists before the
 * world's code loads. On phones and portrait tablets, centre the focus between the top of the page and the band
 * where the search rests over the scene while the sheet peeks. The floating header does not count: its middle is
 * empty, so the eye measures from the top of the page. */
export function createWorldViewport(stage: HTMLElement) {
  const document = stage.ownerDocument;
  const header = document.querySelector<HTMLElement>('.explorer-shell-header');
  // The band is named on every layout: where it is not displayed it covers nothing, and a window resized from a desktop
  // to a phone's width then frames the next body in the open area. Chosen once at start, a desktop-started session
  // kept no open area and drew the Moon 135 pixels wide where a phone-started one drew 320 (2026-10-02).
  return createCameraViewport(stage, document.querySelector<HTMLElement>('.object-sidebar'), {
    above: null,
    below: document.querySelector<HTMLElement>('.object-viewport-search-band') }, { header });
}
