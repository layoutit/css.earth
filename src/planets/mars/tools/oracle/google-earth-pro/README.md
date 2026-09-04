# Google Earth Pro Mars oracle

This is a local-analysis oracle for Google Earth Pro 7.3.7.1327. It is not a
redistributable Google Earth build.

The recovered Apple-event API exposes seven commands: get and set view, save
screenshot, terrain intersection, streaming progress, version, and velocity
camera movement. It does not expose vertical FOV, roll, renderer epoch, Sun
vector, or atmosphere composite values. The recorder therefore binds every
interaction to requested and observed camera state, a terrain grid, streaming
samples, decoded-frame stability, capture dimensions and hashes, and injected
menu/action state.

The local clone applies one renderer patch. At file offset `0x3a8c3`, it
replaces `cmovg %eax, %ebx` with three NOPs. This removes Google's deliberate
quality drop from 100 to 1 after the tenth `SaveScreenShot` call in ten minutes.
No scene, camera, tile, atmosphere, star, or Sun renderer instruction is
replaced.

The headless build also bypasses two modal startup branches in the cloned app:
the crash-recovery prompt receives its normal Continue result, and the clone's
single-instance warning is skipped. These patches do not alter rendering.

The headless instrumentation is embedded as a Mach-O load command. It suppresses
window visibility, focus, and activation; selects Mars through Google's own
`QAction` (`objectName=mars`); applies explicit atmosphere and Sun action states;
and emits JSONL evidence for menu trees, window state, actions, and readiness.

`launch-headless.mjs` runs in the current macOS session but fails closed unless
the embedded hook loads, the OS window audit reports zero visible windows, and
the oracle process does not own the foreground. A native capture is valid only
after that preflight, an event-log `ready` record, a second zero-window and
non-foreground audit, and two decoded save-image captures satisfying the
stability threshold. Foreground changes between two non-oracle applications are
recorded but do not create a false failure.

The comparison tool accepts only identical dimensions. It writes normalized
native and browser PNGs, a Pixelmatch diff, an absolute RGB diff, metrics, and a
triptych ordered native | browser | Pixelmatch.

## Render-contract extraction

`build-render-contract-hook.mjs` builds an x86_64 late-injection probe that
chains the existing layer oracle. `extract-render-contracts.mjs` then records
the live OpenGL camera, sky, catalogue-star, lighting, texture, buffer, blend,
depth, and viewport state at all 56 registered Mars poses. The run remains
invalid unless the native process has zero visible windows and never owns the
foreground.

The extracted sky is not one image. Google draws a 2048×1024 repeating sky map
as a full-screen quad and then draws 5,000 catalogue points from a 160,000-byte
vertex buffer. Each 32-byte catalogue record supplies position `float3` and
RGB-plus-magnitude `float4`; the shader does not consume the final four bytes.
The catalogue points sample a separate 32×1 radial response and use exposure
40. The live save-image projection is 2093×1295 with a 60.000° horizontal and
39.316° vertical sky-ray field of view.

The visible Sun and the directional light are separate contracts. The default
`SunModel` path binds the decompiled `sun` resource as an exact 128×128 RGBA
texture, draws a four-vertex client-array quad, uses `SRC_ALPHA, ONE` blending,
tests depth, and does not write depth. `capture-sun-presentation-contract.mjs`
records the exact quad vertices, UVs, MVP, and clip result at the same 56 poses.
The improved `sun3` resource is statically referenced but is not bound while
the default `improvedSun=false` path is active. `SunLight` direction and
exposure are recorded independently from the billboard presentation.

The public `MoveCamera {x, y}` Apple event accepts values in the zero-window
process but produced no material view-state movement in the tested traces. It
is therefore recorded as a negative API result, not used as a substitute for
the native camera matrices.

`capture-isolated-sun-components.mjs` applies a capture-only draw filter after
contract extraction. It retains only the sky-map quad, the 5,000 catalogue
stars, and the verified 128×128 Sun quad. This produces native reference images
without planet, atmosphere, annotations, labels, timeline, attribution, or
other UI chrome.

Run the complete extraction and publication sequence with:

```sh
node src/planets/mars/tools/oracle/google-earth-pro/extract-render-contracts.mjs
node src/planets/mars/tools/oracle/google-earth-pro/capture-sun-presentation-contract.mjs
node src/planets/mars/tools/oracle/google-earth-pro/publish-render-contract-index.mjs
node src/planets/mars/tools/oracle/google-earth-pro/capture-isolated-sun-components.mjs
```

The authoritative local index is
`output/playwright/google-earth-pro-mars-render-contract-live-v1/run-authoritative-contract-2026-09-02/contract-index.json`.

## Granular implementation contract

The 56-pose run is only the coarse asset and renderer inventory. The granular
run records 201 native samples across six ordered trajectories: a 5° longitude
orbit, a 5° latitude meridian, a 15° heading orbit, a 5° tilt sweep, an
18-step logarithmic zoom, and a 37-step coupled latitude/longitude/heading/tilt
path. Every sample binds requested and observed camera state to the exact sky
ray basis, celestial matrix, catalogue MVP, Sun model-view and MVP, client quad,
clip state, wall-clock time, and native frame.

`publish-granular-render-contract.mjs` turns those samples into replay
equations. The camera orientation fit has a maximum angular residual below
0.0000027°. The sky-map and 5,000-point catalogue are related by one recovered
equatorial-to-sky-map matrix; rebuilding the native catalogue MVP has a maximum
matrix-element residual of 0.000157. The Sun center is placed at 0.939566 of the
dynamic far plane, and its local quad half-extent is 0.0567853 of that plane.
This is why its render-space size changes with zoom while its visible
screen-space size does not. The fitted visible Sun center is within 0.239 px of
the native samples.

The dense run also separates five Sun states: fully visible, partially clipped,
outside the viewport, behind the camera, and draw omitted. The omitted state
contains both rear-frustum culling and planet-occultation culling. At the tested
zoom path, the Sun changes from occulted at 11,129,418 m to drawn at 12,271,530
m even though its celestial direction does not change.

The native linked shader sources are dumped at runtime for programs 6, 24, and
27. This proves the exact Sun textured-quad shader, the plate-carrée sky-map
shader, and the catalogue-star shader actually linked by the live renderer,
rather than relying only on filenames in the application resources.

Run and publish the granular contract with:

```sh
node src/planets/mars/tools/oracle/google-earth-pro/build-render-contract-hook.mjs
node src/planets/mars/tools/oracle/google-earth-pro/capture-granular-render-contract.mjs
node src/planets/mars/tools/oracle/google-earth-pro/publish-granular-render-contract.mjs
```

The implementation-ready contract is
`output/playwright/google-earth-pro-mars-render-contract-live-v1/run-granular-authoritative-2026-09-02/implementation-contract.json`.
The remaining unproven fields are native pointer-drag easing/inertia, a
repeatably pinned timeline epoch, roll and non-default FOV, and alternate native
save-render aspect ratios.
