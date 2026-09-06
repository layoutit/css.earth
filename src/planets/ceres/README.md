# Ceres PoC

Ceres is available at `/ceres/` through the shared object registry, application
shell, runtime, camera, lens selection, lighting, and heliocentric view.
There is no Ceres controller. Its package prepares imagery and presentation data.

To view it without acquiring or preparing sources:

```sh
pnpm install --frozen-lockfile
pnpm setup:assets --object=ceres
pnpm dev
# Open http://127.0.0.1:4210/ceres/
```

The Ceres runtime inventory contains 41 files, about 67.6 MB. Other objects need
their own assets if opened. Ceres does not require Earth's global geometry.

To reproduce Ceres from its pinned source inputs:

```sh
node src/planets/ceres/tools/acquire.mjs
node src/planets/ceres/tools/prepare.mjs
```

Acquisition verifies 507.4 MB of source images, elevation data, and font data. Matching local files
are reused; corrupt sources fail without being overwritten. `--verify-only`
checks the local source inventory without network access. Raw binaries and
prepared images are excluded from Git; runtime assets use the existing publisher.

The maps retain observed shadows and seams. A **neutral gray cartographic grid**
marks missing imagery, using the same preparation code as Pluto. The grid is
an explicit absence of data, not inferred terrain. Only exactly black source
pixels connected to the southern border are marked; dark observed terrain and
nonzero JPEG edge pixels remain untouched. This is a spherical mean-radius PoC,
not a resolved shape or terrain model. Enhanced color is false color.
Added globe lighting is approximate: neither the Shadows setting nor the fixed
curvature shading changes the shadows already recorded in the Dawn images.
The lens descriptions and source documentation explain these limitations.

Source details and attribution are in [SOURCE.md](SOURCE.md) and [NOTICE.md](NOTICE.md).

The **Elevation** lens adds terrain height from Dawn's stereo model, with a
numeric color scale. It disables globe lighting so map colors remain comparable
to the legend. The photographic lenses keep their existing lighting behavior.

Elevation is restricted to 60°S–60°N as a conservative display policy: its
publisher interpolated polar gaps without supplying a fill mask. Gray grids
mark missing or withheld regions.

Preparing elevation requires the original 466.6 MB DTM. The runtime asset
installer downloads prepared maps only and does not require that source file.

Focused checks:

```sh
node --test src/planets/ceres/test/*.test.mjs
node src/planets/ceres/test/smoke-browser.mjs http://127.0.0.1:4210
node site/test/planet-browser-conformance.mjs http://127.0.0.1:4210 ceres
```
