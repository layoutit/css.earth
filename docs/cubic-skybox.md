# cssEarth cubic skybox

## Purpose and scope

This document explains the cubic skybox that cssEarth uses behind its Sun and
planet scenes. It is written for a reader who does not have access to the
cssEarth repository.

It describes the system that exists in cssEarth. It does not assume anything
about another renderer, scene, camera, galaxy, or migration implementation.

The current contract names the system `cssearth-prepared-cubic-sky@2`. In plain
language, it is:

- one photographed full-sky source prepared into six square images;
- six retained HTML elements arranged as the inside of a cube;
- one rotation matrix applied to their shared parent;
- a small field-of-view response to planet zoom;
- no sky translation, parallax, runtime projection, canvas, WebGL, or SVG;
- a prepared Sun baked into the six images for non-Sun objects; and
- one mount-time choice between 1x and 2x image banks.

The skybox is a directional background. It is not the project’s model of the
Galaxy, a volume of stars, or a navigable spatial map.

## cssEarth in one page

cssEarth is a PolyCSS solar-system viewer. The application mounts exactly one
object scene at a time. An object may be the Sun, a planet, or a future body,
but every implemented object follows the same general contract:

1. Acquire declared sources.
2. Prepare expensive and static facts before the browser runs.
3. Ship checked, reproducible assets and prepared scene data.
4. Mount a stable retained DOM scene.
5. Respond to input by changing transforms, prepared addresses, classes, and
   visibility.
6. Remove the whole object cleanly when navigation selects another object.

The browser may decode and transport prepared state. It must not derive source
data, generate scene geometry, build texture atlases, rasterize imagery, or
reconstruct a large DOM tree on every frame.

The cubic sky follows this rule exactly. All full-sky reprojection, photographic
treatment, contrast preparation, Sun preparation, and asset hashing happen
before runtime.

## The essential mental model

Imagine a camera at the exact center of a very large cube. Each inner wall is a
square photograph of one quarter-turn of the sky. The camera cannot reach a
wall because the cube has no meaningful physical distance. The cube only
answers this question:

> Which sky direction is the camera looking toward?

It does not answer these questions:

- How far away is a star?
- How should the sky move when the observer changes position?
- Where is the selected planet in a Galactic coordinate system?
- What stellar objects should become larger during a spatial zoom?

That distinction gives the skybox its defining runtime rule:

```text
sky orientation follows camera rotation
sky orientation ignores camera translation
```

This is why distant stars do not slide when the foreground planet moves or the
camera position changes. The background behaves as if it were infinitely far
away.

## Scene layers

The simplified visual stack is:

```text
front of screen

  shared controls and information UI
  planet material and body-dependent presentation layers
  retained PolyCSS planet, ring, moon, and atmosphere leaves
  retained cubic skybox
  black stage background

back of screen
```

The cubic skybox is prepended to the object stage. It has `pointer-events: none`
and does not receive input. The same input event updates both the foreground
object camera state and the sky orientation.

## Retained DOM structure

The entire runtime sky is nine elements: one root, one cube-positioning node,
one orientation node, and six face nodes.

```html
<div class="planet-cubic-sky" aria-hidden="true">
  <div class="planet-cubic-sky-cube">
    <div class="planet-cubic-sky-orientation">
      <div class="planet-cubic-sky-face planet-cubic-sky-front"></div>
      <div class="planet-cubic-sky-face planet-cubic-sky-right"></div>
      <div class="planet-cubic-sky-face planet-cubic-sky-back"></div>
      <div class="planet-cubic-sky-face planet-cubic-sky-left"></div>
      <div class="planet-cubic-sky-face planet-cubic-sky-top"></div>
      <div class="planet-cubic-sky-face planet-cubic-sky-bottom"></div>
    </div>
  </div>
</div>
```

The object id also produces object-specific class names. For Saturn, for
example, the root also has `saturn-skybox`, the orientation node has
`saturn-skybox-orientation`, and each face has a corresponding Saturn class.
The generic classes own the shared geometry. Object-specific classes are hooks,
not separate skybox implementations.

The six face elements are created once. Camera drag, wheel zoom, contrast
changes, pause, and resume do not replace them.

## Cube face order and directions

The prepared plan always stores faces in this order:

```text
front, right, back, left, top, bottom
```

The cssEarth cube-local axes use CSS 3D coordinates:

- positive X points right;
- positive Y points down;
- negative Z points toward the front face seen from the center;
- positive Z points toward the back face.

The center direction of each face is therefore:

| Face | Cube-local direction | Plane location |
| --- | ---: | --- |
| `front` | `(0, 0, -1)` | `z = -H` |
| `right` | `(+1, 0, 0)` | `x = +H` |
| `back` | `(0, 0, +1)` | `z = +H` |
| `left` | `(-1, 0, 0)` | `x = -H` |
| `top` | `(0, -1, 0)` | `y = -H` |
| `bottom` | `(0, +1, 0)` | `y = +H` |

`H` means the cube half-side in CSS pixels.

A useful cube net is:

```text
                    +-------------------+
                    |        top        |
                    |      y = -H       |
                    +-------------------+

+-------------------+-------------------+-------------------+-------------------+
|       left        |       front       |       right       |       back        |
|      x = -H       |      z = -H       |      x = +H       |      z = +H       |
+-------------------+-------------------+-------------------+-------------------+

                    +-------------------+
                    |      bottom       |
                    |      y = +H       |
                    +-------------------+
```

The net is a naming aid. It does not specify image flips by itself. The image
projection step owns the exact pixel orientation on each face.

## Direction-to-face projection

Preparation converts a unit direction `(x, y, z)` into a face and local face
coordinates `(u, v)`. It first finds the axis with the largest absolute value.
That major axis selects the face.

```text
major axis Z:
  z < 0  -> front,  u =  x / -z, v =  y / -z
  z > 0  -> back,   u = -x /  z, v =  y /  z

major axis X:
  x > 0  -> right,  u =  z /  x, v =  y /  x
  x < 0  -> left,   u = -z / -x, v =  y / -x

major axis Y:
  y < 0  -> top,    u =  x / -y, v = -z / -y
  y > 0  -> bottom, u =  x /  y, v =  z /  y
```

The resulting `u` and `v` values are in approximately `[-1, +1]`. They map to
pixel coordinates on the selected square face.

This formula is also the authoritative way to place a prepared directional
feature, such as the Sun, into the cube. Names such as “front” and “top” are not
enough to reproduce the pixel orientation safely.

## How the six CSS planes form the cube

The shared CSS uses a zero-sized origin at the center of the stage. Each face
is a square with side length `2H`. Its top-left corner begins at `(-H, -H)` so
its center lies on the origin before the face transform is applied.

The logical transforms are:

```css
.front  { transform: translateZ(-H) scale(1.002); }
.right  { transform: translateX(+H) rotateY(-90deg) scale(1.002); }
.back   { transform: translateZ(+H) rotateY(180deg) scale(1.002); }
.left   { transform: translateX(-H) rotateY(+90deg) scale(1.002); }
.top    { transform: translateY(-H) rotateX(-90deg) scale(1.002); }
.bottom { transform: translateY(+H) rotateX(+90deg) scale(1.002); }
```

The actual CSS writes `H` through a custom property:

```css
--planet-cubic-sky-half-side: max(100cqw, 100cqh);
```

The cube is therefore large enough to cover the larger container dimension.
The object stage establishes a size container, so `cqw` and `cqh` refer to that
stage rather than to the whole browser window. The cube is not sized in world
units and has no relation to a planet’s radius.

Every face is enlarged by `1.002`, or 0.2 percent. This deliberate overlap
covers subpixel cracks that can appear where independent CSS planes meet. It
is a presentation repair, not a change to the source projection.

## Perspective and camera placement

The sky root establishes CSS perspective. Its current perspective distance is:

```text
D = max(50 cqh, 86.60254 cqh * skyZoom)
```

The cube-positioning node then moves forward by the same distance:

```css
transform: translateZ(D);
```

This places the visual center of the cube at the effective camera origin while
the root clips everything to the object stage.

The value `86.60254` is the prepared canonical focal relationship used by the
presentation. It is approximately `50 * sqrt(3)`. cssEarth treats it as a
presentation constant. It is not a measured astronomical quantity.

## Source imagery

The visible sky originates from the ESO `eso0932a` all-sky panorama credited to
ESO/S. Brunier. The source image expected by the current preparation contract
is:

```text
6000 x 3000 RGB pixels
```

The prepared plan records the photograph as CC BY 4.0.

The project also stores a HYG Stellar Database v4.1 subset. Its role is
coordinate-registration audit. It does not own the visible star pixels. The
photograph owns the visible Milky Way, star detail, color, and diffuse light.

This division matters:

```text
ESO photograph -> visible sky
HYG data        -> coordinate-registration evidence
```

cssEarth is not drawing HYG stars as runtime points.

## Prepared photographic treatment

The source panorama does not go directly into the browser. Preparation first
creates a wrapped diffuse version of the panorama, then recombines diffuse and
detail information before sampling each cube face.

The current photographic-separation constants are:

| Setting | Value |
| --- | ---: |
| Wrapped Gaussian sigma | `9` source pixels |
| Diffuse gain | `0.85` |
| Detail gain | `0.65` |

The current photographic level treatment is:

| Setting | Value |
| --- | ---: |
| Black point | `8` |
| Gamma | `1.2` |
| Gain | `0.6` |

The source is sampled with wrapped horizontal coordinates because the left and
right edges of the full-sky panorama meet. Sampling must not introduce a seam
at that wrap boundary.

Before sampling the panorama, cube-local directions receive a prepared
registration rotation:

| Axis | Degrees |
| --- | ---: |
| X | `-35.5` |
| Y | `158.5` |
| Z | `-123` |

The recorded rotation order is Z after Y after X in cube-local direction
space. The result is then transformed through the equatorial-to-Galactic basis
used by the preparer and mapped into the equirectangular photograph.

The sky orientation is registered to Galactic coordinates. However, cssEarth
does not claim a specific observer location, observation time, inertial camera
epoch, or body ephemeris for this presentation. “Registered” must not be
reported as “ephemeris-correct.”

## Two visual presentations

Each face has two prepared visual treatments.

### Standard

The default is quieter so the selected planet remains the visual subject. It
applies prepared luminance compression and desaturation:

| Setting | Value |
| --- | ---: |
| Saturation | `0.42` |
| Luminance gamma | `1.1` |
| Gain | `0.7` |

### High contrast

The high-contrast bank retains the stronger photographic treatment before the
standard compression and desaturation pass.

The browser does not process pixels when the user changes contrast. Each face
already contains both URLs as CSS custom properties:

```css
--planet-cubic-sky-standard-image: url("...");
--planet-cubic-sky-high-contrast-image: url("...");
```

The shared shell changes one body attribute:

```css
body[data-sky-contrast="high"] .planet-cubic-sky-face {
  background-image: var(--planet-cubic-sky-high-contrast-image);
}
```

The face elements and cube orientation do not change.

## DPR banks

Every face and contrast mode is prepared at two image densities:

```text
1x face: 1024 x 1024
2x face: 2048 x 2048
```

For a normal planet with a baked external Sun, one prepared sky therefore
contains:

```text
6 faces * 2 contrast modes * 2 densities = 24 WebP files
```

The browser chooses density 1 or 2 once when the object mounts. It does not
switch DPR banks after the scene is mounted. The current selection threshold is
1.5: a device pixel ratio below 1.5 selects the 1x bank, and a ratio of 1.5 or
more selects the 2x bank. Both contrast banks for the chosen density are decoded
before the object declares itself ready, so the contrast control does not
introduce a first-use decode hitch.

## The prepared Sun

For planet views, the external Sun is not a separate DOM billboard. It is
prepared directly into the starfield faces.

This choice has four consequences:

1. The Sun cannot drift away from the sky orientation.
2. It cannot expose a rectangular billboard edge.
3. It crosses cube edges correctly because preparation evaluates its direction
   over all six faces.
4. The browser performs no Sun rasterization or face selection.

The current Sun preparation starts from a `128 x 128` logical source. It uses a
3-pixel median pass to reduce source spikes, a source black point of `55`, and a
levels gamma of `1.2`. Its prepared presentation size is `214 x 214` at the
canonical focal relationship. The core and outer light receive different
gains so the central disc remains legible without turning the entire corona
into a bright square.

The prepared local direction is approximately:

```text
(-0.6119166247, +0.4122847501, -0.6749661689)
```

That direction lies on the front face near its left edge in the current
presentation. The preparer projects every face pixel into a direction, projects
that direction onto a tangent plane around the Sun direction, samples the Sun
image bilinearly, and composites it with a screen-style lightening operation.

The Sun is presentation-derived. It is not claimed to be an ephemeris-derived
Sun position for a specified planet, place, or time.

The self-luminous Sun object is the exception. Its sky preparation intentionally
does not bake a second external Sun into the cube.

The current source record for the baked Sun includes a local visual-oracle
qualification. That record does not establish broad redistribution rights for
the oracle bytes. Provenance and redistribution qualification must stay with
the prepared source record.

## Camera state

The shared cubic-sky orbit uses an accumulated `matrix3d` camera model. Its
public camera state contains at least:

```text
controlPitch
controlYaw
zoom
```

Pitch and yaw are intentionally unbounded. The implementation accumulates
matrix rotations from input deltas instead of repeatedly rebuilding orientation
from bounded Euler angles. This avoids a hard stop when a user keeps dragging
through a pole and avoids replacing the retained scene.

The foreground object and sky do not use the same matrix. They receive the same
input but apply different prepared response rules.

## Foreground scene pitch mapping

The shared camera plan converts control pitch into a prepared scene pitch:

```text
progress =
  (controlPitch - defaultControlPitch)
  / (maximumControlPitch - defaultControlPitch)

renderedScenePitch = initialScenePitch * (1 - progress)
```

This mapping belongs to the foreground presentation and prepared material
banks. The cubic sky consumes the resulting rendered pitch delta; it does not
recompute planet geometry or lighting.

## Sky orientation matrix

On a complete camera-state reset, the sky pitch is:

```text
skyPitch = initialScenePitch
  + cameraPitchResponse * (renderedScenePitch - initialScenePitch)
```

The current response is:

```text
cameraPitchResponse = -1.7
```

The initial sky orientation then includes two presentation offsets:

```text
presentationPitchOffset = -20 degrees
presentationYawOffset   = +66 degrees
```

Conceptually, the reset matrix is built as:

```text
Y rotation by -controlYaw
  * X rotation by (skyPitch + presentationPitchOffset)
  * Z rotation by presentationYawOffset
```

The exact multiplication order matters. Matrix multiplication is not
commutative; changing the order changes the visible sky.

For an input delta, the shared orbit accumulates:

```text
sky pitch delta = rendered scene pitch delta * -1.7
sky yaw delta   = -control yaw delta
```

The negative yaw is camera counter-rotation. When the camera turns right, the
environment must appear to move left across the viewport.

The `-1.7` pitch response is a cssEarth presentation calibration. It is not a
universal cubemap rule and not an astronomical constant.

## Zoom response

Planet zoom and sky zoom are deliberately different.

The foreground object uses the camera plan’s full zoom ratio. The sky changes
its field of view only slightly:

```text
relativePlanetZoom = zoom / defaultZoom

skyZoom = 1 + 0.12 * (relativePlanetZoom - 1)
```

Examples:

| Planet zoom relative to default | Sky zoom |
| ---: | ---: |
| `0.5` | `0.94` |
| `1.0` | `1.00` |
| `2.0` | `1.12` |
| `4.0` | `1.36` |

This response gives the background a small field-of-view change without making
it behave like nearby geometry. The sky does not move closer to the observer.
It remains translation-free.

## Event-driven runtime publication

The sky has no independent animation loop. It publishes a new matrix when one
of these events requires it:

- drag changes pitch or yaw;
- wheel or pinch changes zoom;
- responsive layout recalculates the prepared fit;
- code restores or sets a camera state; or
- an object-specific prepared layer requests a camera refresh.

One publication performs a bounded set of writes:

1. Write the foreground scene matrix.
2. Write the sky orientation matrix.
3. Write the sky zoom custom property.
4. Write the foreground camera scale.
5. Publish the transformed Sun direction to prepared lighting consumers.

It does not create faces, sample source images, project stars, draw pixels, or
discover geometry.

## Sun direction and foreground lighting

Although the Sun is baked into the sky pixels, its prepared unit direction is
also stored as data. Runtime transforms that direction by the same sky
orientation matrix.

The transformed direction provides two useful facts:

```text
sunViewDirection = normalized transformed local Sun direction
sunVisible        = sunViewDirection.z < 0
```

Planet packages can use the direction to address prepared terminator, phase,
or lighting banks. The direction keeps the visible Sun and prepared foreground
lighting in the same presentation frame.

The runtime still does not calculate fresh illumination pixels. It selects or
addresses already prepared presentation state.

## Responsive behavior

Responsive fitting belongs to the object camera, not to a second mobile
skybox. The same six sky faces remain mounted at all viewport sizes.

The shared fit model uses the stage aspect ratio, the object’s prepared logical
diameter, the shell scale, maximum height share, and mobile preview limits to
select a bounded zoom. The sky then receives only the small `0.12` response to
that selected object zoom.

The cube half-side uses container query units, so it continues to cover a tall,
wide, or square stage without rebuilding the cube.

## Lifecycle

The relevant lifecycle is:

```text
acquire sources
    -> prepare and hash all sky assets
    -> load object route
    -> choose DPR bank once
    -> decode selected-density standard and high-contrast faces
    -> mount one retained object scene
    -> create six sky faces once
    -> publish initial camera and sky matrices
    -> respond to input with bounded style writes
    -> destroy controls
    -> remove the sky root
    -> release the object scene
```

Pause and resume do not destroy the sky. They affect actual scene animations.
The sky remains a static prepared image set whose orientation changes only when
camera state changes.

## Prepared data contract

A simplified prepared plan looks like this:

```js
{
  schema: "cssearth-prepared-cubic-sky@2",
  standard: "cssearth-cubic-sky-standard@2",
  model: "prepared-photographic-full-sky-retained-css-cubemap",

  source: "ESO eso0932a all-sky panorama",
  sourceCredit: "ESO/S. Brunier",
  sourceLicense: "CC-BY-4.0",
  sourceMapSize: [6000, 3000],

  faceSize: 1024,
  faceSize2x: 2048,
  faces: [
    {
      id: "front",
      url: "/scenes/<object>/<object>-starfield-front-standard.webp",
      url2x: "/scenes/<object>/<object>-starfield-front-standard@2x.webp",
      highContrastUrl: "/scenes/<object>/<object>-starfield-front.webp",
      highContrastUrl2x: "/scenes/<object>/<object>-starfield-front@2x.webp"
    }
    // right, back, left, top, bottom follow in that exact order
  ],

  cameraPitchResponse: -1.7,
  cameraZoomResponse: 0.12,
  presentationPitchOffsetDegrees: -20,
  presentationYawOffsetDegrees: 66,

  orientation: "camera-rotation-only-no-translation-or-parallax",
  runtimeRasterization: false,

  sun: {
    bakedIntoStarfield: true,
    billboard: false,
    localDirection: [/* normalized x, y, z */],
    initialViewDirection: [/* normalized x, y, z */],
    runtimeRasterization: false
  },

  hashes: {
    "<file name>": {
      bytes: 123456,
      sha256: "<64 lowercase hexadecimal characters>"
    }
  }
}
```

The Sun object uses the same six-face sky contract with the external `sun`
entry omitted.

## Validation at mount

The shared validator rejects a plan unless all of these conditions hold:

- the plan and standard schema ids match;
- runtime rasterization is explicitly false;
- the orientation contract explicitly says rotation only, with no translation
  or parallax;
- there are exactly six faces in the required order;
- all four URLs exist as strings for every face;
- pitch, zoom, and presentation offsets are finite numbers;
- a required Sun uses the expected prepared-Sun schema;
- the Sun is baked into the starfield rather than represented as a billboard;
- the Sun does not require runtime rasterization; and
- stored Sun directions are normalized finite three-component vectors.

This fail-closed behavior is intentional. A missing face or an incompatible
prepared bank is an invalid object package, not permission to fabricate a
fallback sky.

## Browser-level invariants

The shared browser conformance checks the rendered system, not only declarations.
The important cubic-sky assertions are:

- exactly six face elements are retained;
- the default face background resolves to the standard asset;
- the contrast control switches to the high-contrast asset;
- toggling contrast does not change the face count;
- the object reaches ready without browser or console errors;
- DOM identity stays stable through interaction;
- navigation leaves one mounted object and one stage; and
- real Chrome proves the object at DPR 1 and DPR 2.

Object readiness also requires the repository’s complete gate sequence:

```sh
pnpm acquire:planets -- --verify-only
pnpm test
pnpm build
pnpm test:browser
```

A passing unit test alone does not prove that the cube is visually seamless,
correctly oriented, decoded at the selected DPR, or stable in a real browser.

## What is prepared and what remains live

| Concern | Prepared before runtime | Live at runtime |
| --- | --- | --- |
| Full-sky source decode | Yes | No |
| Equirectangular-to-cube projection | Yes | No |
| Face pixel orientation | Yes | No |
| Diffuse/detail treatment | Yes | No |
| Standard/high-contrast treatment | Yes | No |
| 1x/2x images | Yes | No |
| Sun pixel treatment and face compositing | Yes | No |
| Asset hashes and provenance | Yes | Validation only |
| Six face elements | No | Created once at mount |
| DPR choice | Two banks prepared | One bank selected once |
| Contrast choice | Both banks prepared | CSS image address switches |
| Sky orientation | Constants prepared | One matrix changes on input |
| Sky field-of-view response | Formula constant prepared | One scalar changes on zoom |
| Star generation | Not part of the model | Never |
| Pixel drawing | All pixels already exist | Never |
| Camera translation/parallax | Not supported | Never |

## What this system is not

The cubic skybox must not be described as any of the following:

- a 3D stellar catalogue;
- a macro view of the Milky Way;
- a physically located cube around a planet;
- a sphere with meaningful radius;
- an ephemeris simulation;
- a renderer-generated procedural starfield;
- a runtime equirectangular projection;
- a canvas, WebGL, or SVG scene;
- six images rebuilt during camera movement;
- a sky that follows camera position; or
- a proof of spatial continuity between the planet viewer and another scene.

It is a retained CSS cubemap built from prepared photographic assets.

## Why use a cube instead of one flat background

A flat background image only matches one viewing direction. Rotating it in two
dimensions cannot reproduce looking above, below, or behind the initial view.
It stretches near the poles and cannot provide a continuous 360-degree camera
orientation.

Six perspective-correct faces let the view rotate through every direction while
keeping runtime work small. The cube also maps naturally to six retained DOM
planes. cssEarth gets full directional coverage without a canvas renderer or a
runtime spherical projection.

## Why use six prepared images instead of many star elements

The visible source is photographic. Replacing it with star points would lose
the Milky Way’s diffuse light, dust lanes, color structure, dense unresolved
fields, and photographic character.

A DOM star catalogue would also introduce many retained leaves without solving
the diffuse-image problem. cssEarth therefore uses the photograph for visible
sky and keeps HYG data as registration evidence.

## Why the cube does not translate

If the sky cube translated with a foreground camera position, its walls would
show parallax and reveal a finite scale. Stars would appear to slide relative
to the planet when the observer moves. That is wrong for a visual background
whose sources are effectively at infinite distance at planet-view scale.

The orientation contract makes the rule machine-checkable:

```text
camera-rotation-only-no-translation-or-parallax
```

## Why the Sun is baked into the sky

A separate Sun billboard would need its own camera-facing transform, edge
handling, visibility rules, scaling rules, and synchronization with the cube.
It could also disagree with the prepared light direction.

Baking the Sun into directional cubemap space solves those problems during
preparation. Runtime only transports the same direction through the sky matrix
for lighting-bank selection.

The tradeoff is equally important: the baked Sun cannot become independent
nearby geometry. That is acceptable because the cubic sky is only a directional
background.

## Common failure modes

### A face is mirrored or rotated

Cause: face filenames were assigned by intuition instead of using the canonical
direction formulas.

Proof: place unique axis markers and edge labels into a diagnostic source,
prepare all six faces, and verify every shared edge in the mounted cube.

### A bright seam appears between faces

Possible causes:

- the source sampler did not wrap the panorama horizontally;
- neighboring face directions disagree at their shared edge;
- image orientation is wrong on one face;
- browser subpixel rasterization exposes the plane boundary; or
- the 1.002 overlap was removed.

The overlap only repairs the last cause. It cannot repair incorrect projection.

### The stars move in the same direction as the drag

Cause: the sky used camera rotation instead of camera counter-rotation. Yaw must
use the opposite sign from the control delta.

### The background feels attached to the planet

Cause: the foreground object matrix was reused directly for the sky. The sky
needs its own prepared pitch response, yaw sign, presentation offsets, and no
translation.

### Zoom makes the sky rush toward the viewer

Cause: full planet zoom was applied to the sky. cssEarth uses only 12 percent of
the relative zoom change.

### Contrast toggling flashes or changes the DOM

Cause: the alternate bank was not decoded before ready, or faces were replaced
instead of changing their prepared background address.

### The visible Sun and planet terminator disagree

Cause: foreground lighting was addressed from unrelated camera state instead of
the transformed prepared Sun direction.

### A unit test passes but the cube looks wrong

Cause: structural validation does not prove face-edge continuity, orientation,
or browser rasterization. The system still needs a real-browser visual check at
both DPRs.

## Minimum faithful reproduction checklist

A faithful implementation of the cssEarth system must preserve all of these
properties:

- [ ] Six square faces in `front, right, back, left, top, bottom` order.
- [ ] Canonical face directions and per-pixel projection.
- [ ] A wrapped full-sky source sampler.
- [ ] Prepared 1024 and 2048 pixel face banks.
- [ ] Prepared standard and high-contrast banks.
- [ ] One mount-time DPR selection.
- [ ] One stable root, cube, orientation, and six stable face elements.
- [ ] `transform-style: preserve-3d` on the cube and orientation nodes.
- [ ] A centered zero-sized 3D origin.
- [ ] Container-relative cube coverage.
- [ ] A small face overlap for browser seam coverage.
- [ ] One orientation matrix on the common parent.
- [ ] Camera counter-rotation for yaw.
- [ ] The prepared pitch response and presentation offsets.
- [ ] The 0.12 sky zoom response instead of full object zoom.
- [ ] No translation or parallax.
- [ ] No runtime source parsing, star generation, projection, or rasterization.
- [ ] A baked Sun for planet views and no second Sun in the Sun view.
- [ ] A normalized prepared Sun direction transported by the same sky matrix.
- [ ] Explicit provenance, hashes, and qualification in the prepared plan.
- [ ] Face-count, contrast, stable-DOM, lifecycle, and real-browser DPR proof.

## Short implementation narrative

If the whole system must be explained verbally, use this version:

> cssEarth starts with one licensed 6000-by-3000 photographic map of the whole
> sky. A preparation tool converts every viewing direction into Galactic and
> source-image coordinates, samples the photograph, and writes six lossless
> WebP cube faces. It writes each face at 1x and 2x and in standard and
> high-contrast forms. For planet views it also projects and bakes the visible
> Sun into those face pixels. The browser chooses one DPR bank, decodes both
> contrast forms, and mounts six permanent divs as the inside of a CSS 3D cube.
> Camera input changes one shared matrix on the six-face parent. Yaw is
> counter-rotated, pitch has a calibrated response, and zoom changes the sky’s
> field of view only slightly. Camera translation never reaches the cube, so
> there is no parallax. The browser never generates stars or draws pixels.

## Repository reading map

When repository access becomes available, these files are the authoritative
reading path:

| File | Responsibility |
| --- | --- |
| `src/platform/cubic-sky-contract.mjs` | Schemas, constants, face order, direction projection, Sun direction, plan validation |
| `src/platform/cubic-sky-preparation.mjs` | Standard presentation pixels and prepared Sun compositing |
| `src/platform/prepare-cubic-sky-source.mjs` | Source validation, photographic reprojection, asset generation, hashes, prepared module output |
| `src/platform/cubic-sky-runtime.mjs` | Retained mount, orientation matrices, zoom response, orbit publication, lifecycle |
| `site/planet-shell.css` | Shared cube geometry, perspective, face transforms, contrast switch |
| `site/runtime-policy.mjs` | Mount-time DPR choice and shared responsive input policy |
| `src/planets/<id>/tools/prepare-starfield.mjs` | Object entry point into shared sky preparation |
| `src/planets/<id>/runtime/preparedStarfield.mjs` | Generated object-specific plan where it is emitted separately |
| `src/planets/<id>/runtime/client.mjs` | Decode, mount, camera publication, and object lifecycle integration |
| `src/platform/cubic-sky-contract.test.mjs` | Contract and direction validation |
| `src/platform/cubic-sky-preparation.test.mjs` | Pixel-treatment validation |
| `site/test/smoke-browser.mjs` | Real-browser face, contrast, lifecycle, and retained-DOM checks |

Some object packages embed the prepared sky plan inside a larger generated
scene module instead of keeping it in a separate `preparedStarfield.mjs`. The
shared contract is the same.

## Final boundary

The cleanest single sentence is:

> cssEarth’s cubic skybox is a prepared photographic direction field rendered
> as six stable CSS planes, rotated but never translated at runtime.

Everything else in the design follows from that boundary.
