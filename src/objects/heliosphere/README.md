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
    ├── shell.json                    960 retained PolyCSS image leaves
    ├── surface-mesh.json             Numeric source vertices, normals and indices
    └── rim-atlas.png                 2,024 corner-gradient tiles, 1,472 × 1,408 RGBA
```

This reproduces an illustrative Galaxium model recovered in Galaxio; it is
not a scientifically measured heliopause. The copied reference code records
the exact original deformation, Sun-relative ICRF orientation and rim shader.
The source recipe and generic preparation pipeline are separate, so a future
scientific model can replace the recipe and prepared output without introducing
another scene owner or changing the retained surface renderer.

The mesh uses 16 × 32 angular segments instead of the original 64 × 128.
It retains the nonlinear two-lobe tail and Float32-rounded radial normals.
Its 960 faces replace the earlier prototype's 3,968 faces. Runtime checks
960 geometric culling normals and samples facing once at each of 561 prepared
vertices; it allocates no per-face vectors. All 963 DOM nodes remain retained.

The atlas samples 22 nonuniform facing levels, with dense samples around the
rim. Each 32px tile evaluates the source rim equation across a triangle using
barycentric interpolation of three corner-facing values. Linear RGB is
converted to sRGB, and opacity is baked into alpha. Sorting the three values
reduces the bank to 2,024 tiles. Six offline PolyCSS transforms per face map
the sorted atlas corners onto the identical physical triangle. Runtime only
selects a prepared transform and image address; it constructs no geometry.

Every triangle sits inside a 1.5px transparent image guard. The six prepared
image transforms map its inset corners to the exact physical source vertices.
All three edges use pixel-area coverage, with fractional alpha computed as
`1 - (1 - opacity)^coverage`. This avoids mixing hard rectangle edges with a
feathered diagonal and lets neighboring optical depths combine under ordinary
source-over. Projective edge bleed is disabled. Adjacent triangles use the
same vertex samples, so their ideal interpolated edge values agree. The shell
retains 3D geometry and nearby parallax.

The fixed atlas is 1.06 MiB compressed and 7.91 MiB decoded; prepared JSON is
1.38 MiB. The earlier flat bank was 40.6 KB compressed and 2 MiB decoded.
The new material trades that image memory for substantially fewer DOM faces
and smooth shading within each face. It remains an approximation: coarse
silhouette segments, finite facing bins, raster edge sampling and interpolation
of vertex-facing scalars can differ from the original per-pixel shader,
especially near the boundary. It does not claim a measured IBEX surface.

Native Chrome inspection at 800 AU and 200 AU confirmed the substantial seam
correction, with median and p95 frame intervals of 16.7 ms during both drags
on the development machine. Close views isolated against black still reveal
faint bands where adjoining triangles have different projected raster
footprints. The material is not mathematically seam-free; this remains a
documented limitation of the bounded image bank.

From the repository root, reproduction requires only checked-in sources:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
pnpm build:preparation
node tools/objects/dist/prepare-shell.js src/objects/heliosphere
pnpm test:preparation
```
