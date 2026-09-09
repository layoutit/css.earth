# Jovian static visual review — integrated capture

Capture `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z` at `93dcb4fe32d956549fbed9c62e1e3e836cc18393`.

**Changes required:** Io and Ganymede categorical legends overlap the following description and facts at both DPRs. Root confirmed the fixed-height parent and is preparing a scoped layout fix. Corrected captures have not been inspected.

Europa’s normal imagery and focused Agenor relative-height view are acceptable in the reviewed poses. The regional extent, gray no-data surround, meter scale and relative-datum/cartographic-relief caveats remain visible. Enabled scene shadows can obscure the narrow numeric patch; the unlit mode is the useful scientific reading view.

Normal imagery and scientific globe patches are coherent in the inspected Io/Ganymede poses, including lit drag captures, but this does not remove the sidebar blocker. Gray imagery gaps and mosaic contrast transitions remain visible.

Scope: 20 directly inspected PNGs out of the 60-file inventory, covering all six body/DPR cases. All six copied capture records have empty errors and completed context close. They were still marked `CAPTURED_UNREVIEWED`. No source/native parity, all-camera, all-pole or final cohort qualification is claimed. Enhanced views remain pending in the supplemental capture.

## Exact inspected PNGs

- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/io-dpr1/normal-shadows-false-scene.png`
  SHA-256 `bfad9822b567cd72d650db10391b6ee2dfdcf7b8e2e5dd0ef588c6d588a284c0`; 666497 bytes. Coherent grayscale globe with observed dark volcanic terrain retained. No obvious gross missing strip or broken silhouette in this pose.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/io-dpr1/normal-shadows-true-scene.png`
  SHA-256 `182a9659eb449e396f324fe08fda78eda286695b91c2d57d3e84b447ab4f629e`; 588788 bytes. Left-lit/right-dark surface and terminator remain coherent; no obvious large holes in this pose.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/io-dpr1/geology-shadows-false-details-1.png`
  SHA-256 `4b2e847e72b6b0ad301e96f96dc7809eb597b12209d13fab1b6ae75cfb271699`; 708795 bytes. BLOCKER: categorical rows visibly overlap the following description and fact rows. Globe has distinct categorical patches; fine lower-hemisphere band boundaries remain visible.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/io-dpr2/geology-shadows-false-details-1.png`
  SHA-256 `334d0c1b543fa365bd41343e562de60106ca547eec0f8ea40ca8fd4c62d6e893`; 1763525 bytes. BLOCKER repeats at DPR2: categorical legend and following prose overlap. Distinct globe categories remain visible.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/ganymede-dpr1/geology-shadows-false-details-1.png`
  SHA-256 `e7642d98ffe33822b7f8f1158724f86b058c0745de921fa1e8fcdceb9ec9c9bf`; 748758 bytes. BLOCKER: long categorical legend flows behind following description and facts. Globe shows distinct interpreted terrain patches and a southern gray gap.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/ganymede-dpr2/geology-shadows-false-details-1.png`
  SHA-256 `8c2a164a522b4420627e8324f20f91555f200d893bfa743381031965297db3c7`; 1910349 bytes. BLOCKER repeats at DPR2. Narrow mapped terrain patches remain distinct; no obvious gross silhouette failure.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/europa-dpr1/normal-shadows-false-scene.png`
  SHA-256 `cc757b8db1d4592021ba099fce6e45c211ed4bd187ee5ac3ed0526d4af221200`; 730584 bytes. Fractured grayscale mosaic remains coherent; contrast seams and southern gray no-data footprint are visible. Source gaps and remaining image shadows are disclosed.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/europa-dpr1/elevation-shadows-false-details-1.png`
  SHA-256 `c7b57d87eed4da8f049e58b52d42123cd5e388594c7c3650be67f99a1a601ccd`; 296277 bytes. Agenor patch is centered and useful at the prepared focus, roughly 270 CSS pixels across. Outside the regional footprint remains a gray grid. The -700/-200/300 m scale and relative-datum/cartographic-relief caveats are readable without overlap.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/europa-dpr1/elevation-shadows-true-drag.png`
  SHA-256 `fb263bfbcbcc3a742381697859bf72331c83dea9617657bf84a8a7b094bbbd0a`; 232022 bytes. After drag, the narrow patch remains coherent but mostly dark under enabled scene shadows. Numeric color reading should use the unlit view.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/europa-dpr2/normal-shadows-false-scene.png`
  SHA-256 `df0cdea453b355689ed305f489cd0c0c3cfd10b6826ccf0669e353cd23c25cba`; 2163955 bytes. Consistent with DPR1: fractured mosaic, southern gray gap and source contrast seams retained; no obvious gross registration discontinuity.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/europa-dpr2/elevation-shadows-false-details-1.png`
  SHA-256 `2e6e57aea00bb5f222f8e5fe0237b946690ffca183f3dc779feb18af46db9fe7`; 726550 bytes. Regional height patch, gray no-data surroundings, meter scale and datum/relief limitations remain readable at DPR2.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/europa-dpr2/elevation-shadows-true-scene.png`
  SHA-256 `e6e4afbd9d55435a5ae905663f113fb20fcf160d53d9944fe526666e987cdc15`; 568459 bytes. Enabled scene shadows make the regional numeric colors very dark; the unlit view is the useful scientific reading mode.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/ganymede-dpr1/normal-shadows-false-scene.png`
  SHA-256 `652d712ec0d4feb166e3a64efe6c370a3e0222d4f6d704a047ddb529913528a6`; 703469 bytes. Coherent dark monochrome mosaic with grooves and craters, plus a small southern gray gap. No obvious gross registration failure in this view.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/ganymede-dpr1/normal-shadows-true-drag.png`
  SHA-256 `61429ecc2046d63788b386694478d1f396cd5d69d75c74bd74b331e9888f8737`; 628035 bytes. Lit/terminator geometry and visible grooves remain coherent after drag.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/io-dpr2/normal-shadows-true-drag.png`
  SHA-256 `88e23a9cd4fd19ebfe13049a09e80ea12eb8011bd29890e00ae60095497f2cbb`; 1598588 bytes. Grayscale volcanic face remains coherent under lighting after drag; the normal-view card text is readable.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/io-dpr2/normal-shadows-false-scene.png`
  SHA-256 `f8aa89dbd3a8bccabbc58279a16d9e7f8c9a5d0c4634bcc07c94d95910d6e74f`; 1833087 bytes. Observed dark terrain and volcanic patterns remain distinct in the monochrome globe. The imagery limits are readable; no gross silhouette failure.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/ganymede-dpr2/normal-shadows-false-scene.png`
  SHA-256 `fc78d9285a5d87b989239e2c24aacdce61f499704355865f73dbc5d1af870ff3`; 2036704 bytes. Grooved terrain/craters and the southern gray source gap remain visible. Card text fits; no obvious gross silhouette failure.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/io-dpr2/geology-shadows-true-drag.png`
  SHA-256 `5e32b586b00002d501b9325111b014fc7e4d1a60cb9a281bbd6e7f5eb9271bc7`; 1613219 bytes. Categorical globe and terminator remain coherent after drag. BLOCKER: legend rows continue behind description and facts.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/ganymede-dpr2/geology-shadows-true-drag.png`
  SHA-256 `6cff910166ff45c0b6d3316c03a31e0fe95841836d30b685a76b9ac82710fb12`; 1700578 bytes. Interpreted patches remain coherent under light and after drag. BLOCKER: legend rows continue behind description and facts.
- `output/playwright/b2-surfaces/integrated-2026-09-09T03-59-04.219Z/europa-dpr2/normal-shadows-true-drag.png`
  SHA-256 `778ad3d27bf5b3267e41090226ba07a02ea251b10937a19ed6973714fe30d4ac`; 1909910 bytes. Fractured imagery remains coherent under lighting after drag. Normal imagery description is readable.

All listed hashes and byte counts were rechecked from the retained PNGs. JSON contains the exact status, findings, limits and per-image observations. No repository files, captures or harnesses were changed.
