# B2 integrated Moon, Phobos, Deimos and Dimorphos visual review

**Reviewed with explicit limits.** I inspected 57 existing PNGs: Moon 9, Phobos 15, Deimos 13 and Dimorphos 20, spanning DPR 1 and 2. The globes remain intact and the scientific descriptions are readable. Fine edge artifacts remain; this is not a seam-free or whole-body visual approval.

The exact inventory, dimensions implicit in the original PNGs, byte counts and SHA-256 values are in `inspected-paths.json`; findings and image references are in `review.json`. All 57 image hashes match their capture receipts. The image viewer resized the 2880×2000 DPR2 frames to 1889×1312 for display, so this is a full-frame visual inspection, not pixel-exact comparison.

## Findings

| Body | Visible result and remaining limit |
| --- | --- |
| Moon | Topography and rock-abundance scales and explanations are readable. Missing rock-abundance coverage beyond ±60° is visibly explained and represented by gray graticule. Fine inherited pole/band lines remain in normal and topography views. Shadows are unsupported. |
| Phobos | Normal and scientific views have complete shapes and lit limbs. The previously prominent dotted albedo arc is no longer apparent at the inspected scale. A fine dark arc and slanted line remain in `phobos-dpr2/elevation-shadows-true-scene.png`; faint colored triangle boundaries occur with Shadows off. This is not evidence of missing source coverage. |
| Deimos | Albedo and slope views retain disclosed gray coverage masks. Shadows-on default views are mostly night-side, limiting surface inspection. Fine dotted/brighter edge lines remain toward the lower-left, particularly in `deimos-dpr2/albedo-shadows-true-drag.png` and `deimos-dpr2/elevation-shadows-true-scene.png`. No large blank wedge was seen. |
| Dimorphos | All four views and representative drags retain the complete body. The new modeled slope interpretation and retained positive-sigma albedo qualification are readable. A fine dotted dark arc remains in `dimorphos-dpr2/elevation-shadows-true-drag.png`, faintly in slope after drag, and colored triangle boundaries remain in unlit elevation. The inspected albedo pose mostly faces withheld terrain; the supported region is only a thin lower-limb strip. Full supported albedo coverage is not visually qualified. |

Factsheet and Sources cards are readable in the enumerated images. The old snapshot ellipsizes some trailing scalar legend metadata, including Phobos/Deimos relative-brightness wording and Dimorphos reference-radius wording; endpoints and adjacent explanation remain readable. Root subsequently reported a legend-wrap correction and a card recapture. Those unseen replacement cards are not qualified here and should supersede only the corresponding old card/detail claims after review.

## Capture evidence and status

The capture started at `2026-09-09T03:59:04.449Z` against `http://127.0.0.1:4291`, Chrome `152.0.7977.76`, viewport 1440×1000 CSS pixels, DPR 1/2, with recorded HEAD `93dcb4fe32d956549fbed9c62e1e3e836cc18393`. File pins are stronger evidence than HEAD alone because prepared/shared working files may differ from the commit.

The frozen report at `2026-09-09T04:12:25.170665Z` is **INVALID overall**: Charon DPR1 navigation failed with `ERR_CONNECTION_REFUSED` at approximately 04:11:27. Browser shutdown completed. This failure is preserved in `capture-report-snapshot.json` (4,451,366 bytes; SHA-256 `60b68c31b6285f574ce4bc09894005981e247066b9a6b8a4ac675725a0b1980e`). It is not relabeled a 13-body pass.

The eight scoped cases had completed before that failure: 54 lens/lighting capture views, zero recorded runtime errors, eight completed context closes and 30 short-drag receipts with all nodes retained, unchanged node counts and the same owner. All captured pre-drag states identify the expected active/selected body, ready state and canonical density 2. Camera/lens states and measured drag cadence are retained in `case-receipts.json`; observer RAF and camera publication counts are not compositor FPS, baseline or native parity evidence.

A read-only comparison at the snapshot time found all 243 scoped source-metadata/prepared/image files unchanged from the capture's frozen hashes: 137,602,049 bytes, no mismatches. This comparison covers the four body packages and scene assets, not later shared-shell changes. No source acquisition, decoding, preparation, browser launch, test, Git action or checkout write was performed for this review.

## Boundaries

Only the enumerated PNGs were visually inspected; captured but unseen images are not approved. The review does not establish full rotation, all supported source regions, explicit pole close-ups, high zoom, crust-lens requalification, source-pixel correctness, physical lighting correctness, mobile behavior or native/performance parity. It does not replace the independent source, runtime-installation or aggregate release gates.

All image paths in the inventory are relative to `/Users/ekrof/fed/cssEarth-pluto-small-moons`. The full capture directory is `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/`. No screenshots were copied or altered.
