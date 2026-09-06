# Milky Way preparation

```text
milky-way/
├── object.json                 Physical frame, source pin, prepared digest
├── source/
│   ├── density.ktx2            Lossless 1024 × 1024 × 128 OpenSpace RGBA grid
│   ├── acquisition.json        Original raw URL/hash and exact reduction recipe
│   ├── volume.json             Channels, material, sampling and crop recipe
│   ├── provenance.json         Authors, transfer equations, frame and source pins
│   └── openspace/              Original MIT notice, asset, shader and sync listing
└── prepared/
    ├── volume.json             Prepared object envelope with PolyCSS leaves
    ├── volume-slices.json      Physical quad and texture intermediates
    └── slices/{x,y,z}/*.webp   Fixed 256 / 256 / 32 external texture bank
```

From the repository root, with Node 22.15+ and pnpm 10.33.0:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
pnpm prepare:universe
pnpm test:preparation --universe
```

This builds preparation tools, reproduces the Milky Way assets and the Sun's
world context, and checks source hashes, prepared resource closure, physical
orbit alignment, and PolyCSS pixel-to-world mapping. The normal
`pnpm test:preparation` also includes these tests. To prepare another compatible
volume after building tools, use `pnpm prepare:volume <object-directory>`.
Preparation reads the local pinned inputs; no sibling checkout or network
source is required. The checked source is 41.77 MiB. The 1024px WebP bank is
14.65 MiB compressed and decodes to 131.05 MiB across 544 retained leaves.
WebP uses quality 90 for RGB and preserves alpha exactly. Each axis has the
same physical slice pitch; four samples per Z slab integrate all 128 original
source Z layers. The thin galaxy detail retains its full in-plane resolution.

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

The 512 MiB unmodified upstream raw file stays outside Git. To reacquire it
and verify/recreate the checked derivative from a clean checkout:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
pnpm build:preparation
pnpm prepare:volume src/objects/milky-way --acquire-source .local/volume-source-cache
```

This needs about 750 MiB temporary space. The pinned HTTPS source, raw SHA256,
X-fastest RGBA order, factor-one lossless import and Zstd level are
recorded in `source/acquisition.json`; the exact Node/Zstd versions are in
`source/provenance.json`. The import rejects any raw or derivative mismatch.
Normal preparation uses the checked derivative without downloading.

The working CSS/Galaxio display convention integrates a common physical path
metric on every axis. The display gain is calibrated to 16 after slab
integration: three stops below the previous 128 baseline, which was too bright
with the OpenSpace emission model. These are renderer approximation choices, separate from OpenSpace's authored
emission/absorption coefficients. OpenSpace integrates normalized texture
distance and uses an additive raymarch display; baking that direction-dependent
coefficient into separate CSS stacks causes brightness changes at handoffs.

Ordinary-alpha slices approximate RGB extinction and emitted energy. They
retain finite-slice/axis-handoff artifacts and do not reproduce OpenSpace's
additive HDR raymarching, stochastic sampling or camera-dependent fade.
The renderer transports the prepared images and geometry; stars use the
application's independently prepared star catalog.

Each retained slab has three coincident CSS image elements sharing one texture.
Their optical contribution compensates for oblique viewing before isolated axis
images are mixed. Integer optical gains are exact; fractional gains approximate
the continuous transfer without extra image resources. The 544 prepared slabs
therefore use 1,632 image elements. Keeping the axis scenes separate avoids
browser cracks and expensive sorting at intersections between planes.
