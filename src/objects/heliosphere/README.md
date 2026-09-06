# Illustrative heliosphere prototype

```text
heliosphere/
├── object.json                       Physical frame and source/prepared pins
├── source/
│   ├── shell.json                    Replaceable deformation and material recipe
│   ├── provenance.json               Reference, approximation and source hashes
│   ├── LICENSE.GALAXIO-MIT.txt        Original code copyright and permissions
│   ├── galaxio-heliosphereModel.ts.txt
│   └── galaxio-heliosphereRenderer.ts.txt
└── prepared/
    ├── shell.json                    3,968 retained PolyCSS image leaves
    ├── surface-mesh.json             Numeric source vertices, normals and indices
    └── rim-atlas.png                 128 facing samples, 1,024 × 512 RGBA
```

This reproduces an illustrative Galaxium model recovered in Galaxio; it is
not a scientifically measured heliopause. The copied reference code records
the exact original deformation, Sun-relative ICRF orientation and rim shader.
The source recipe and generic preparation pipeline are separate, so a future
scientific model can replace the recipe and prepared output without introducing
another scene owner or changing the retained surface renderer.

The mesh uses 32 × 64 angular segments instead of the original 64 × 128.
It retains the nonlinear two-lobe tail and Float32-rounded radial normals.
Each visible triangle occupies half of a PolyCSS projective image leaf;
the other half is transparent in the PNG. Projective edge bleed is disabled
to avoid bright overlaps between translucent triangles. Runtime selects one
of 128 prepared facing samples using each face's center and radial normal;
this approximates the reference's smoothly interpolated per-vertex normals.
Both RGB intensity and alpha are baked, with linear RGB converted to sRGB.

From the repository root, reproduction requires only checked-in sources:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
pnpm build:preparation
node tools/objects/dist/prepare-shell.js src/objects/heliosphere
pnpm test:preparation
```
