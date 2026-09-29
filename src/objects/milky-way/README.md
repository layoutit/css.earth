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
    ├── core/slices/{x,y,z}/*.png  Generated, ignored 88 / 87 / 26 bulge textures
    ├── sky/{px,nx,py,ny,pz,nz}.webp  Generated, ignored six celestial cube faces
    └── sky-near/{px,nx,py,ny,pz,nz}.webp  Committed: the same faces with the neighbourhood stars baked in
```

App startup restores missing images from the pinned sources via `pnpm prepare:environment-images`, preserving the accepted metadata. See the [shared bake commands](../../../labs/nebula/docs/baking.md).

From the repository root, with Node 24 (or 22.18+) and pnpm 10.33.0:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:tools
pnpm prepare:volume src/objects/milky-way
node packages/bake/cli/prepare-stars.mts src/objects/stellar-neighbourhood
node packages/bake/cli/prepare-shell.mts src/objects/heliosphere
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
then keeps only the bulge: optical depth fades from 1.5 to 2.2 volume units
(2.9 to 4.3 kpc) from Sagittarius A*, so the simulation's own disc and arms are
not drawn. The bank is 7.32 MiB compressed and 9.76 MiB decoded: 138 bulge slabs
and nothing else. Bulge textures keep the original
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
source's channel transfer. The source already contains its bulge. The full
physical extent and the asset's Euler rotation about the Galactic x and z axes
are converted to the shared Sun-centred ICRF frame, with two corrections:

- **Centre.** The asset puts the Galactic centre 8.00 kpc from the Sun. The
  volume is centred on the [Sgr A* package](../sgr-a-star/README.md) instead, at
  the GRAVITY (2022) distance of 8277 pc in the same frame and epoch, so the
  bulge surrounds the black hole it is drawn around. OpenSpace's centre lay
  277 pc short of it.
- **Tilt.** The asset's rotation about y is 3.1248 rad, not π: it tilts the
  model 0.96° out of the Galactic plane, which put the Sun 134 pc below the
  disc instead of about 20 pc above it. The volume uses π, so the model plane
  is the Galactic plane; Sgr A* then sits 6.7 pc below the Sun's plane
  (Reid et al. 2019 measure the Sun 5.5 ± 5.8 pc above the plane).

[`volume.test.ts`](../../../packages/bake/src/density/volume.test.ts) checks
both against the asset and the Sgr A* package.

The galaxy's [stellar extent](source/stellar-extent.json) is 26 kpc from the
centre: López-Corredoira et al. (2018, A&A 612, L8;
[arXiv:1804.03064](https://arxiv.org/abs/1804.03064)) detect disc stars beyond
that radius at 99.7% confidence, and every Milky Way star the app places lies
inside it (the farthest is 20.9 kpc from Sgr A*). While the camera is inside
that radius the galaxy's caption hides; outside it the caption hangs just under
the drawn bulge.

Only the bulge and inner disc are drawn. The display keeps full volumetric
support inside 1.5 model units (2.9 kpc) and smoothly reduces it to zero at
3.5 units (6.8 kpc). These radii are presentation choices, not measured bulge
boundaries: the simulation's outer disc and arms are not a map of the real
ones, so they fade out before the Sun's neighbourhood. Each original slab's
alpha is divided through that support; the decoded RGB stays unchanged. There
is no flat disc image and no whole-galaxy impostor view: the same slices draw
the galaxy at every distance. No source emission, dust model or colour grade
is changed.

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
the continuous transfer without extra image resources. The 138 bulge slabs
use 414 image elements, compared with the original
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
figures above exclude these sky faces. Sky faces use quality 90. Original source chunks are offline
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

## The galaxy as star dots from published catalogues

Nobody has seen the Milky Way from outside, so it is drawn as the objects
astronomers have catalogued, each a sharp dot at its published position, over a
faint backing that shows the galaxy's overall shape. Each catalogue keeps its
table in `source/<id>/` beside a `points.json` recipe naming the columns, the
authors' own selection and the citation.
[`prepare.mts`](../../../tools/objects/catalogue-points/prepare.mts) has Astropy
convert each row to Sun-centred ICRS coordinates; rows without a distance are
left out.

| Layer | Source | Selection |
| --- | --- | --- |
| [Hot stars](source/hot-stars/points.json) | Zari et al. (2021), filtered sample | One row in 4 of 417,535 tracked; each at its astro-kinematic distance |
| [Maser parallaxes](source/masers/points.json) | Reid et al. (2019), Table 1 | 199, at 1/parallax |
| [Clouds](source/hou-han-gmc/points.json), [masers](source/hou-han-masers/points.json), [HII regions](source/hou-han-hii/points.json) | Hou & Han (2014), tables A.1 to A.3 | Measured distance first, else the catalogue's kinematic one |
| [Young open clusters](source/open-clusters/points.json) | Hunt & Reffert (2023) | Their own quality cuts, younger than 100 Myr |
| [Young Cepheids](source/cepheids/points.json) | Skowron et al. (2019) | Younger than 60 Myr |
| [Bulge RR Lyrae](source/bulge-rr-lyrae/points.json) | Prudil et al. (2025) | Within 3 kpc of the centre, one in 16 |
| [Stars within 100 pc](source/nearby-stars/points.json), [within 20 pc](source/nearby-stars-20pc/points.json) | Gaia Catalogue of Nearby Stars (2021) | One row in 64; every row within 20 pc |
| [Globular clusters](source/globular-clusters/points.json) | Baumgardt & Vasiliev (2021) | All 165, drawn as their own bank |

**Which layers follow the arms.** An arm-tracer layer is kept when its dots sit
on the arms the backing draws: its arm score (the backing's luminance minus its
mean at that radius, over its spread, at the layer's positions outside 3.5 kpc)
is 0.5 or more. Random points score 0. The scores are in the
[merge recipe](source/tracers/merge.json): young open clusters 1.02, maser
parallaxes 1.01, Hou & Han's clouds 0.79, masers 0.55 and HII regions 0.53,
young Cepheids 0.52. The WISE HII regions (0.38) and the molecular-cloud catalogue
of Miville-Deschênes et al. (0.45) were left out.

**Kinematic distances.** A kinematic distance whose uncertainty is over 1 kpc is
left out: its ±7 km/s velocity uncertainty through a flat rotation curve (R0 =
8.3 kpc, Θ0 = 239 km/s, as Hou & Han 2014, Sect. 2.4) cannot place it. Those are
the sources toward tangent points, the centre and the anticentre, which pile
onto a circle through the Sun and the centre; the cut drops 532 of them.

**Colour.** Each layer keeps its catalogue colour, mixed halfway to white so it
reads as a tint of starlight, then raised to the power 1.6 so the coloured dots
sit in the backing and the whitest keep their sparkle. Both are presentation
choices, recorded in the merge recipe.

**An even density at every zoom.** Every catalogue is complete only out to some
distance from the Sun, so together they pile up around it. [`merge.mts`](../../../tools/objects/catalogue-points/merge.mts)
keeps a dot, in a fixed shuffle, while the dots within a small face-on kernel
stay under the thin disc's own density law: exponential in Galactocentric radius
with a 2.6 kpc scale length (Bland-Hawthorn & Gerhard 2016). The galaxy level
holds 15 dots per kpc² at the Sun, the highest that stays even out to 4 kpc
along the solar circle (6,586 dots). Nested levels around the Sun add dots up
to 150 per kpc² out to 3 kpc, 1,500 out to 800 pc, 50,000 out to 100 pc and
1,000,000 out to 20 pc; each adds only dots the levels around it do not draw,
and its density falls to nothing over its outer half.
[`stack.mts`](../../../tools/objects/catalogue-points/stack.mts) joins them into
[one bank](source/dots/stack.json) of 13,420 dots. The app draws a growing
share of it as you zoom in: the galaxy level whole within 10 kpc, then each
level's dots one at a time as the view narrows past the level's radius. A
level's edge is never on screen, and a dot you have seen stays while you zoom
in.

**The backing.** An ESA artist's impression of the Milky Way seen from above
([recipe](source/backing/recipe.json)) is drawn under the dots as one image
plane in the galaxy's frame, anchored so its Sun and centre land on the app's.
It is artwork, not a measurement, and the levels (black 20, gamma 1, white 150
of 255) keep it under the dots. It is 184 KB at 2048 px.

**Past the Solar System.** From the edge of the Solar System (the planets fade
by 1 light-year) the dots take over from the app's stars: only featured stars
keep their markers, as landmarks. The overview reads Solar System until the
planets fade, Milky Way while inside the galaxy, and Local Group once the
galaxy's nebulae have faded, about 19 kpc out.

**What the dots cannot show.** Dust hides the far side of the disc: past 4 to
6 kpc from the Sun the catalogues thin out, so the Sun's side of the galaxy is
fuller. Distances carry their catalogues' errors. The disc has no warp and the
bulge is one in 16 of its RR Lyrae stars.

## Bulge evidence

Two [browser captures](evidence/2026-09-28/capture.json) of this version show the
galaxy as its bulge slices only: 603 slice elements, no disc image and no impostor
view. From the [Milky Way overview](evidence/2026-09-28/bulge-overview.jpg) the
bulge surrounds the Sagittarius A* circle. From 39,183 light-years above the
[Sun's neighbourhood](evidence/2026-09-28/near-sun.jpg) the inner disc fades out
before the Sun. On css.earth before this change the same camera showed a 344 px
face-on impostor picture of the whole galaxy beside the Sun, although the camera
is inside the galaxy. These check the displayed composition and element counts;
they are not frame-rate measurements.
