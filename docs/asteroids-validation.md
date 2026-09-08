# Asteroid validation

The [52 additions](asteroids.md) use 31 VLT/SPHERE models, 16 DAMIT models and five NASA/JPL radar models. Body data is qualified at `7cbe54ce`; the final display changes are at `f7518f9a`. The latter only formats navigation distances and wraps tags beside long titles. Catalog precision, marker order and prepared body bytes are preserved.

![Twelve representative asteroids captured in Chrome with their missing-imagery grids and prepared lighting](asteroids-overview.webp)

## Source and package checks

| Check | Result |
| --- | --- |
| Original-input restoration into empty staging directories | All 52 packages restored through their acquisition plans |
| Source manifests, input sizes and SHA-256 pins | All 52 passed, including final content changes |
| Source and prepared-body unit checks | 156 source tests and 52 prepared-body tests passed; the four legend corrections additionally passed 16 focused checks |
| Object-package and prepared-data validation | All 52 passed |
| Prepared leaf census | Every added package has 800 native PolyCSS `u` raster leaves; zero package-owned failures |
| Mesh topology and reduction | One closed outward-wound component per model, Euler characteristic 2; nine original 800-face models need no edge collapse |
| Geometric inspection | Original and reduced front, back and polar views inspected; per-body source notes record independent sampled distances and radial ambiguity checks |
| Title generation | All 123 registered title sources reproduced from the pinned font |
| Astronomical context | All 65 asteroid entries pass the existing epoch and independent ±30-day vector checks |

The sample distances are not exhaustive geometric bounds or observational uncertainties. Elevation is radius relative to the documented sphere; lighting has an arbitrary display meridian. The shared grid identifies unavailable surface imagery.

## Browser and delivery checks

Chrome `152.0.7977.76` ran headlessly at DPR 1 and 2. All 52 additions passed the existing focused conformance cases. There are 624 final camera/lens/lighting captures, with contact sheets inspected across the complete scope and full-page framing inspected for the long and irregular examples. Four floating-point legend labels found during inspection were corrected and recaptured. Thin raster-edge seams remain visible at some magnifications.

The existing preview checkout contains independent shell work. Its visual and conformance evidence is therefore separate from production delivery evidence. The preview remains on port 4278. A stopped preview process and a disk-space interruption were recovered without discarding completed cases or starting another server.

The fresh checkout ran `pnpm install --frozen-lockfile`, including normal postinstall, followed by `pnpm setup:assets` with the 52 selected object IDs. It downloaded **1,820 files with zero reuse**, totaling **405,843,588 bytes**. SHA-256, size and regular-file checks passed. Source preparation was not needed. After those checks, byte-identical generated copies used independent APFS copy-on-write storage to reduce disk use; no hard links or symlinks supplied runtime assets.

The complete `pnpm build` passed at the final geometry/camera revision. Fresh production builds subsequently passed after the legend corrections and final UI changes, producing 124 pages. Production asset assembly passed for all 52 additions.

All 104 fresh browser mounts passed: one active scene, 800 retained raster triangles, native mouse drag, both lenses, lighting transitions, correct world-context membership and no other body's scene-asset requests. Playwright fulfilled local requests from the fresh static build and bound the delivered buffers to file hashes, including worker requests. All 52 observed body transport hashes match the final prepared bytes. Completed unchanged cases were reused across the four legend-label corrections; the corrected bodies ran against the updated build.

Per-body installation is 7.67–8.04 MB. Cold delivery observed 57.18–57.30 MB of uncompressed response bodies including shared stars, shell, code and the selected object. These figures are neither compressed network transfer sizes nor load-time measurements. Each 2048 × 6400 atlas represents 52,428,800 bytes of decoded RGBA capacity; this does not establish simultaneous GPU residency.

The asteroid accordion includes all 52 entries. Native navigation checks cover 52 Europa, 9 Metis, Nysa, 1998 WT24, 1994 CC Alpha and Moshup, with one mounted scene after each transition. The final production UI check covers narrow and desktop views of Pallas and 1994 CC Alpha, numeric navigation labels and title/tag containment.

## Native drag traces

Each trace covers approximately 2.5 seconds of native mouse dragging with lighting enabled at a 1505 × 1237 CSS-pixel viewport. These are short headless preview observations, not universal performance guarantees or a diagnosis of GPU saturation.

| Body | Draw cadence, DPR 1 / 2 (frames/s) | DrawFrame p95, DPR 1 / 2 (ms) |
| --- | ---: | ---: |
| Pallas | 58.58 / 58.95 | 9.32 / 9.35 |
| Camilla | 58.94 / 58.54 | 8.20 / 8.34 |
| Nysa | 58.99 / 58.95 | 12.09 / 12.14 |
| Castalia | 58.95 / 58.95 | 9.73 / 9.72 |

All eight traces have 800 leaves and no page errors. The records retain browser version, camera URL, prepared hashes, screenshots and raw compressed Chrome traces.

## Aggregate limits

Repository-wide checks are **not all green**. `pnpm acquire:planets -- --verify-only` stops on eight missing pre-existing Amalthea inputs. The aggregate `pnpm test` run has nine platform failures, and the shell run has one failure, associated with the existing `ObjectSwatchStyles.astro` Sun-specific ownership dispatch. The leaf census has no failures in the 52 added packages but reports that same shared violation. These checks are distinguished from the passing focused asteroid checks above.

A later atlas-reproduction check was interrupted before completion while correcting display precision; it is not counted as a pass. Final registry values and navigation atlases retain their previously prepared identities. Completed renderer and interaction checks were reused where the intervening changes only affected authored text or the two display rules.

Local logs, source-fit reports, install receipts, image sheets, response hashes and traces are retained under `output/asteroids-combined` and the source-family output directories. The per-body source records and reproducible preparation inputs are checked in beside each package.
