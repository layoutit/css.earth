/** Native dimensions hold drag displacement. A separate, fixed-size scrollport
 * observes them so wheel zoom cannot change the X/Y signal. */
export function addNativeResizeInput(document: Document): string {
  const surface = document.querySelector('.object-input-surface');
  if (!surface) throw new TypeError('The shared scene input surface is missing.');
  const frame = document.createElement('div');
  frame.className = 'native-drag-frame';
  const sensor = document.createElement('div');
  sensor.className = 'native-drag-sensor';
  sensor.setAttribute('aria-hidden', 'true');
  sensor.setAttribute('style', 'width:20480px;height:20480px');
  frame.append(sensor);
  const zoomRail = document.createElement('div');
  zoomRail.className = 'native-touch-zoom';
  zoomRail.setAttribute('aria-label', 'Swipe vertically to zoom');
  const zoomLabel = document.createElement('span');
  zoomLabel.textContent = '↕ Zoom';
  zoomRail.append(zoomLabel);
  // Links belong to the scrollport as well: wheel gestures over a marker
  // must reach the same native zoom scroller while clicks still navigate.
  const links = document.createElement('div');
  links.className = 'native-drag-links';
  const context = document.querySelector('.object-scene-overlays > .prepared-world-context');
  if (context) links.append(context);
  const spacer = document.createElement('span');
  spacer.className = 'native-zoom-spacer';
  spacer.setAttribute('aria-hidden', 'true');
  surface.prepend(frame, links, zoomRail, spacer);
  surface.setAttribute('aria-label', 'Drag to rotate; scroll to zoom');
  document.documentElement.dataset.nativeDrag = 'resize';
  return `
@property --native-drag-x-progress { syntax: '<number>'; inherits: false; initial-value: 0; }
@property --native-drag-y-progress { syntax: '<number>'; inherits: false; initial-value: 0; }
@property --native-drag-x { syntax: '<number>'; inherits: false; initial-value: 0; }
@property --native-drag-y { syntax: '<number>'; inherits: false; initial-value: 0; }
@property --native-yaw { syntax: '*'; inherits: false; }
@property --native-pitch { syntax: '*'; inherits: false; }
@keyframes native-drag-x { from { --native-drag-x-progress:0 } to { --native-drag-x-progress:1 } }
@keyframes native-drag-y { from { --native-drag-y-progress:0 } to { --native-drag-y-progress:1 } }
.object-viewport { --native-yaw:0deg; --native-pitch:0deg }
@supports (animation-timeline: view()) and selector(::-webkit-resizer) {
  .object-viewport {
    --native-zoom-rail-width: 0px;
    timeline-scope: --native-zoom, --native-drag-width, --native-drag-height;
    animation: native-scroll-distance linear both, native-drag-x linear both, native-drag-y linear both;
    animation-timeline: --native-zoom, --native-drag-width, --native-drag-height;
    --native-drag-x: calc((((100cqw - var(--native-zoom-rail-width)) / 1px + 8192) / max(.000001, var(--native-drag-x-progress)) - (100cqw - var(--native-zoom-rail-width)) / 1px - 20480) * sign(var(--native-drag-x-progress)));
    --native-drag-y: calc(((100cqh / 1px + 8192) / max(.000001, var(--native-drag-y-progress)) - 100cqh / 1px - 20480) * sign(var(--native-drag-y-progress)));
    --native-yaw: calc(var(--native-drag-x) * .3deg);
    --native-pitch: calc(var(--native-drag-y) * -.3deg);
  }
  .object-input-surface::before { display:none }
  .native-zoom-spacer { display:block; height:400px; pointer-events:none }
  .native-drag-frame {
    position:sticky; top:0; height:100%; width:calc(100% - var(--native-zoom-rail-width)); margin-bottom:-100cqh;
    overflow:hidden; contain:strict; z-index:1; cursor:grab;
  }
  .native-drag-frame:active { cursor:grabbing }
  .native-drag-sensor {
    position:absolute; left:-8192px; top:-8192px;
    min-width:16384px; min-height:16384px;
    max-width:24576px; max-height:24576px;
    resize:both; overflow:scroll; opacity:0; touch-action:none;
    view-timeline: --native-drag-width x, --native-drag-height y;
  }
  .native-drag-sensor::-webkit-scrollbar { width:16384px; height:16384px }
  .native-drag-sensor::-webkit-resizer { cursor:inherit }
  .native-drag-links { position:sticky; top:0; height:100%; margin-bottom:-100cqh; overflow:clip; contain:strict; pointer-events:none; z-index:2 }
  .native-touch-zoom { display:none }
  @media (pointer:coarse) {
    .object-viewport { --native-zoom-rail-width:44px }
    .native-touch-zoom {
      position:sticky; top:0; display:flex; height:100%; width:44px;
      margin-left:auto; margin-bottom:-100cqh; align-items:center; justify-content:center;
      touch-action:pan-y; z-index:3; color:var(--shell-text);
    }
    .native-touch-zoom span {
      writing-mode:vertical-rl; padding:12px 8px; border-radius:18px;
      background:var(--shell-panel, #141414); font:400 12px var(--shell-ui-font);
      pointer-events:none; user-select:none;
    }
  }
}
@supports not ((animation-timeline: view()) and selector(::-webkit-resizer)) {
  .native-drag-frame,.native-zoom-spacer,.native-touch-zoom { display:none }
}
`;
}
