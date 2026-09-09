# Earth prepared texture levels

Validation artifacts are retained under `output/playwright/earth-texture-levels-20260909/`.

Earth starts with the smallest offline-prepared atlas level. The router releases refinement after restoring a saved URL or finishing a flight. The shared selection transaction follows projected CSS diameter, loads the selected dataset's pages, cancels superseded work, and atomically changes texture addresses on the retained globe. Completed pages remain cached within both a count and a decoded-byte bound. Threshold hysteresis avoids repeated switches at boundaries. Device DPR does not select a different dataset or level.

The seven surface atlas pages have 512/1024/2048/4096-wide prepared levels. Smaller original interior banks use proportional levels. Full-resolution images, transforms, texture coordinates and the 983-node tree retain their canonical identity. Padding happens before downsampling to preserve both coordinate scales. Mips use Lanczos3 and lossless WebP during preparation, with input/output hashes and dimensions in `prepared/texture-levels.json`.

Initial 13-image demand: **103,023,616 → 9,772,032 pixels**, or **393.004 → 37.277 MiB RGBA**. Surface-page residency at a distant saved URL is **5.648 MiB**. The remaining startup pixels are existing poles, lighting, atmosphere and Sun resources. Fine imagery is still loaded when needed; total Chromium/GPU memory is not bounded by the image-owner budget alone.

## Browser checks

Direct URL and zoom checks (`output/playwright/earth-texture-levels-20260909/report.json`), DPR 1 and 2: initial level 0; zoom selects levels 1, 2 and 3; zoom out returns to level 0; revisiting level 2 causes no new decode. Same retained nodes, stable camera, no unselected dataset atlas requests, no page errors. Native sidebar selection loads the requested second dataset. Screenshots show the current cloud-free canonical Earth source.

All 179 original runtime assets retain their HEAD manifest records. All 196 source/output level receipts match the actual image bytes. Older locally installed Earth images were found and replaced from exact HEAD-pinned local copies; prior bytes are retained under `prior-assets/`. The comparison below uses the corrected canonical images in both conditions.

Renderer build and typecheck passed. 74 focused router, selection and residency tests 22 renderer lifecycle/resource/texture tests, and 11 Earth dataset/image-bank tests passed. These checks do not constitute an aggregate release or deployment qualification. All 147 new prepared images (108,197,698 compressed bytes across all levels and datasets) are published at immutable CDN URLs. Every download passed its byte-size and SHA256 checks; see [delivery receipts](evidence/earth-texture-level-delivery.json). No pull request merge was performed.

## Controlled synchronized captures

Both profiles use the same current application and canonical image bytes, a fresh headless Chrome Canary 155 process, disabled browser cache, 1995×1236 viewport and DPR 2. The full-atlas control removes only the texture-level mapping and restores full-resolution initial addresses in its prepared runtime. Each capture records its own source patch, file hashes and input sequence. Navigation follows native wheel input and scene labels; wheel counts adapt to target visibility, so these are comparable journeys rather than identical input tapes. Recording and the development server add overhead.

| Measurement | Full atlas control | Prepared levels |
|---|---:|---:|
| Earth arrival maximum presentation interval | 323.216 ms | 103.161 ms |
| Entire route maximum presentation interval | 323.216 ms | 130.084 ms |
| Entire route p95 presentation interval | 18.948 ms | 19.263 ms |
| Entire route intervals over 25 ms | 37 / 1582 | 46 / 1667 |
| Earth arrival largest image-cache decode | 83.086 ms | 21.045 ms |
| Earth click to application ready | 994.7 ms | 843.9 ms |

The large Earth arrival stall is reduced. Overall frame consistency is not yet solved: p95 and the number of intervals above 25 ms did not improve in this pair. The image workload reduction is deterministic; timing differences remain single-run observations. Presentation feedback timestamps are not a complete accounting of physical refreshes.

- [Full-atlas trace](../output/playwright/sun-mars-earth-sun-full-atlas-control-20260909/trace.json.gz), [recorder JSON](../output/playwright/sun-mars-earth-sun-full-atlas-control-20260909/cssearth-diagnostics-8beda882-b3d3-46bb-9157-01ddc4650752.json), [video](../output/playwright/sun-mars-earth-sun-full-atlas-control-20260909/sun-mars-earth-sun.mp4), [synchronization](../output/playwright/sun-mars-earth-sun-full-atlas-control-20260909/synchronization.json).
- [Prepared-level trace](../output/playwright/sun-mars-earth-sun-texture-levels-20260909/trace.json.gz), [video](../output/playwright/sun-mars-earth-sun-texture-levels-20260909/sun-mars-earth-sun.mp4), [synchronization](../output/playwright/sun-mars-earth-sun-texture-levels-20260909/synchronization.json). Recorder JSON resides beside these files and is identified by the synchronization receipt.

Both captures above are valid, synchronized, error-free and contain no HMR or trace data loss. A supplementary final recapture was interrupted by an ECONNRESET in the recorder's `route.fetch` transport; its incomplete artifacts are excluded. The live server remained healthy. The only runtime edit after the valid prepared-level capture supplies the same initial-coarse hint to the material-less preflight shortcut; Earth's preflight has materials and does not use that shortcut.

## PR closeout integration

Integrated main `f7b7e856e` with its new objects, overview tabs and complete moon-orbit policy. All 406 scene payloads reproduce their committed pins. The two new objects now use the shared registry route with their original authored CSS. Page metadata was refreshed from those verified payloads; no scene rebake was necessary. The minimap point index was regenerated with all 406 bodies and 2,048 catalog stars.

World positions, radii, colors, orbit vertices and source trail weights match main exactly. The complete satellite-orbit policy runs in the prepared worker planner as well as its synchronous fallback. New Earth levels retain the same 983 scene nodes.

Post-integration validation: 424 renderer tests, 530 integrated shell/navigation/activation/dataset checks, 462 preparation tests, seven source/raster checks, renderer/preparation typechecks, and headless Earth direct-URL/zoom/sidebar/cache tests at DPR 1 and 2 pass. The full renderer suite is now included in CI. Optional paging and partition-validation tests use explicit capability fixtures; they no longer assume every production Earth or Deimos bake enables those capabilities. The close-range destination oracle follows the authored globe radius.

Functional browser evidence is in `output/playwright/earth-texture-levels-integrated-closeout-20260909/`. The paired performance measurements above remain tied to their original captured source patches; they were not relabeled as final-merge measurements. The earlier Deimos source-reproduction qualification and absent Squannit source-image limitation are outside these validation gates.
