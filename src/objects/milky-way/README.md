# Milky Way preparation

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

```text
milky-way/
├── object.json                 Physical frame, source pin, prepared digest
├── source/
│   ├── density.ktx2            Lossless 1024 × 1024 × 128 OpenSpace RGBA grid
│   ├── acquisition.json        Original raw URL/hash and exact reduction recipe
│   ├── volume.json             Channels, material, sampling and crop recipe
│   ├── provenance.json         Authors, transfer equations, frame and source pins
│   ├── color-calibration.json  NASA palette fit, held-out metrics and limitations
│   ├── openspace/              Original MIT notice, asset, shader and sync listing
│   └── sky/                    NASA source, lossless HDR row chunks and cube recipe
└── prepared/
    ├── volume.json             Prepared object envelope with PolyCSS leaves
    ├── volume-slices.json      Physical quad and texture intermediates
    ├── core/slices/{x,y,z}/*.png  Generated, ignored 62 / 63 / 26 bulge textures
    ├── outer-disc.png          One 1024px image in the physical Galactic midplane
    ├── sky/{px,nx,py,ny,pz,nz}.webp  Generated, ignored six celestial cube faces
    └── sky-near/{px,nx,py,ny,pz,nz}.webp  Committed: the same faces with the neighbourhood stars baked in
```

App startup restores missing images from the pinned sources via `pnpm prepare:environment-images`, preserving the accepted metadata. See the [shared bake commands](../../../labs/nebula/docs/baking.md).

From the repository root, with Node 24 (or 22.18+) and pnpm 10.33.0:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:tools
pnpm prepare:volume src/objects/milky-way
node tools/objects/dist/prepare-stars.js src/objects/stellar-neighbourhood
node tools/objects/dist/prepare-shell.js src/objects/heliosphere
pnpm prepare:world-context
pnpm test:preparation --universe
```

This builds preparation tools, reproduces the Milky Way assets and the Sun's
world context, and checks the available preparation cases for prepared resource closure, physical
orbit alignment, and PolyCSS pixel-to-world mapping. The normal
`pnpm test:preparation` also includes these tests. To prepare another compatible
volume after building tools, use `pnpm prepare:volume <object-directory>`.
Preparation reads the local pinned inputs; no sibling checkout or network
source is required. The checked volume source is 41.77 MiB. Preparation first integrates the original 256 / 256 / 32 slabs at 1024px,
then keeps only the central volume and composites the outer Z slabs onto one
fixed image plane. The detailed bank is 10.41 MiB compressed and 15.54 MiB
decoded: 151 bulge slabs plus one arm image. Bulge textures keep the original
slice pitch and decoded RGB; lossless PNG avoids another lossy encoding pass.
Four samples per original Z slab integrate all 128 source Z layers.

The [OpenSpace Milky Way volume](https://docs.openspaceproject.com/latest/content/milky-way/galaxy/milky-way-volume/index.html)
adapts a NAOJ simulation prepared by Jon Parker for AMNH's *Dark Universe*,
with Emil Axelsson, Carter Emmart and the OpenSpace Team. Its official asset
and documentation declare MIT; the original notice is preserved here.
It is a scientific simulation adapted for visualization, not a measured map
of the exact shape of our galaxy.

RGB channels emit independently after squaring filtered UNORM values; alpha
is dust, decoded with exponent 1.4. The recipe preserves emission 250,
absorption 200, extinction tint [0.3, 0.54, 0.85], cylindrical support and the
source's channel transfer. The source already contains its bulge. The 8 kpc
Galactic centre, authored Euler rotation and full physical
extent are converted to the shared Sun-centred ICRF frame.

The arm billboard uses those same prepared OpenSpace slab pixels, not the NASA
interior panorama. Its corners span the original model XY bounds, [-10, 10]
units in each direction, at local Z=0; it shares the volume's physical frame,
centre, rotation and 6e19 metres per unit. It remains fixed in the Galactic
plane while the shared camera moves.

The display split keeps full volumetric support inside 1.25 model units and
smoothly reduces it to zero at 2.5 units. These radii are presentation choices,
not measured bulge boundaries. Each original slab's alpha is divided through
complementary optical-depth weights; the decoded RGB stays unchanged. The
outer Z contribution is composited in its original order into the flat image.
This removes outer-disc thickness and vertical parallax, and does not retain
its depth ordering with the bulge. The original whole-galaxy distant impostors
remain the far-view presentation. No source emission, dust model, colour grade,
physical bounds or placement is changed.

The 512 MiB unmodified upstream raw file stays outside Git. To reacquire it
and verify/recreate the checked derivative from a clean checkout:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:tools
pnpm prepare:volume src/objects/milky-way --acquire-source .local/volume-source-cache
```

This reacquires both original sources and needs about 1.3 GiB temporary space. The pinned HTTPS source, raw SHA256,
X-fastest RGBA order, factor-one lossless import and Zstd level are
recorded in `source/acquisition.json`; the exact Node/Zstd versions are in
`source/provenance.json`. The import rejects any raw or derivative mismatch.
Normal preparation uses the checked derivative without downloading.

The working CSS display convention integrates a common physical path
metric on every axis. The display gain is calibrated to 16 after slab
integration: three stops below the previous 128 baseline, which was too bright
with the OpenSpace emission model. These are renderer approximation choices, separate from OpenSpace's authored
emission/absorption coefficients. OpenSpace integrates normalized texture
distance and uses an additive raymarch display; baking that direction-dependent
coefficient into separate CSS stacks causes brightness changes at handoffs.

A single offline display-RGB matrix, `diag(1, 0.951277424, 0.709752511)`,
grades every slab toward the original NASA interior palette. It follows the
exponential display transfer and preserves the original emission/dust alpha,
so it changes colour without changing geometry, opacity or optical correction.
The same matrix applies from every viewing direction. Source emission and
absorption coefficients remain unchanged.

The calibration compares matching ICRF directions at the Sun, using paired
patches within 15° of the Galactic plane and held-out longitude blocks. The
selected grade reduces held-out chromaticity error by 53.8% while retaining
colour variation. The checked calibration receipt records its baseline inputs,
method and limitations; the matrix in the recipe reproduces the final bake.
The NASA image and simulated volume have different dust structures, so this
matches their palette, not their exact morphology or physical photometry.

Ordinary-alpha slices approximate RGB extinction and emitted energy. They
retain finite-slice/axis-handoff artifacts and do not reproduce OpenSpace's
additive HDR raymarching, stochastic sampling or camera-dependent fade.
The renderer transports the prepared images and geometry. Background stars are
baked into the sky cube from the independently prepared star catalogue.

The NASA map is an angular observation from the Sun, not a texture that remains
correct after interstellar travel. It stays opaque nearby, starts retiring at
100 AU, and is absent by 0.1 pc. The independently graded volume begins its
separate entrance at 100 pc and reaches full opacity at 5 kpc; its display gain
is 0.094 through 1 kpc, rising to one at 25 kpc. The intervening black backdrop
is intentional: reusing the Solar sky there would assert a viewpoint the source
does not provide. This is display presentation, not photometric calibration;
slab transfer, optical correction, and labels retain their separate behavior.

Each retained slab has three coincident CSS image elements sharing one texture.
Their optical contribution compensates for oblique viewing before isolated axis
images are mixed. Integer optical gains are exact; fractional gains approximate
the continuous transfer without extra image resources. The 151 bulge slabs
use 453 image elements; the arms use one more, compared with the original
1,632-element full volume. This is an element count, not a measured frame-rate
result. Keeping the axis scenes separate avoids
browser cracks and expensive sorting at intersections between planes.

The near-Solar-System sky uses NASA's [Deep Star Maps 2020 Milky Way-only
celestial map](https://svs.gsfc.nasa.gov/4851/). Its linear RGB HALF source is
8192 × 4096 in ICRF/J2000: RA increases left, the image centre is RA 0h and
north is at the top. The full HDR source is preserved bit for bit in two
Zstd row chunks, 117.15 MiB total; neither Git blob exceeds 100 MiB. The
original 130.95 MiB EXR stays in the acquisition cache. Source acquisition,
original and decoded SHA256, exact Node/Zstd versions, NASA/Gaia credits and
usage notice live together under `source/sky/`.

Six opaque 1536 × 1536 WebP faces add **0.30 MiB download and 54 MiB decoded**,
and the near set below adds **0.44 MiB download and 54 MiB decoded**. The complete
sky contribution is unchanged by the exterior billboard. The exterior bank
figures above exclude these sky faces and the unchanged distant impostors. Sky faces use quality 90. Original source chunks are offline
inputs and are never sent to the browser.

The offline baker samples linear RGB before applying a fixed exposure of 4.5
and the standard sRGB display curve. Before final attenuation, the transfer at
1024 × 512 matches NASA's preview mean RGB within 0.001 and has RGB RMSE
0.01387 on the [0,1] scale. A final uniform display gain of 0.12 darkens all
three sRGB channels before quantization without changing source white balance.
A shared smooth shadow factor suppresses faint image grain: zero below
transferred display luminance 0.04 and full contribution above 0.12. This
intentionally removes faint background detail while retaining the separately
baked catalogue stars. Alpha stays opaque and source HDR pixels stay unchanged. This is a display fit, not calibrated photometry.
The NASA Milky Way-only image omits bright Hipparcos/Tycho stars, so the
prepared bright stars are composited into the baked faces.
Faint Gaia stars remain in the image; it is not literally star-free.

## Neighbourhood stars in the near faces

`source/sky/recipe.json` pins the sibling `stellar-neighbourhood` object by its
descriptor digest and one authored screen scale, 43.6 CSS pixels per degree. The
baker composites that prepared point field, seen from its own origin, onto a copy
of each face: about 17,500 sprites in total, drawn with the same atlas tile,
photometry table and source-over blend the browser uses, supersampled three times
per axis. The result is `prepared/sky-near/`, a second complete cube.

The runtime mounts the two six-face cubes. The baked-star cube gives way to the
plain NASA cube while the complete Solar sky fades from 100 AU to 0.1 pc. There
is no handoff to individual DOM stars, star-slot pool, catalogue-selection
worker, or per-star frame transport. The catalogue stays as a preparation input;
the application reads only its small appearance manifest and atlas for the Sun's
single navigation marker, without fetching or decoding the binary star bank.

Individual stellar parallax is not rendered when travelling through the
neighbourhood. Instead of retaining a misplaced Solar panorama, the complete
cube retires before the observer reaches another stellar location.

The baked faces are 1536 px across, so a star's disc is about three times softer
than the browser's own sprite at device pixel ratio 2, and the sprite radius is
fixed at the authored screen scale instead of following the viewport. This is a
deliberate visual difference, not a reproduction of the DOM starfield.

The cube's authored bases are ICRF directions, independent of the volume's
Galactic local frame. Its six prepared PolyCSS planes form one closed shell
with a 20 kpc half-extent, centered on the Sun. At the Sun it reproduces the
original angular projection. Shared camera translation produces a small prepared
motion during the nearby fade; there is no separate camera or screen-fixed
background. The fade completes at 0.1 pc, long before the observer can approach
a cube face. The images, geometry and decoded bank remain unchanged.

The shell depth is an authored visual approximation: NASA supplies angular
radiance, not measured cloud depths. It does not align the two sources' different
dust structures or reproduce physical disocclusion. It avoids copying cloud
features across independent depth layers. Neither geometry nor imagery is
generated in the browser. The NASA source epoch stays in provenance; shared
camera metadata uses the volume's Sun-centered ICRF frame and epoch.

## Billboard UI evidence

The [inspected browser capture](evidence/2026-09-23/billboard-and-labels.png) shows
the fixed arm image, volumetric centre and black Sagittarius A* caption and
circle. The [capture settings](evidence/2026-09-23/capture.json) preserve the
camera, viewport, pixel ratio and observed DOM count. The browser engine version
was not exposed by the capture tool. This checks the displayed composition and
contrast; it is not native-renderer pixel parity or a frame-rate measurement.
