# Native resize as a camera input

The current working shape is a native resize surface for rotation, inside a
separate native scroll surface for zoom. Try the retained Saturn scene at
`http://127.0.0.1:4352/saturn/?drag=resize`:

```sh
node tools/experiments/native-scroll/run.mts http://127.0.0.1:4349 4352
```

The upstream shell must already be running. Drag anywhere in the exposed scene,
release, then start another drag elsewhere. Wheel scrolling zooms out to the Solar
System; its markers are ordinary links. On touch, dragging rotates and the 44px
strip labelled “Zoom” scrolls the same scene. The response blocks scripts with
CSP. It contains the same 972 prepared Saturn nodes, shell, materials and sky.

The state is concrete: a sensor starting at `width:20480px;height:20480px` becomes
`width:20580px;height:20530px` after a 100×50px drag. The browser writes those inline
dimensions and preserves them after release. CSS reads them through view
timelines and maps displacement to yaw/pitch at 0.3 degrees per pixel. Another
drag continues from those dimensions. Nothing follows an unpressed pointer.

`tools/experiments/native-scroll/resize-input.mts` owns this input. Its fixed
origin, large native corner, independent zoom scrollport and clipped marker
layer avoid resize jumps, zoom/rotation coupling and offscreen links enlarging
the scroll range. The browser-specific resize corner is the nonstandard part.

## The same camera, published by CSS

The local camera compiler emits CSS from the existing prepared camera and
material data. It updates the scene, counter-rotations, material phase address,
perspective ellipsoid correction, sky and orbital context. It does not generate
textures or geometry in the browser. Intermediate arithmetic stays on the
viewport; computed matrices are inherited by their existing targets.

The orbital context selects the existing prepared chord banks with the shared
0.1px bound for CSS bars. Conservative spheres around groups of prepared chords
skip projection only when the entire group lies outside the view. The nodes stay
retained. This matters more than containment on the resize sensor: projecting
every chord on every sample made the first full CSS camera too slow.

The numerical expressions use scaled intermediate storage to avoid WebKit's
rounding of small registered numbers. Perspective covariance calculations also
avoid a tiny intermediate factor. A discarded 1e36 storage scale overflowed in
Chromium; its captures are explicitly invalid. The current scale is 1e6.

Browser checks under `tests/experiments/native-scroll/` cover:

- `resize-browser.mts`: repeated drags, one-pixel movement, release, independent
  wheel zoom, wheel over a marker, and native Neptune navigation.
- `resize-platforms.mts chromium`: touch rotation and the touch zoom strip in
  Chrome mobile emulation.
- `camera-browser.mts`: nine matching physical poses against the shared numeric
  camera publisher. It also accepts a captured earlier native HTML response to
  check culling and prepared LOD changes against that exact earlier rendering.
- `perf-browser.mts` and `perf-analysis.mts`: three interleaved native/JS-input
  trials near Saturn, plus native trials at Solar System scale. Both input modes
  drive the same full CSS camera. This is distinct from the earlier full-JS
  renderer's sensor comparison below.

Generated evidence remains in ignored `output/playwright/native-drag/`. The
numeric and captured-reference image checks retain their errors and images;
performance runs retain the HTML, helper script, raw traces and hashes. Capture
without a simultaneous video or another heavy browser workload. Analyze traces
with the repository's `perf:trace` command before running `perf-analysis.mts`.

The final Chrome 153.0.8010.37 capture at 1280×900, DPR 1 records 23.9ms p95
presentation intervals for native input near Saturn and 24.5ms for JS input
driving the same CSS camera. Native input spends 6.1ms in layout during the
roughly four-second drag. Both cases still spend about 3.7 seconds in main-thread
tasks, so the CSS camera is CPU intensive. At Solar System scale its p95 interval
is 84.3ms. All measured 1.5-second idle windows have zero style/layout/paint work.
These are medians of three trials and browser presentation events, not counts of
unique camera poses. The separate JS-renderer comparison below measures a
different camera workload and must not be used to infer an end-to-end speed ratio.

Those captures use the HTML SHA-256
`2cb6edb2010975d54bd0bab7a72dc134ee477bcc16bdab72a3230a0b85cb59c4`.
The later source cleanup reads the same 0.1px tolerance from its shared owner
and supplies zero-angle defaults when the native input rule is unsupported.
Neither changes the measured Chromium path's selection or rendering behavior.

The camera check imports source modules and therefore runs from a bundle:

```sh
node --input-type=module <<'JS'
import { build } from 'esbuild';
await build({ entryPoints: ['tests/experiments/native-scroll/camera-browser.mts'],
  outfile: 'output/native-scroll/camera-browser.mjs', bundle: true,
  platform: 'node', format: 'esm', packages: 'external' });
JS
CSSEARTH_CHROME_LOG_STDIO=1 node output/native-scroll/camera-browser.mjs chromium
pnpm --filter @cssearth/engine exec tsc -p ../../tools/experiments/native-scroll/tsconfig.json
```

This is a local Saturn experiment, not a production camera replacement. The
input has about 3.4 turns of travel in each direction and two Euler axes, rather
than the enhanced camera's accumulating trackball roll. Reload resets it. The
current preview does not hand its dimensions to the application's JS camera,
publish its pose into a URL, or provide keyboard rotation. Other object bindings
remain to be compiled. Firefox and real mobile hardware are unqualified. WebKit's
native input works, but Saturn renders incorrectly in both this experiment and
its unchanged numeric reference, so WebKit scene rendering is unqualified.

## What the CodePen contributes

[Andrew Fisher's pure CSS mouse tracker](https://codepen.io/Andrew-Fisher-the-decoder/full/GgraMzd)
uses nested hover regions to retarget very long `left`/`top` transitions. Its state
is the current interpolated position. The inspected pen follows hover, continues
after release and still performs style/layout work with a stationary pointer.
It is not a relative drag latch. In the isolated local probe, replacing layout
positioning with transforms broke that feedback and sent the tracker past its
target. A delay could hold a transform on release, but did not fix the tracking.
Those probes are under ignored `output/css-servo-study/`.

The useful result of the exploration is therefore the native resize state above:
the browser already supplies press, capture, movement, release and persistence.
JavaScript can enhance that retained input with unrestricted trackball behavior
and the shared runtime camera when available.

## Isolated input study

The local study at `http://127.0.0.1:4351/` shows a drag area that controls a separate
orientation indicator without application JavaScript. Start it from the repo root:

```sh
node tools/experiments/native-resize/run.mts
```

The browser stores a resize directly in the element's inline `width` and `height`.
Those dimensions survive pointer release. Reload starts again from the authored
values. CSS maps dimensions into yaw and pitch; no script copies pointer positions
into variables.

## Make the entire area draggable

The native resize corner shares the dimensions of custom scrollbars. The study
sets both scrollbars to 900px, making the native corner large enough to cover a
300px visible frame. The underlying box starts 600px above and left of the frame;
its dimensions range from 900px to 1500px. Throughout that range the native corner
covers the frame, so another drag can start anywhere in it.

The origin must remain fixed. Anchoring the box's right/bottom edges produced
correct movement in Chromium but accumulated movement in the tested WebKit build.
The fixed origin removes that moving-coordinate-system problem. Scaling a small
native grip also enlarged its hit area, but quantized input into large steps; that
approach is not used.

This mechanism can cover an existing scene input region, as the Saturn experiment
above demonstrates. The cube isolates input behavior; it does not establish
full-scene rendering or performance.

## Read the dimensions elsewhere with CSS

Two named view timelines observe the resized box: one for X and one for Y.
`timeline-scope` lets an ancestor read both timelines into registered numeric
properties. This keeps the camera outside the resizing element and its clipping.

At zero scroll offset, for this fixed arrangement:

```text
progress = (300 + 600) / (300 + box size)
box size = 900 / progress - 300
```

The CSS converts width and height relative to their authored 1200px starting
values into yaw and pitch. The scrollport itself remains at offset zero. The
browser's native resize operation changes layout, which updates timeline progress.

See the specifications for [native resize](https://drafts.csswg.org/css-ui/#resize)
and [view timelines](https://drafts.csswg.org/scroll-animations-1/#view-timelines).
Chromium's implementation of `CornerRect()` and `Resize()` is in
[PaintLayerScrollableArea](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/paint/paint_layer_scrollable_area.cc).
The enlarged corner relies on browser-specific scrollbar styling, not a standard
CSS property for a resize hit target.

## Local evidence and limits

```sh
CSSEARTH_CHROME_LOG_STDIO=1 node tests/experiments/native-resize/browser.mts
pnpm --filter @cssearth/engine exec tsc -p ../../tools/experiments/native-resize/tsconfig.json
```

The checks exercise five starting positions, one-pixel movement, repeated drags,
release, CSS angle publication and a native drag with touch emulation. A separate
WebKit probe records whether its displacement matches. The trace captures a paced
rotation and writes Chrome's raw trace plus measurements to ignored
`output/playwright/native-resize/`.

The test must omit Playwright's default `--hide-scrollbars` flag: hiding the
scrollbars also removes the enlarged native corner and invalidates this test.
The page itself blocks scripts with CSP and the test disables JavaScript.

The fixed-origin version was checked in Chromium 152 and WebKit 26.4, with a
separate Chromium touch emulation. Real mobile hardware and Firefox remain
unqualified. Travel is bounded; there is no native arrow-key resize interaction
here. Browser reload resets the stored dimensions. The combined wheel zoom and
world-link checks belong to the newer Saturn experiment above.

Native resize still performs style and layout work. The small indicator's trace
cannot establish the performance of a fully integrated cssEarth camera. The
separately captured Saturn JS drag has a different scene and workload; its raw
trace is reference evidence, not a controlled speed comparison.

## Compare input cost and containment

`compare-browser.mts` runs three interleaved trials of the same indicator, drag
path, viewport, DPR, angle mapping and warm-up. The baseline blocks application
scripts. `?input=js` enhances the retained input with pointer events and one CSS
publication per animation frame. `?contain=size` adds size containment to the
resized element; `?contain=strict` also isolates the fixed frame with strict
containment and adds layout/style containment to the resized element.

```sh
CSSEARTH_CHROME_LOG_STDIO=1 node tests/experiments/native-resize/compare-browser.mts
node tools/performance/trace-brief.mts output/playwright/native-resize/matched-input/native-1.json.gz \
  --out output/playwright/native-resize/matched-input/native-1-analysis \
  --framesleuth /path/to/cssGraphics/scripts/frame-sleuth.mjs --url 4351
```

Each run records the browser version, raw trace hash, endpoint dimensions and
angles. Compare layout work separately from presentation intervals: extra layout
does not by itself mean visibly slower animation. The readouts deliberately
remain identical, so both variants include their layout cost. Containment does
not remove the resize operation or the timeline updates in this arrangement.

## Scroll axis locking

[`scroll-axis-lock: none`](https://drafts.csswg.org/css-overflow-5/#scroll-axis-lock)
allows a scroll gesture to retain both axes instead of being constrained to one.
It could improve a future two-dimensional scroll input. It does not provide
left-button mouse dragging or affect the native resize grip, and assigning both
scroll axes to rotation would require deciding how vertical scroll zoom coexists.

[Bramus's browser comparison](https://www.bram.us/2026/08/09/unlock-diagonal-scrolling-with-css-scroll-axis-lock-none/)
reports Chromium 153 support and no Safari/Firefox support. Keep this as an
optional scrolling improvement. The native resize study does not depend on it.

## Measure the sensor on the full Saturn scene

`saturn-browser.mts` substitutes the native sensor at the existing input listener
boundary. The same trackball, shared world camera and full renderer publish
Saturn, rings, sky, materials, labels and depth in every case. The native sensor
transports inline dimensions to the existing input callbacks with a
MutationObserver. Renderer JavaScript remains active: this test isolates sensor
cost on the actual scene, rather than qualifying a finished CSS-only camera.

```sh
CSSEARTH_CHROME_LOG_STDIO=1 node tests/experiments/native-resize/saturn-browser.mts
```

It records three interleaved trials per input, restores the same physical pose
after warm-up, and verifies the retained prepared tree and rotation endpoint.
Before/after screenshots must match the JS reference within the fixture's
declared tolerance. A separate observer records actual scene-transform updates,
because display presentation events alone can include unchanged camera frames.
The sensor uses `opacity: 0`; transparent background declarations alone did not
prevent a native scrollbar corner from painting over the scene. The failed
occluded captures are marked invalid in ignored output.

The test stores its substituted module, adapter and source hashes with raw traces
under `output/playwright/native-resize/saturn-transparent/`. Process each trace
with `node tools/performance/trace-brief.mts`, selecting port 4349, and then run
`node tools/experiments/native-resize/saturn-analysis.mts`. The comparison uses
explicit drag markers and unions main-thread task intervals to avoid counting
nested work twice. CPU sampling is disabled consistently across the comparison.

## A hidden sensor still resizes

Separating an invisible input from a transformed scene can keep the scene's
dimensions fixed. It does not remove the sensor's layout. Chromium's `Resize()`
implementation writes inline width/height and explicitly calls
`UpdateStyleAndLayout(DocumentUpdateReason::kSizeChange)`.

`:has(.resize-sensor)` tests for a matching descendant; it does not read a width.
A declaration such as `--sensor-width: 300` remains constant until something
changes that custom property. The view-timeline bridge above provides an actual
dimension signal. [`will-change`](https://drafts.csswg.org/css-will-change/)
is an optimization hint and cannot force the resize operation to skip layout.
