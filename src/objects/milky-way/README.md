# Milky Way preparation

```text
milky-way/
├── object.json                 Physical frame, source pin, prepared digest
├── source/
│   ├── density.ktx2            Pinned 512 × 512 × 64 density grid
│   ├── volume.json             Channels, material, sampling and crop recipe
│   └── provenance.json         Original model record and rights status
└── prepared/
    ├── volume.json             Prepared object envelope with PolyCSS leaves
    ├── volume-slices.json      Physical quad and texture intermediates
    └── slices/{x,y,z}/*.png    Fixed 128 / 128 / 32 external texture bank
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
source is required. The output bank decodes to approximately 19.6 MiB of RGBA.

The density grid is a recovered synthetic Galaxium / Stellarium Labs SRL model,
not an observational reconstruction. Its source record states
“© 2025-present Stellarium Labs SRL. All rights reserved.” The inputs and
derived images are local reference material; no publication license is implied.
Ordinary-alpha slices and the prepared radial bulge approximate the reference
volume. They do not reproduce raymarching or guarantee interior-view fidelity.
The renderer transports prepared geometry and images without runtime baking.
