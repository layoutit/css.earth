/** Drag and wheel for a page without script: its markup, and the one stylesheet every such page links
 * (`/native-input.css`). A page with script never requests the stylesheet, and the markup sits in a `<noscript>`.
 *
 * Dragging turns the body a native response drew. The browser's own resize handle holds the drag: it follows the
 * pointer exactly, starts from where it was grabbed and keeps its value on release, and nothing else in CSS does all
 * three. Firefox's handle is about six pixels and cannot be enlarged, so the handle comes to the pointer instead: a row
 * of narrow strips covers the scene, the strip under the pointer takes an anchor name, and a clipping frame sits on that
 * anchor. Once the pointer rests on the frame no strip is hovered, so the strip keeps the name by a transition whose
 * delay never ends. The next strip the pointer crosses takes the name back from every strip after it, and wins over
 * every strip before it, because the last anchor of a name in the tree is the one read. One rule per strip moving the
 * frame did the same and cost over four times main's style time in a drag (452 ms against 103 ms for thirty steps on
 * Saturn in Chromium 148): each restyle of the frame tested every rule against every strip.
 *
 * Inside the frame the sensor is stretched to the full height, so its handle is a column under the pointer and a
 * horizontal drag is still stored one pixel for one pixel. Its direction is right to left: the handle is then on the
 * left edge, which stays put while the box grows away from the pointer (WebKit miscounts a box whose handle moves under
 * the pointer).
 *
 * Anchor positioning carries the stored width to the body, which lives in another subtree: the world stage takes the
 * sensor's width, the stage reads that as `100cqw` into an inherited length, and the spinning meshes turn by it.
 * Firefox keeps an anchored box current only when both its insets are bare `anchor()` functions, so the right inset
 * names the sensor although the width wins. The stage keeps the viewport's own width.
 *
 * The wheel scales the stage through a scroll timeline, where the engine has one. The scroll area opens part-way down
 * its range so the wheel goes both ways: `scroll-initial-target` places it in Chromium, and the focus the marker asks
 * for places it in WebKit. Firefox ships no scroll timelines and nothing else there reads a scroll position, so it
 * drags and does not zoom. The wheel rule also asks for `::-webkit-resizer`, which only the two engines it was measured
 * in have: Firefox with its scroll-timeline preference switched on accepts the rule and leaves the stage on the
 * animation's last frame, a tenth of its size. Measured without script in Chromium 148, WebKit 26.4 and Firefox 150 (2026-10-03).
 *
 * A page's own address ships a photograph and an empty stage: the drawn body comes with a dataset, settings or
 * saved-view response (dataset-response.mts). On that page the wheel scales the photograph, and a button covers the scene
 * and submits the settings form as it stands, which answers with the same view drawn. A drag that ends on the button is
 * a press of it, so the first try to turn the photograph loads the body the next one turns. On live css.earth the plain
 * pages of twenty bodies answered neither a 120 pixel drag nor a 300 pixel wheel (Chrome 154, 2026-10-08). A picture is
 * centred by a translate of half its size, which a scale about its own centre would carry aside (Earth's photograph
 * landed low and to the right at 0.63), so it scales about the corner the translate starts from. */

/** Width of a strip. Firefox's handle answers within six pixels of its corner; the frame keeps a pixel of slack on
 * each side, because Firefox starts the handle a pixel inside the box and Chromium rounds a pointer on a strip's far
 * edge outward. */
const STRIP_PIXELS = 5;
const FRAME_PIXELS = STRIP_PIXELS + 2;
/** Strips cover a scene 2,560 pixels wide; beyond it the frame stays on the last strip the pointer crossed. */
export const NATIVE_INPUT_STRIPS = 512;
/** The sensor is sixteen pixels tall and its handle answers in the bottom six rows. Stretched about a point 95.3% down
 * its height, every scene row up to five times this many pixels lands inside those rows and never on the bottom edge,
 * which Chromium and WebKit count as outside the handle. */
const SENSOR_STRETCH = 500;
/** The sensor's opening width, with as much travel again on each side: 0.3 degrees a pixel is 3.4 turns each way. */
const SENSOR_START_PIXELS = 4096;
const DEGREES_PER_PIXEL = 0.3;

/** The wheel's travel, as scroll progress and the scale it gives: a tenth to five times, opening at one. Each scale
 * multiplies the fit the page gives its stage (`--native-fit`, from the two stage lengths ObjectLayout.astro sets), so a
 * body the layout keeps within the viewport's height zooms from there. */
const ZOOM_STEPS = [[0, 5], [10, 3.381], [20, 2.287], [30, 1.546], [40, 1.046], [40.984, 1], [50, 0.7071], [60, 0.4782], [70, 0.3234], [80, 0.2187], [90, 0.1479], [100, 0.1]] as const;

/** The meshes a drag turns. A native view leaves a spinning body's meshes on a paused, looping animation
 * (`prepared-native-view.ts`); a variable star's light curve loops on a veil, not a mesh, and is left alone. A body
 * with no spin plan has no such animation, so its body mesh is found by its class, the last it carries. Of the 4,600
 * prepared trees, 26 spin and 4,436 have a body mesh and no spin; in none does one of these meshes hold another, which
 * would turn it twice (2026-10-08). Before the class was read a drag turned the 26 and nothing else. */
export const NATIVE_TURNING_MESH = '.object-stage .polycss-mesh:is([style*=" infinite both paused"], [class$="-body"])';
/** The photograph of a page that has not drawn its stage: the arrival image ObjectLayout.astro places after the stage. */
const NATIVE_PHOTOGRAPH = '.object-stage:not([data-prepared-object]) ~ img[data-startup-billboard]';

export const nativeInputStylesheet = `@property --native-stage-height { syntax: '<length>'; inherits: false; initial-value: 1px; }
@property --native-stage-width { syntax: '<length>'; inherits: false; initial-value: 1px; }
@property --native-fit { syntax: '<number>'; inherits: false; initial-value: 1; }
@property --native-turn { syntax: '<length>'; inherits: true; initial-value: ${SENSOR_START_PIXELS}px; }
@keyframes native-zoom { ${ZOOM_STEPS.map(([offset, scale]) => `${offset}% { scale: calc(${scale} * var(--native-fit, 1)); }`).join(' ')} }
.native-scene-input, .native-scene-open { display: none; }
.native-scene-still { position: absolute; left: 50vw; top: 50%; width: min(100vw, 1200px); height: auto; transform: translate(-50%, -50%); pointer-events: none; }
@supports (anchor-name: --native-drag) and (width: anchor-size(--native-drag width)) and (transition-behavior: allow-discrete) {
  .native-scene-input { position: absolute; inset: 0 0 var(--native-input-footer, 24px); z-index: 40; display: block; overflow: hidden; container-type: size; anchor-name: --native-input; }
  .native-drag-layer { position: sticky; top: 0; display: flex; height: 100cqh; margin-bottom: -100cqh; overflow: hidden; cursor: grab; }
  .native-drag-layer:active { cursor: grabbing; }
  .object-viewport:has(> .object-world-stage > ${NATIVE_PHOTOGRAPH}) .native-scene-open { position: sticky; top: 0; z-index: 1; display: block; width: 100%; height: 100cqh; margin: 0 0 -100cqh; padding: 0; border: 0; background: none; cursor: grab; }
  .native-drag-layer > i { flex: none; width: ${STRIP_PIXELS}px; transition: anchor-name 0s 1000000s allow-discrete; }
  .native-drag-layer > i:hover { anchor-name: --native-strip; transition-delay: 0s; }
  .native-drag-layer > i:hover ~ i { transition: none; }
  .native-drag-frame { position: absolute; top: 0; bottom: 0; left: anchor(--native-strip left); right: anchor(--native-strip right); width: ${FRAME_PIXELS}px; margin-left: -1px; overflow: hidden; }
  .native-drag-sensor { position: absolute; left: 0; bottom: 0; width: ${SENSOR_START_PIXELS}px; height: 16px; min-width: 0; max-width: ${2 * SENSOR_START_PIXELS}px; direction: rtl; resize: horizontal; overflow: hidden; opacity: 0; touch-action: none; anchor-name: --native-drag; transform: scale(1, ${SENSOR_STRETCH}); transform-origin: left 95.3%; }
  .object-viewport > .object-world-stage { inset: 0 anchor(--native-drag right) auto anchor(--native-input left); width: anchor-size(--native-drag width); height: 100%; }
  .object-viewport > .object-world-stage > .object-stage { width: 100vw; --native-turn: 100cqw; }
  ${NATIVE_TURNING_MESH} {
    rotate: z calc(tan(atan2(var(--native-turn) - ${SENSOR_START_PIXELS}px, ${SENSOR_START_PIXELS}px)) * ${-DEGREES_PER_PIXEL * SENSOR_START_PIXELS}deg);
  }
  .native-zoom-start { display: none; }
  @supports (animation-timeline: scroll()) and (timeline-scope: --native-zoom) and selector(::-webkit-resizer) {
    .object-viewport { timeline-scope: --native-zoom; }
    .native-scene-input { overflow: hidden scroll; scrollbar-width: none; overscroll-behavior: contain; scroll-timeline: --native-zoom y; }
    .native-zoom-start { display: block; height: 100cqh; margin: 1000px 0 1440px; outline: none; scroll-initial-target: nearest; }
    .object-stage[data-prepared-object], ${NATIVE_PHOTOGRAPH}, .native-scene-still { animation: native-zoom linear both; animation-timeline: --native-zoom; }
    ${NATIVE_PHOTOGRAPH}, .native-scene-still { transform-origin: 0 0; }
  }
}
`;

/** The input layer, for a `<noscript>` that comes before the world stage in the viewport: an anchor has to precede the
 * box that reads it. Its button belongs to the settings form every page carries (ObjectShell.astro). */
export const nativeInputMarkup = `<div class="native-scene-input" role="group" aria-label="Drag to turn, scroll to zoom"><button class="native-scene-open" type="submit" form="object-settings-form" aria-label="Turn and zoom"></button><div class="native-drag-layer" aria-hidden="true">${'<i></i>'.repeat(NATIVE_INPUT_STRIPS)}<div class="native-drag-frame"><div class="native-drag-sensor"></div></div></div><span class="native-zoom-start" aria-hidden="true" tabindex="-1" autofocus></span></div>`;
