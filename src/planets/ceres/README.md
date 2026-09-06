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

The Ceres runtime inventory contains 36 files, about 62.5 MB. Other objects need
their own assets if opened. Ceres does not require Earth's global geometry.

To reproduce Ceres from its pinned source inputs:

```sh
node src/planets/ceres/tools/acquire.mjs
node src/planets/ceres/tools/prepare.mjs
```

Acquisition verifies 40.7 MB of source images and font data. Matching local files
are reused; corrupt sources fail without being overwritten. `--verify-only`
checks the local source inventory without network access. Raw binaries and
prepared images are excluded from Git; runtime assets use the existing publisher.

The two surface maps retain published shadows, seams, and polar gaps. The
**enhanced-color south pole has black areas without image coverage**. This is a
spherical mean-radius PoC, not a resolved shape or terrain model. Enhanced color
is explicitly false color, not the visible appearance of Ceres.

Source details and attribution are in [SOURCE.md](SOURCE.md) and [NOTICE.md](NOTICE.md).

Focused checks:

```sh
node --test src/planets/ceres/test/*.test.mjs
node src/planets/ceres/test/smoke-browser.mjs http://127.0.0.1:4210
node site/test/planet-browser-conformance.mjs http://127.0.0.1:4210 ceres
```
