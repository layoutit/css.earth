# Milky Way — PolyCSS 3D proof

The view-switching experiment was rejected and replaced. This proof renders actual textured polygons at fixed XYZ positions, compiled offline with PolyCSS. Camera movement never changes their textures or geometry.

```text
experiments/milky-way/
├── volume-source.ts       # pinned Galaxio density/model decoding
├── volume-slices.ts       # offline density slabs and RGBA preparation
├── volume-build.ts        # PolyCSS quad compilation and standalone HTML
├── volume-runtime.ts      # retained geometry, one observer, smooth stack handoff
├── volume-controls.ts     # cssEarth trackball math; orbit, pan, dolly, translation
├── volume-verify.ts       # browser pixels, depth/parallax mutation and controls
├── volume-direction-verify.ts # actual pointer-drag direction regression
├── volume-geometry-verify.ts  # compiler image-to-world orientation mutation
├── volume-handoff-verify.ts   # boundary pixels, abrupt-switch mutation, fade depth
└── capture.ts             # optional actual Galaxio shader reference capture

.local/milky-way-proof/volume/
├── index.html             # interactive 3D proof; open locally
├── slices/{x,y,z}/        # 288 cropped prepared density textures
├── manifest.json          # source pins, physical geometry and limitations
└── verification.json      # measured browser evidence
```

- Drag to orbit. Shift/right-drag to pan. Wheel to dolly.
- Focus the viewport, then W/A/S/D translates the eye and target; Q/E moves down/up.
- Above, edge-on and below use the same spatial density field. Inside targets the source-derived Solar neighborhood.
- 288 retained PolyCSS polygons: 128 X, 128 Y, 32 Z. Long-axis slabs are four times thinner than the first proof. The three stacks contain spatial cross-sections.
- 19.6 MiB of decoded RGBA pixels, plus browser overhead. Transparent borders are cropped offline without moving source pixels. No runtime canvas, WebGL, SVG, masks, gradients, filters or blend modes.
- All three representations use the same observer. Near an axis boundary, ordinary opacity combines their completed 3D projections. Opacity never flattens the mesh or doubles its dust layers.
- Exterior rotation and translation are the feasibility target. Interior images remain coarse; view-dependent brightness and sampling are still approximations. X/Y pitch is twice Z pitch, a measured quality/performance compromise. Ordinary alpha is not Galaxio’s emission/extinction shader.
- No application files or packages are migrated. Reference assets remain local with their recorded provenance and rights restrictions.

The preparation uses real disk/star/dust fields and an Abel-derived approximation of the source bulge. Integrated alpha avoids the earlier per-slab sRGB amplification. This is a rendering approximation, not a claim of physical or visual parity.

The image/projective compiler maps PNG corners from polygon vertex order. Top-left-first vertices preserve the source spiral across all axes; changing UVs alone does not fix this backend. Regression checks reject the former corner order, reversed mouse Y, and abrupt stack switching. Browser checks also prove depth survives fractional projection opacity.

Success: actual PolyCSS depth, free camera movement, visible front/back/edge content and measured parallax. A test deliberately flattens the depth hierarchy and must destroy the edge-on pixel result. Maximum two final review/fix rounds; an unresolved representation limit must be reported rather than hidden by restricting the camera.

## Reproduce from the repository root

Requires the sibling Galaxio checkout with its pinned Milky Way density asset already present. No Galaxio server is needed for this bake.

```sh
cd /Users/apresmoi/Documents/cssEarth
pnpm install
pnpm exec playwright install chromium
mkdir -p .local/milky-way-proof
pnpm --filter @cssearth/engine exec tsc -p ../../experiments/milky-way/tsconfig.json
pnpm exec esbuild experiments/milky-way/volume-build.ts --bundle --platform=node --format=esm --packages=external --outfile=.local/milky-way-proof/build-volume.mjs
node .local/milky-way-proof/build-volume.mjs
pnpm exec esbuild experiments/milky-way/volume-verify.ts --bundle --platform=node --format=esm --packages=external --outfile=.local/milky-way-proof/verify-volume.mjs
node .local/milky-way-proof/verify-volume.mjs
pnpm exec esbuild experiments/milky-way/volume-direction-verify.ts --bundle --platform=node --format=esm --packages=external --outfile=.local/milky-way-proof/verify-direction.mjs
node .local/milky-way-proof/verify-direction.mjs
pnpm exec esbuild experiments/milky-way/volume-geometry-verify.ts --bundle --platform=node --format=esm --packages=external --outfile=.local/milky-way-proof/verify-geometry.mjs
node .local/milky-way-proof/verify-geometry.mjs
pnpm exec esbuild experiments/milky-way/volume-handoff-verify.ts --bundle --platform=node --format=esm --packages=external --outfile=.local/milky-way-proof/verify-handoff.mjs
node .local/milky-way-proof/verify-handoff.mjs
open .local/milky-way-proof/volume/index.html
```
