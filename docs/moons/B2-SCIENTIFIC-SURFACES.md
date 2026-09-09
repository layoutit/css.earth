# B2: scientific surfaces and terrain for 15 moons

Status: implementation and focused source validation; no B2 browser qualification yet. Branch `feat/moons-scientific-surfaces`, based on merged PR #55 (`55bda12f`). Reuses the existing Moons checkout; no new worktree. B1 final qualification records are preserved in the first branch commit.

The complete delivery is one substantive surface or geometry improvement for each of the 15 reviewed bodies, with preparation, source restoration, legends, visible scientific limits, context assets and browser qualification. Selected products must add information absent from the existing package. Existing imagery and earlier numeric elevation do not count as new work.

| Body | Selected new information | Current evidence and remaining work |
| --- | --- | --- |
| Moon | Original numeric LOLA topography and Diviner rock abundance | Raw-DN, unit, meridian and footprint anchors pass. Numeric atlas preservation tests pass. First preparation passed; repeat required after nearest/lossless display fix. |
| Phobos | Exact-mesh relative albedo and gravity-model slope; native source geometry | All 196,608 facet centroids registered; 1,600-face closed candidate measured. Context regeneration, preparation and browser review pending. |
| Deimos | Exact-mesh relative albedo and gravity-model slope; native source geometry | 124,012 supported facets, 72,596 withheld; 1,600-face closed candidate measured. Context regeneration, preparation and browser review pending. |
| Dimorphos | Released gravity-model slope | Complete 196,608-row centroid bijection repairs the documented FITS/OBJ ordering difference. Preparation and browser review pending. |
| Io | Released geologic units | Source polygons, categories and east-longitude registration validated. Exact categorical atlas tests pass. Full preparation and browser review pending. |
| Europa | Controlled Agenor Linea regional terrain | Independent source-pixel anchors pass. Invalid exported confidence products excluded. Geographic focus and runtime navigation are under review; full preparation and browser review pending. |
| Ganymede | Released geologic units | Source polygons and categories validated; one explicitly identified zero-area ring excluded. Full preparation and browser review pending. |
| Enceladus | Corrected June 2026 v2 DSK shape | Pinned conversion reproduced byte for byte. Closed 2,000-face candidate: 1,822 m maximum across 8,000 source-distance samples. Full preparation and visual shape review pending. |
| Tethys | Relative albedo and native source shape | Independent albedo anchors pass; closed 2,000-face candidate measured. Full preparation and visual shape review pending. |
| Dione | Relative albedo and native source shape | Independent albedo anchors pass; closed 2,000-face candidate measured. Full preparation and visual shape review pending. |
| Rhea | Relative albedo and native source shape | Independent albedo and exact projection-gap anchors pass; closed 2,000-face candidate measured. Full preparation and visual shape review pending. |
| Titan | Measured height, interpolated height and distance to measured data | Original PDS float grids and independent anchors pass. Measured area is about 6% in this product; interpolation remains separately labeled. Full preparation and browser review pending. |
| Charon | PDS MVIC enhanced-color mosaic | Forty independent band-value anchors and exact finite missing sentinel validated. Full preparation and browser review pending. |
| Titania | 2026 digitized geologic map | Exact release identified; GIS payload blocked by archive access. Registration and implementation remain open. |
| Miranda | 2026 digitized geologic map | Exact release identified; GIS payload blocked by archive access. Registration and implementation remain open. |

The [reviewed batch scope](PR-BATCHES.md#b2) and frozen body reviews remain authoritative for the agreed cohort. Detailed intake receipts live in `b2-preparation/` and then in each body's source notes and acquisition pins. Archive access or registration limitations remain unresolved until measured; they do not establish that a dataset is absent. Any required cohort change will be made explicit before PR delivery.

Body recipes and shared decoders are integrated for 13 bodies; none is marked ready. The Moons owner handles final integration and serialized qualification. Titania and Miranda remain in the agreed 15-body cohort. The bounded official-mirror search is recorded in [outer intake](b2-preparation/outer-intake.md); repeated archive retries are paused.

Source evidence is preparation evidence, not a claim of browser appearance or measurement accuracy. Geometry distance reports are sampled approximation bounds, not instrument uncertainty. Required aggregate gates and real Chrome DPR 1/2 checks remain open for B2. Existing B1 qualification is preserved separately.

On this continuation, 30 focused checks passed serially: the complete Europa focus navigation through the renderer validator, plus independent Moon, Charon and Saturn scalar anchors, exact projection gaps, encoded scientific bands/poles/thumbnails, categorical atlases and discrete legends. The tests now also cover scientific minimaps, facet thumbnails and bounded preview ray counts, with direct source-row identity preserved in native atlases. The ordinary-image paths remained byte-identical in the preservation fixtures. All 13 source-ready packages also pass complete source file inventory, byte-count and SHA-256 checks; see [focused validation receipt](b2-preparation/focused-checks.json). The [configuration delta check](b2-preparation/source-config-delta.json) verifies the four configurations edited after that inventory. Full preparation will verify actual body artifacts.

Two monitored materialization attempts were stopped when compressed memory grew by more than 2 GiB: [Moon preparation](b2-preparation/bake-moon-20260908-214536/resources.json) and [Phobos context regeneration](b2-preparation/context-phobos-20260908-214835/resources.json). Those attempts are incomplete and are not qualifying evidence. The monitor stopped only its recorded child process. Read-only process ownership checks identified concurrent large jobs in other cssEarth checkouts; B2 heavy jobs are held while that pressure persists. The prior successful Moon preparation predates the nearest-display fix and needs repetition.

## Execution and resource limits

The user authorized implementation of the complete B2 cohort. Following initial source selection, lane assignments include isolated preparation decoders and their focused tests, plus their body-owned recipes. The Moons owner integrates shared dispatch, painting, legends and acquisition hooks; reviewable lane patches can be applied centrally where automatic approval review retains an earlier intake-only scope.

Large workloads are serialized across all lanes: preparation, production build/assembly, full tests, browser tests and captures never overlap. Node heaps are capped at 8 GiB unless the user explicitly approves a higher limit for a current run. Before a run likely to exceed 1 GiB, check disk space and current memory pressure and record the output path. Monitor the owned workload; stop it if memory pressure becomes critical or swap/compressor use rises sharply. Preserve every other task's processes. Reuse still-valid completed evidence.

Current isolated decoder ownership: Jupiter lane — categorical-geology.mjs; Saturn lane — PDS float maps and a pinned prepare-time DSK converter; outer lane — observed-pds4.mjs; Moons owner — lunar PDS integer grids and exact-mesh facet scalars. These implementation modules are part of the authorized B2 product work, with source and numerical validation before full preparation.

## Next execution steps

1. Resume only after the concurrent memory-intensive jobs have settled. Keep the existing monitor, one heavy job at a time and the current heap caps. The Moon and Phobos attempts above must be repeated; their stops do not qualify the final display.
2. Regenerate and inspect the existing Phobos/Deimos context images using their unchanged original geographic maps and new native faces. Re-pin only the reviewed context and navigation records. The four Saturn native-shape changes have no geometry-dependent generated context source pin.
3. Prepare the 13 source-ready bodies, verify the resulting assets and source transfer, then run the required package, aggregate and real Chrome DPR 1/2 checks. Inspect source registration, lighting, limbs, missing coverage, legends and Europa’s regional focus.
4. Reconcile merged PR #56 before final qualification; it adds independent facet-field and observation preparation support touching the shared index and raster dispatcher. Preserve both complete capabilities.
5. Keep Titania and Miranda unresolved until their exact released GIS bytes and georeferencing close, or the user explicitly changes the 15-body delivery scope. No B2 PR has been opened.
