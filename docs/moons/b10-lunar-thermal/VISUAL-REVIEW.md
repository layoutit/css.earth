# B10 visual and scientific review

The Moon gains **Midnight temperature** and **Heat anomalies**, and its **Rock abundance** view moves to the newer Diviner GHRM model and 2009–2022 observations. All three use 4K scientific materials on the accepted 452-leaf scene. The right selector labels are **Temperature**, **Anomaly**, and **Rock area**; desktop and 390 px checks require both sides of every changed row to fit without ellipsis.

## Version and evidence

Implementation `ff9b389a0` was integrated with main `9ee9c453c` in `8669cbfa0`. The integration adopts the shared README provenance format. [The browser index](evidence/browser-index.json) binds original reports, screenshots, shared files and served assets. Its byte comparisons establish why the earlier DPR2, anomaly, rock, visible-color and interaction results remain applicable: runtime, controls, lenses, scene, page, asset inventory, every image and all 51 captured shared source files are unchanged. Fresh desktop and mobile captures also exercise the integrated prepared-object transport. Later changes add only this evidence and documentation.

The raw capture reports retain their original `CAPTURED_UNREVIEWED` status. This document records the subsequent visual inspection. All three scientific surfaces, their legends, ordinary framing, close zoom, polar boundary and limb were inspected at DPR1 and DPR2. Craters and warm/cool patches remain legible at ordinary framing. Source gaps remain neutral, while valid low values retain the palette. Existing band geometry remains visible at extreme close zoom; this is a material upgrade. The visible-color image bytes are unchanged. Moon has no directional Shadows control; the accepted curvature material remains fixed.

## Scientific checks

- [Independent probes](evidence/source-to-texture.json): 507 original-float → compact-grid → encoded-atlas checks, plus eight exact byte matches against independently fetched PDS HTTP range anchors. Original, compact and runtime hashes and sizes must match their pins before PASS.
- [Empty-output reproduction](evidence/numeric-replay.json): all three compact grids and receipts reproduce byte for byte from the original archives.
- [Source restoration](evidence/source-restoration.json): the normal pinned streaming downloader restored and verified the complete 3,303,014,400-byte rock archive into an empty directory. All three initial PDS downloads and conversion receipts are also retained.
- Complete Moon source closure passes: 24 inputs, including the checked-in compact TIFFs and restorable original IMG files. Longitude starts at 0°E in the originals and −180° in the display; negative anomalies are valid. NaNs remain missing, and physical rock-fraction rejection precedes sampling.

[The Moon README](../../../src/planets/moon/README.md) contains the source identities, science meaning, coverage, processing limits and credits. Source resolving power is not equal to display-grid spacing. Temperature is fitted midnight temperature, not a live map. Anomalies include terrain-model residuals and do not establish geothermal activity. Native valid sphere coverage is 93.9687% for temperature, 93.8869% for anomalies and 93.8867% for rock abundance.

## Application checks and limits

- Acquisition tests: 18 pass. Numeric conversion tests: 4 pass. Static-material and minimap tests: 9 pass. Preparation build and typecheck pass. Workspace package tests pass.
- Moon tests: 15 pass; one strict shared ownership audit fails. [Integrated package closure](evidence/packages-integrated.json) verifies scene, tree, camera and package bindings, and matches all 439 shared audit findings to the main baseline. This is not a clean aggregate audit.
- Shared conformance passes mobile, dataset interactions at DPR1/DPR2, lens race, reacquisition, rejection and destroy. [Interaction log](evidence/checks/b10-conformance-interactions.log) and [lifecycle log](evidence/checks/b10-conformance-lifecycle.log) retain the original results.
- [DOM cleanliness](evidence/checks/b10-dom-cleanliness.log) passes both DPRs with retained interaction.
- [The full build](evidence/checks/b10-build.log) stops during the all-object prebuild on absent `src/planets/polymele/prepared/runtime.json` in this sparse checkout. Full-repository build/test/browser readiness is not established. No unrelated body preparation was launched to hide that gap.
- Independent code review found a missing expected-hash assertion in the evidence script; it was fixed and the numerical verification rerun. No other actionable finding was reported in the bounded converter, scalar transform, raster-scale and streaming review.

## Delivery and working cost

[Fresh installation](evidence/fresh-install.json) downloads all 73 Moon runtime images with **zero reuse**, checking every size and hash. All 17 new/changed images were published through the existing content-addressed asset service. Installed Moon images total **39,829,792 bytes**; this excludes shared shell/universe assets and JSON and is not a measured production cold-load total. The fresh installed image bytes were mounted for the later captures and remain exact after documentation integration.

The three canonical atlases are 4096 × 2048; their compressed sizes are 9,038,096 bytes (temperature), 6,109,446 (anomalies) and 5,929,384 (rocks). One such atlas represents 32 MiB of raw RGBA pixels before browser overhead. We make no GPU-residency or steady-frame-rate claim.

A preliminary 8K/4K temperature comparison at ordinary framing showed little visible difference, while the capture job's observed peak fell from about 5.4 to 4.7 GiB. These are whole tool-job RSS observations including Astro, capture code and Chrome, not browser-only texture memory. Final conversions ran one at a time; conversion peaks stayed below 700 MB and the three-material replay below 1.3 GB. Resource receipts are in `evidence/checks/`.

The large additions are three compact numeric scientific TIFFs (28,666,039 bytes) and about 42 MB of source-bound visual evidence. Only ordinary views, close zoom and the mobile globe/selector are retained; redundant drag/detail screenshots are omitted. Original reports remain unmodified. The 9.9 GB of original archives are ignored and restored from pins. B9's final documentation/evidence commit is carried here because it reached the B9 branch after PR #96 was merged.

## Inspected views

| View | Ordinary framing | Close zoom |
| --- | --- | --- |
| heat-anomalies | [Scene](evidence/screenshots/85948054dc6a6489a8ae34d4a06272e8f72c45be98f130eba1956a55f431b56e.png) | [Detail](evidence/screenshots/7d5a998a505bf28c62614e5ccf019fba2ab0237367d195e3edbaeb2fa8dc3292.png) |
| midnight-temperature | [Scene](evidence/screenshots/ee24fa585e1e579714c4fcd989e242c3d637a082d3c86c5a58d70bbb52ce0bb4.png) | [Detail](evidence/screenshots/e1a4de25d3862fbb47271a140f13c3e013f74931a7f3c92677f675f40ba579b7.png) |
| rock-abundance | [Scene](evidence/screenshots/4b37417851de91335542c5f95f05ac51b05c19d7c81360724fd38a76cb0424e5.png) | [Detail](evidence/screenshots/d4fe8f7fdf36ef7bcef1ab5b275bcd20e315f1fa3ec6feeaeb0ae7fee18cca6d.png) |

[390 px selector and expanded details](evidence/screenshots/3315750fcdf71627013a062abc142948cae9aaf22c4b469284902f8cab3f1ff7.png). The three short right labels fit in full.
